import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";

const CHUNK_BYTES = 1024 * 1024;

export function hashFileStreaming(path) {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  const handle = openSync(path, "r");
  try {
    for (;;) {
      const length = readSync(handle, buffer, 0, buffer.length, null);
      if (!length) break;
      hash.update(buffer.subarray(0, length));
    }
  } finally {
    closeSync(handle);
  }
  return hash.digest("hex");
}

export function* textLinesStreaming(path) {
  const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  const decoder = new StringDecoder("utf8");
  const handle = openSync(path, "r");
  let pending = "";
  try {
    for (;;) {
      const length = readSync(handle, buffer, 0, buffer.length, null);
      if (!length) break;
      pending += decoder.write(buffer.subarray(0, length));
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        yield line.endsWith("\r") ? line.slice(0, -1) : line;
      }
    }
    pending += decoder.end();
    if (pending.length) yield pending.endsWith("\r") ? pending.slice(0, -1) : pending;
  } finally {
    closeSync(handle);
  }
}

export function countJsonlStreaming(path) {
  let count = 0;
  for (const line of textLinesStreaming(path)) if (line.trim()) count += 1;
  return count;
}
