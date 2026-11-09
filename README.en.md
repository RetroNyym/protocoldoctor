# 🩺 Protocol Doctor

> Reverse-engineering protocol docs rot silently. This bot proves, on every push/release, whether the docs still speak the same language as the current build.

Full (Turkish) documentation: [README.md](README.md)

## The problem

Hundreds of GitHub repos carry hand-written reverse-engineering protocol notes (smart home, wearables, robots, car APIs...). Thousands of client projects depend on those notes. When the vendor app updates, the protocol drifts, the docs rot, and 40k users wake up to broken clients. Nobody was watching.

## What it does

1. Reads your protocol doc and extracts **evidence tokens**: endpoints, opcodes (`0x2f21`), URI paths, JSON keys, documented references.
2. Reads the **current build**: `--apk app.apk` (ZIP + DEX string pool, statically — never executes) or `--src ./client`.
3. Cross-checks every token against the build.
4. Reports coverage + the exact stale list.

## Quick start

```bash
node bin.js protocol.md --apk vendor-app.apk
node bin.js protocol.md --src ./companion-client --out check.md
node bin.js protocol.md --apk https://github.com/org/app/releases/download/v2/app.apk
```

No `npm install`. Zero runtime dependencies (Node ≥ 18). Nothing leaves the machine.

GitHub Action usage and highlights are in the Turkish README (this file shows the essentials).

## What it measures — and what it doesn't

- ✅ An **evidence list**: "is this documented token alive in this build?" — auditable, deterministic.
- ❌ Not a verdict. "Stale ≠ wrong" — the token may be renamed, templated, or assembled at runtime. The report says so, honestly, at the bottom.

## Roadmap

- [x] ZIP/DEX + docs cross-check engine (v0.1)
- [ ] Issue-comment bot mode via GitHub Action
- [ ] Proguard/deobfuscation map support
- [ ] Docs patch PRs for stale sections
- [ ] Multi-version APK diff ("where the protocol bent")
- [ ] Opcode-level checks (BLE/GATT, MQTT docs)

## Turkish README

Detailed documentation in Turkish: [README.md](README.md)

---

MIT license. (c) RetroNyym & contributors.
