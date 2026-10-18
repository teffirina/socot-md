import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";
import QRCode from "qrcode";
import { z } from "zod";
import {
  scanRequestSchema,
  scanSignatureMatches,
  type ScanRequest,
} from "../lib/invoice-scan";
import { fromThisComputer } from "./demo-ai";

type Pending = { expires: number; file?: ScanRequest["file"] };

// One-time links that let a phone on the same Wi-Fi hand an invoice photo to
// this computer. Files stay in memory until the computer collects them.
export class PhoneScans {
  private items = new Map<string, Pending>();
  constructor(private ttl = 10 * 60_000) {}
  create() {
    this.prune();
    const token = randomBytes(24).toString("base64url");
    this.items.set(token, { expires: Date.now() + this.ttl });
    return token;
  }
  put(token: string, file: ScanRequest["file"]) {
    const item = this.live(token);
    if (!item || item.file) return false;
    item.file = file;
    return true;
  }
  take(token: string): "waiting" | "expired" | ScanRequest["file"] {
    const item = this.live(token);
    if (!item) return "expired";
    if (!item.file) return "waiting";
    this.items.delete(token);
    return item.file;
  }
  private live(token: string) {
    const item = this.items.get(token);
    if (item && item.expires > Date.now()) return item;
    this.items.delete(token);
    return undefined;
  }
  private prune() {
    for (const [token, item] of this.items)
      if (item.expires <= Date.now()) this.items.delete(token);
  }
}

// The address a phone on the same network can reach, e.g. 192.168.1.20.
export function lanAddress() {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter(
      (a): a is NonNullable<typeof a> =>
        !!a && a.family === "IPv4" && !a.internal,
    )
    .map((a) => a.address);
  return (
    candidates.find((a) =>
      /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(a),
    ) ?? candidates[0]
  );
}

const tokenSchema = z.object({ token: z.string().min(20).max(64) }).strict();

/** Start and collect phone scans; only for the computer running Socot. */
export function phoneScanRouter(
  scans: PhoneScans,
  port: number,
  address = lanAddress,
) {
  const router = Router();
  router.use((req, res, next) => {
    if (fromThisComputer(req)) next();
    else
      res.status(403).json({
        error: "Scanarea cu telefonul se pornește de pe calculatorul cu Socot.",
      });
  });
  router.post("/start", async (_req, res) => {
    const host = address();
    if (!port || !host) {
      res.status(503).json({
        error:
          "Calculatorul nu este conectat la o rețea Wi-Fi sau scanarea cu telefonul este oprită.",
      });
      return;
    }
    const token = scans.create();
    const url = `http://${host}:${port}/?t=${token}`;
    res.json({
      token,
      url,
      qr: await QRCode.toString(url, { type: "svg", margin: 1 }),
    });
  });
  router.post("/poll", (req, res) => {
    const { token } = tokenSchema.parse(req.body);
    const result = scans.take(token);
    res.json(
      typeof result === "string"
        ? { status: result }
        : { status: "ready", file: result },
    );
  });
  return router;
}

/** The small page and upload endpoint served to phones on the local network. */
export function phoneApp(scans: PhoneScans) {
  const app = express();
  app.disable("x-powered-by");
  app.use(rateLimit({ windowMs: 60_000, limit: 30 }));
  app.get("/", (_req, res) => {
    res
      .set(
        "Content-Security-Policy",
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'",
      )
      .type("html")
      .send(phonePage);
  });
  app.post("/upload", express.json({ limit: "10mb" }), (req, res) => {
    const parsed = scanRequestSchema
      .pick({ file: true })
      .extend({ token: z.string().min(20).max(64) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Alege o poză sau un PDF de cel mult 7 MB.",
      });
      return;
    }
    const { token, file } = parsed.data;
    if (!scanSignatureMatches(file.type, Buffer.from(file.data, "base64"))) {
      res
        .status(400)
        .json({ error: "Conținutul fișierului nu corespunde formatului." });
      return;
    }
    if (!scans.put(token, file)) {
      res.status(410).json({
        error:
          "Linkul a expirat sau a fost deja folosit. Scanează din nou codul QR.",
      });
      return;
    }
    res.json({ ok: true });
  });
  return app;
}

const phonePage = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Socot · Scanează factura</title>
<style>
body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f6f8f4;color:#1d4a45}
main{max-width:420px;margin:0 auto;padding:28px 20px}
h1{font-size:24px;margin:8px 0 4px}p{margin:0 0 20px;color:#5b726d}
label{display:block;text-align:center;padding:18px;margin:12px 0;border-radius:14px;font-weight:600;cursor:pointer}
.photo{background:#1d4a45;color:#fff}.file{background:#fff;border:1px solid #d9e2dc}
input{display:none}#status{margin-top:20px;padding:14px;border-radius:12px;display:none}
.ok{display:block!important;background:#e9f4dc;color:#2f6b4f}.err{display:block!important;background:#f8e4df;color:#9b3a26}
.busy{display:block!important;background:#fff;border:1px solid #d9e2dc}
</style></head><body><main>
<b>Socot</b><h1>Scanează factura</h1>
<p>Fă o poză clară facturii sau alege un PDF. Ajunge pe calculator, unde AI o citește și verifici ciorna.</p>
<label class="photo">Fă o poză<input id="photo" type="file" accept="image/*" capture="environment"></label>
<label class="file">Alege poză sau PDF<input id="file" type="file" accept="image/*,application/pdf"></label>
<div id="status"></div>
</main><script>
const token=new URLSearchParams(location.search).get("t");
const status=document.getElementById("status");
const show=(cls,text)=>{status.className=cls;status.textContent=text};
if(!token)show("err","Linkul nu este complet. Scanează din nou codul QR de pe calculator.");
const base64=(blob)=>new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=fail;r.readAsDataURL(blob)});
async function shrink(file){
  if(file.type==="application/pdf")return file;
  const img=await createImageBitmap(file);
  const scale=Math.min(1,2200/Math.max(img.width,img.height));
  const c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return await new Promise(ok=>c.toBlob(ok,"image/jpeg",0.85));
}
async function send(file){
  if(!file||!token)return;
  show("busy","Se trimite factura…");
  try{
    const blob=await shrink(file);
    if(blob.size>7*1024*1024)throw new Error("Fișierul depășește 7 MB.");
    const type=blob.type==="application/pdf"?"application/pdf":"image/jpeg";
    const r=await fetch("upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,file:{name:file.name||"factura.jpg",type,data:await base64(blob)}})});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||"Trimiterea nu a reușit.");
    show("ok","Gata! Factura a ajuns pe calculator. Verifică ciorna acolo.");
  }catch(e){show("err",e.message||"Trimiterea nu a reușit. Încearcă din nou.")}
}
for(const id of ["photo","file"])document.getElementById(id).addEventListener("change",e=>send(e.target.files[0]));
</script></body></html>`;
