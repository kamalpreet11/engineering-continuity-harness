// Parse the leading <!--HARNESS ... --> metadata block from a harness HTML doc.
// The block is simple key: value YAML. We keep the parser tiny and dependency-free
// on purpose: keys are flat, values are plain strings.

import { readFileSync } from "node:fs";

const BLOCK = /<!--HARNESS\s*([\s\S]*?)-->/;

// Parse a raw string of "key: value" lines into a flat object.
export function parseFrontmatterText(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf(":");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

// Read a file and return its frontmatter object, or null if there is no block.
export function readFrontmatter(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  return parseFrontmatterFromString(raw);
}

// Pull the frontmatter object from an already-loaded file string.
export function parseFrontmatterFromString(raw) {
  const m = raw.match(BLOCK);
  if (!m) return null;
  return parseFrontmatterText(m[1]);
}

// Split keywords on the pipe character into a clean array.
export function splitKeywords(value) {
  if (!value) return [];
  return value
    .split("|")
    .map((k) => k.trim())
    .filter(Boolean);
}
