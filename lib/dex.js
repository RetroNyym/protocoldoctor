// dex.js — minimal DEX reader (zero deps).
// Extracts the full string pool and class descriptor list from classes<N>.dex.
// This is where "protocol fingerprints" live: endpoints, JSON keys, method names.

const leb = (buf, off) => {
  let result = 0, shift = 0, p = off;
  for (;;) {
    const b = buf[p++];
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result >>> 0, p];
};

const mutf8 = (buf, start) => {
  // null-terminated MUTF-8-ish; good enough for identifiers/urls
  let end = start;
  while (end < buf.length && buf[end] !== 0) end++;
  let out = "";
  for (let i = start; i < end; i++) {
    const c = buf[i];
    if (c < 0x80) out += String.fromCharCode(c);
    else out += "\uFFFD";
  }
  return out;
};

function parseDex(buf) {
  if (buf.length < 112 || buf.toString("ascii", 0, 4) !== "dex\n") {
    throw new Error("not a dex file");
  }
  const stringIdsSize = buf.readUInt32LE(56);
  const stringIdsOff = buf.readUInt32LE(60);
  const typeIdsSize = buf.readUInt32LE(64);
  const typeIdsOff = buf.readUInt32LE(68);
  const classDefsSize = buf.readUInt32LE(96);
  const classDefsOff = buf.readUInt32LE(100);

  const strings = new Array(stringIdsSize);
  for (let i = 0; i < stringIdsSize; i++) {
    const dataOff = buf.readUInt32LE(stringIdsOff + i * 4);
    const [len, bytesStart] = leb(buf, dataOff);
    strings[i] = mutf8(buf, bytesStart).slice(0, len);
  }

  // type descriptors, e.g. Lcom/tencent/mm/sdk/b/a;
  const types = new Array(typeIdsSize);
  for (let i = 0; i < typeIdsSize; i++) {
    const strIdx = buf.readUInt32LE(typeIdsOff + i * 4);
    types[i] = strings[strIdx];
  }

  // class defs → defined classes (first 2 fields are enough)
  const classes = [];
  for (let i = 0; i < classDefsSize; i++) {
    const base = classDefsOff + i * 32;
    const typeIdx = buf.readUInt32LE(base);
    classes.push(types[typeIdx]);
  }

  return { strings, classes };
}

module.exports = { parseDex };
