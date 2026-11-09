#!/usr/bin/env node
// bin.js — Protocol Doctor CLI (zero deps).
//   node bin.js protocol.md --apk app.apk
//   node bin.js protocol.md --src ./client

const fs = require("fs");
const path = require("path");
const https = require("https");
const { doctor } = require("./lib/doctor");

const args = process.argv.slice(2);
const docs = args.find((a) => !a.startsWith("--") && !fs.existsSync(a) === false);

let docsPath = null, apkPath = null, srcDir = null, out = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--apk") apkPath = args[++i];
  else if (a === "--src") srcDir = args[++i];
  else if (a === "--out") out = args[++i];
  else if (!a.startsWith("--")) docsPath = a;
}
if (!docsPath || !(fs.existsSync(docsPath))) {
  console.error(__doc__());
  process.exit(1);
}
if (!apkPath && !srcDir) {
  console.error("Provide --apk <file> or --src <folder> to check the docs against.");
  process.exit(1);
}

(async () => {
  if (apkPath && /^https?:\/\//.test(apkPath)) {
    console.error("↓", apkPath);
    apkPath = await download(apkPath);
  }
  const result = doctor({ docsPath, apkPath, srcDir });
  if (out) fs.writeFileSync(out, result.report);
  console.log(result.report);
})().catch((e) => {
  console.error("❌ " + e.message);
  process.exit(1);
});

function download(url, depth = 0) {
  if (depth > 4) return Promise.reject(new Error("too many redirects"));
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.headers.location) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, depth + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error("download failed: HTTP " + res.statusCode));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const tmp = path.join(__dirname, ".tmp-download.bin");
        fs.writeFileSync(tmp, Buffer.concat(chunks));
        resolve(tmp);
      });
    }).on("error", reject);
  });
}

function __doc__() {
  return `Protocol Doctor — check protocol docs against the current app build.
usage: node bin.js <docs.md> (--apk <file|https-url> | --src <folder>) [--out report.md]`;
}
