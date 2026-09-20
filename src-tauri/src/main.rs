#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use aes_gcm::{
    aead::{rand_core::RngCore, Aead, OsRng},
    Aes256Gcm, KeyInit, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::Manager;
struct Store(Mutex<Connection>);
fn credential(name: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("md.socot.desktop", name).map_err(|e| e.to_string())
}
fn key() -> Result<Vec<u8>, String> {
    let e = credential("local-encryption-key")?;
    match e.get_password() {
        Ok(v) => STANDARD.decode(v).map_err(|e| e.to_string()),
        Err(keyring::Error::NoEntry) => {
            let mut b = vec![0; 32];
            OsRng.fill_bytes(&mut b);
            e.set_password(&STANDARD.encode(&b))
                .map_err(|e| e.to_string())?;
            Ok(b)
        }
        Err(e) => Err(e.to_string()),
    }
}
fn encrypt(data: &str) -> Result<Vec<u8>, String> {
    let k = key()?;
    let c = Aes256Gcm::new_from_slice(&k).map_err(|e| e.to_string())?;
    let mut n = [0; 12];
    OsRng.fill_bytes(&mut n);
    let mut out = n.to_vec();
    out.extend(
        c.encrypt(Nonce::from_slice(&n), data.as_bytes())
            .map_err(|e| e.to_string())?,
    );
    Ok(out)
}
fn decrypt(data: &[u8]) -> Result<String, String> {
    if data.len() < 12 {
        return Err("Date locale corupte".into());
    }
    let k = key()?;
    let c = Aes256Gcm::new_from_slice(&k).map_err(|e| e.to_string())?;
    String::from_utf8(
        c.decrypt(Nonce::from_slice(&data[..12]), &data[12..])
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
fn scoped(scope: &str) -> String {
    if scope == "demo-v1" {
        scope.into()
    } else {
        format!(
            "{}|{}",
            option_env!("SOCOT_API_URL")
                .filter(|s| !s.is_empty())
                .unwrap_or("http://localhost:3000/api"),
            scope
        )
    }
}
#[tauri::command]
fn local_read(store: tauri::State<Store>, scope: String) -> Result<Option<String>, String> {
    let scope = scoped(&scope);
    let db = store.0.lock().map_err(|e| e.to_string())?;
    let data: Option<Vec<u8>> = db
        .query_row(
            "SELECT payload FROM local_state WHERE scope=?1",
            [scope],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    data.map(|d| decrypt(&d)).transpose()
}
#[tauri::command]
fn local_write(store: tauri::State<Store>, scope: String, payload: String) -> Result<(), String> {
    if payload.len() > 5_000_000 {
        return Err("Limita de stocare locală a fost atinsă".into());
    }
    let scope = scoped(&scope);
    let data = encrypt(&payload)?;
    store.0.lock().map_err(|e|e.to_string())?.execute("INSERT INTO local_state(scope,payload) VALUES(?1,?2) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload",params![scope,data]).map_err(|e|e.to_string())?;
    Ok(())
}
fn api_url() -> Result<String, String> {
    let url = option_env!("SOCOT_API_URL")
        .filter(|s| !s.is_empty())
        .unwrap_or("http://localhost:3000/api");
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https"
        && !(cfg!(debug_assertions) && matches!(parsed.host_str(), Some("localhost" | "127.0.0.1")))
    {
        return Err("API neconfigurat: buildurile release necesită SOCOT_API_URL HTTPS. Modul demo rămâne disponibil.".into());
    }
    Ok(url.trim_end_matches('/').into())
}
#[tauri::command]
async fn api_request(path: String, body: Option<Value>) -> Result<Value, String> {
    if ![
        "/login",
        "/catalog",
        "/logout",
        "/me",
        "/invoices",
        "/operations",
        "/health",
        "/compliance", "/company", "/accounts", "/ledger-report", "/source-document",
        "/rules",
        "/rules/approve",
        "/periods",
        "/journal/approve",
        "/reports",
        "/reports/export",
    ]
    .contains(&path.as_str())
    {
        return Err("Rută nepermisă".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}{}", api_url()?, path);
    let mut req = if let Some(ref b) = body {
        client.post(url).json(b)
    } else {
        client.get(url)
    };
    if path != "/login" {
        if let Ok(t) = credential(&format!("api-session:{}", api_url()?))?.get_password() {
            req = req.bearer_auth(t)
        }
    }
    let response = req
        .send()
        .await
        .map_err(|_| "Conexiunea la API nu este disponibilă".to_string())?;
    let status = response.status().as_u16();
    let mut data: Value = response.json().await.map_err(|e| e.to_string())?;
    if path == "/login" && status == 200 {
        let token = data["token"].as_str().ok_or("Sesiune invalidă")?;
        credential(&format!("api-session:{}", api_url()?))?
            .set_password(token)
            .map_err(|e| e.to_string())?;
        data.as_object_mut().unwrap().remove("token");
    }
    if path == "/logout" && status == 200 {
        let _ = credential(&format!("api-session:{}", api_url()?))?.delete_credential();
    }
    Ok(json!({"status":status,"data":data}))
}
#[tauri::command]
fn print_document(window:tauri::WebviewWindow)->Result<(),String>{window.print().map_err(|e|e.to_string())}
fn main() {
    tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(w)=app.get_webview_window("main"){let _=w.set_focus();}})).plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init()).setup(|app|{let dir=app.path().app_data_dir()?;std::fs::create_dir_all(&dir)?;let db=Connection::open(dir.join("socot.sqlite"))?;db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS local_state(scope TEXT PRIMARY KEY,payload BLOB NOT NULL); PRAGMA user_version=1;")?;app.manage(Store(Mutex::new(db)));Ok(())}).invoke_handler(tauri::generate_handler![local_read,local_write,api_request,print_document]).run(tauri::generate_context!()).expect("Socot nu a putut porni");
}
