import fs from "node:fs";
const pubkey = fs.readFileSync("src-tauri/updater.pub", "utf8").trim();
const endpoint = process.env.SOCOT_UPDATE_URL;
if (endpoint && !endpoint.startsWith("https://"))
  throw new Error("SOCOT_UPDATE_URL must use HTTPS");
const api = process.env.SOCOT_API_URL;
if (api && !api.startsWith("https://"))
  throw new Error("Release API must use HTTPS");
fs.writeFileSync(
  "src-tauri/tauri.release.conf.json",
  JSON.stringify(
    {
      bundle: { createUpdaterArtifacts: true },
      plugins: { updater: { pubkey, endpoints: endpoint ? [endpoint] : [] } },
    },
    null,
    2,
  ),
);
