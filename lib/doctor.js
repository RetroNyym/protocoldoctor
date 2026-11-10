// doctor.js — the Protocol Doctor engine.
// 1) Extract "protocol tokens" from protocol docs (endpoints, paths, opcodes, keys).
// 2) Check each token against the current binary (dex string pool) or source tree.
// 3) Report which documented bits are alive and which have gone stale.

const fs = require("fs");
const path = require("path");
const { readZip } = require("./zip");
const { parseDex } = require("./dex");

/** Tokens we recognise in protocol documentation. */
function extractTokens(markdown) {
  const tokens = [];
  const seen = new Set();
  const push = (token, kind) => {
    if (!token || token.length < 3 || seen.has(token)) return;
    seen.add(token);
    tokens.push({ token, kind });
  };

  // URLs — the backbone of any protocol doc (backtick/quote/paren terminated)
  for (const m of markdown.matchAll(/https?:\/\/[^\s"'<>)\]\\`]+/g)) push(m[0], "url");

  // hex opcodes / command ids: 0x1f43, 0X1f
  for (const m of markdown.matchAll(/\b0[xX][0-9a-fA-F]{2,8}\b/g)) push(m[0].toLowerCase(), "opcode");

  // absolute paths: /api/v2/things or URI templates in backticks
  for (const m of markdown.matchAll(/[`"'(]([/][a-zA-Z0-9_.:\-/{}]{3,60})[`"'\\s]/g)) push(m[1], "path");

  // JSON keys / MQTT topics in quotes
  for (const m of markdown.matchAll(/"([A-Za-z][A-Za-z0-9_\-\.]{2,40})"/g)) push(m[1], "key");

  // fully-qualified decompiled refs documented on purpose: com.example.api.Camera.getAuth
  for (const m of markdown.matchAll(/\b(?:[a-z][a-z0-9_]+\.){2,}[A-Za-z][A-Za-z0-9_]*\b/g)) {
    const t = m[0];
    if (!/\.(com|net|org|io|dev)$/i.test(t)) push(t, "reference");
  }

  return tokens;
}

/** Everything the binary will be checked against: strings + class descriptors. */
function corpusFromApk(apkPath) {
  const zip = readZip(apkPath);
  const strings = new Set();
  const classes = new Set();
  for (const name of zip.names()) {
    if (/^classes\d*\.dex$/.test(name)) {
      const dex = parseDex(zip.data(zip.entries.get(name)));
      for (const s of dex.strings) strings.add(s);
      for (const c of dex.classes) {
        classes.add(c);
        strings.add(c);
      }
    }
  }
  return { strings, classes, source: "apk" };
}

/** Alternative target: a source tree (the repo of the client that implements the doc). */
function corpusFromSource(dir) {
  const strings = new Set();
  const classes = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|ts|kt|java|py|go|rs|md|json|txt|proto)$/i.test(e.name)) {
        const stat = fs.statSync(p);
        if (stat.size > 2e6) continue;
        const text = fs.readFileSync(p, "utf8");
        for (const seg of text.split(/\s+|[^\w\-.:/?=&]+/)) {
          if (seg.length > 2) strings.add(seg);
        }
      }
    }
  };
  walk(dir);
  return { strings, classes, source: "source-tree" };
}

function check(corpus, tokens) {
  // The dex string pool may store URLs as full strings while docs write the
  // endpoint with a sample query; also references like "sponsor.ajay.app" live
  // inside URL strings, not as standalone strings. Probe accordingly.
  const all = [...corpus.strings];
  const lower = all.map((s) => s.toLowerCase());

  function urlProbes(token) {
    const probes = [token];
    const noQuery = token.split("?")[0];
    if (noQuery !== token) probes.push(noQuery);
    // template URLs like /device/{deviceId}/clean — try the static prefix
    if (token.includes("{")) probes.push(token.slice(0, token.indexOf("{")));
    let pathname = "";
    let origin = "";
    try {
      const u = new URL(token);
      origin = u.origin;
      pathname = u.origin + u.pathname;
      probes.push(origin, pathname, u.host);
    } catch { /* relative or malformed → skip */
    }
    // contains-stage candidates must be *specific*: full URL or full path.
    // Origin/host alone would grant false "alive" to dead endpoints via
    // substring hits against other URLs sharing the host.
    const containsProbes = [token, noQuery, pathname].filter((p) => p && p !== origin && p !== u_host(token));
    return { exact: probes, contains: containsProbes };
  }
  function u_host(token) { try { return new URL(token).host; } catch { return ""; } }

  const results = tokens.map(({ token, kind }) => {
    let alive = corpus.strings.has(token) || corpus.classes.has(token);
    if (!alive) {
      if (kind === "url") {
        const probes = urlProbes(token);
        alive =
          probes.exact.some((p) => corpus.strings.has(p)) ||
          probes.contains.some((p) => p.length > 10 && lower.some((s) => s.includes(p.toLowerCase())));
      } else if (kind === "key" || kind === "reference") {
        const lr = token.toLowerCase();
        alive = lower.some((s) => s.includes(lr));
      }
    }
    return { token, kind, alive };
  });
  const aliveCount = results.filter((r) => r.alive).length;
  return {
    checked: results.length,
    alive: aliveCount,
    stale: results.filter((r) => !r.alive),
    coverage: results.length ? Math.round((aliveCount / results.length) * 100) : 0,
  };
}

function markdownReport(inputApk, inputDocs, verdict, sampleTokens) {
  const lines = [];
  lines.push("## 🩺 Protocol Doctor — report");
  lines.push("");
  lines.push(`**Binary checked:** \`${inputApk}\``);
  lines.push(`**Docs checked:** \`${inputDocs}\``);
  lines.push(`**Coverage:** \`\`${verdict.coverage}%\`\` of documented protocol tokens found in the current binary`);
  lines.push("");
  if (verdict.stale.length) {
    lines.push("### ⚠️ Stale (documented, but not in this build)");
    lines.push("");
    lines.push("| token | kind |");
    lines.push("|---|---|");
    for (const s of verdict.stale.slice(0, 60)) lines.push(`| \`${s.token}\` | ${s.kind} |`);
    if (verdict.stale.length > 60) lines.push(`| … ${verdict.stale.length - 60} more | |`);
    lines.push("");
  }
  lines.push("### 🔎 Sampled protocol tokens in the binary");
  lines.push("");
  for (const s of sampleTokens) lines.push(`- \`${s}\``);
  lines.push("");
  lines.push("_Stale ≠ wrong: the token may be renamed, versioned or dynamic. The doctor lists evidence; you judge._");
  return lines.join("\n");
}

function doctor(options) {
  const { docsPath, apkPath, srcDir } = options;
  const docs = fs.readFileSync(docsPath, "utf8");
  const tokens = extractTokens(docs);
  if (!tokens.length) throw new Error("no protocol tokens recognized in the docs file");

  const corpus = apkPath ? corpusFromApk(apkPath) : corpusFromSource(srcDir);
  const verdict = check(corpus, tokens);

  // sample strings for the "what the binary speaks" teaser
  const sampleTokens = [...corpus.strings]
    .filter((s) => /^https?:\/\//.test(s))
    .slice(0, 8);

  return {
    files: { docs: docsPath, target: apkPath || srcDir, source: corpus.source },
    tokenCounts: tokens.reduce((acc, t) => ((acc[t.kind] = (acc[t.kind] || 0) + 1), acc), {}),
    verdict,
    sampleTokens,
    report: markdownReport(apkPath || srcDir, docsPath, verdict, sampleTokens),
  };
}

module.exports = { doctor, extractTokens, corpusFromApk, corpusFromSource, markdownReport };
