import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PhoneScans, phoneApp, phoneScanRouter } from "../server/phone-scan";

const jpeg = Buffer.from([255, 216, 255, 224, 0, 16]).toString("base64");
const listen = async (app: express.Express) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return {
    server,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
};
const post = (url: string, body: unknown, headers = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("o poză trimisă de telefon ajunge o singură dată la calculator", async () => {
  const scans = new PhoneScans();
  const desk = express();
  desk.use(express.json());
  desk.use(
    "/phone-scan",
    phoneScanRouter(scans, 3001, () => "192.168.1.20"),
  );
  const a = await listen(desk);
  const b = await listen(phoneApp(scans));
  try {
    const start = await (await post(`${a.base}/phone-scan/start`, {})).json();
    assert.match(start.url, /^http:\/\/192\.168\.1\.20:3001\/\?t=/);
    assert.match(start.qr, /<svg/);
    const poll = () =>
      post(`${a.base}/phone-scan/poll`, { token: start.token });
    assert.equal((await (await poll()).json()).status, "waiting");
    const file = { name: "f.jpg", type: "image/jpeg", data: jpeg };
    assert.equal(
      (await post(`${b.base}/upload`, { token: start.token, file })).status,
      200,
    );
    assert.equal(
      (await post(`${b.base}/upload`, { token: start.token, file })).status,
      410,
    );
    const ready = await (await poll()).json();
    assert.equal(ready.status, "ready");
    assert.deepEqual(ready.file, file);
    assert.equal((await (await poll()).json()).status, "expired");
    assert.equal(
      (await post(`${b.base}/upload`, { token: "x".repeat(32), file })).status,
      410,
    );
    assert.equal(
      (
        await post(`${b.base}/upload`, {
          token: start.token,
          file: { ...file, type: "application/pdf" },
        })
      ).status,
      400,
    );
    const page = await fetch(`${b.base}/`);
    assert.match(await page.text(), /Scanează factura/);
    assert.equal(
      (
        await post(
          `${a.base}/phone-scan/start`,
          {},
          { "x-forwarded-for": "1.2.3.4" },
        )
      ).status,
      403,
    );
  } finally {
    a.server.close();
    b.server.close();
  }
});

test("linkurile pentru telefon expiră", () => {
  const scans = new PhoneScans(-1);
  const token = scans.create();
  assert.equal(scans.take(token), "expired");
});
