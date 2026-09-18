fn main() {
    println!("cargo:rerun-if-env-changed=SOCOT_API_URL");
    tauri_build::build()
}
