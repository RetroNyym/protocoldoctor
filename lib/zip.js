// zip.js — minimal ZIP reader (zero deps). Reads a file, lists entries,
// and extracts uncompressed data using zlib.inflateRaw for deflate entries.
// Enough for APK (classesN.dex, AndroidManifest.xml, resources.arsc).

const fs = require("fs");
const zlib = require("zlib");

function findEOCD(buf) {
  // EOCD signature PK\x05\x06; comment may trail, scan backwards.
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

function readZip(path) {
  const buf = fs.readFileSync(path);
  const eocd = findEOCD(buf);
  if (eocd < 0) throw new Error("not a zip file (EOCD missing)");
  const count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  // ZIP64 support: locate ZIP64 EOCD locator just before EOCD.
  if (cdOffset === 0xffffffff || count === 0xffff) {
    for (let i = eocd - 20; i >= 0 && i > eocd - 40; i--) {
      if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x06 && buf[i + 3] === 0x07) {
        cdOffset = Number(buf.readBigUInt64LE(i + 8 + 8 + 0)); // zip64 eocd offset
        const z64 = cdOffset;
        cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
        break;
      }
    }
  }

  const entries = new Map();
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break; // central dir file header
    const method = buf.readUInt16LE(p + 10);
    let compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    // extra may carry ZIP64 sizes
    let extra = null;
    if (nameLen + extraLen > 0) extra = buf.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
    if (compSize === 0xffffffff && extra) {
      const id = extra.readUInt16LE(0);
      if (id === 0x0001) compSize = Number(extra.readBigUInt64LE(4 + 8)); // skip original size
    }
    entries.set(name, { name, method, compSize, localOff });
    p += 46 + nameLen + extraLen + commentLen;
  }

  function data(entry) {
    const { method, compSize, localOff } = entry;
    if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error("bad local header for " + entry.name);
    const nameLen = buf.readUInt16LE(localOff + 26);
    const extraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + nameLen + extraLen;
    const comp = buf.subarray(start, start + compSize);
    if (method === 0) return Buffer.from(comp);
    return zlib.inflateRawSync(comp);
  }

  return { buffer: buf, entries, data, names: () => [...entries.keys()] };
}

module.exports = { readZip };
