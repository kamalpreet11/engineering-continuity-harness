// Work out what a file will contain *after* a proposed edit, so a rule can be
// checked against the outcome instead of against a fragment. This is what lets
// the guard judge a plan by the state it is about to have, not the state on disk.
//
// The edit comes from pickEdit in payload.mjs, normalized across agents:
//   { content, oldString, newString, replaceAll, texts }
// A whole-file write carries content. A targeted edit carries oldString and
// newString. texts is every string in the payload, used only by the fallback.
//
// Honest scope: an exact preview is possible for the write and edit shapes above,
// which is what Claude sends. An unfamiliar payload (a patch format, a tool we
// have not seen) cannot be replayed, so callers fall back to scanning the payload
// for a settings-block-shaped `state:` line and merging the known keys it finds
// over the file on disk. That fallback reads lines out of context, so a document
// that quotes a bare `state:` line at the start of a line could trip it.

import { readFileSync } from "node:fs";
import { parseFrontmatterFromString, parseFrontmatterText } from "./frontmatter.mjs";

// A settings-block line that resolves a plan. Anchored to a whole line so prose
// mentioning a state in passing does not match.
const RESOLVED_STATE_LINE = /^[ \t]*state:[ \t]*(implemented|abandoned|superseded)[ \t]*$/m;

// The only keys the fallback will lift out of a fragment. Everything else in a
// half-seen edit is ignored rather than guessed at.
const FALLBACK_KEYS = new Set([
  "state", "implemented", "abandoned", "abandoned_reason",
  "superseded", "superseded_by", "knowledge", "knowledge_reason",
]);

// Replace text without letting `$` sequences in the replacement be interpreted,
// which is what String.replace would do.
function substitute(haystack, needle, replacement, all) {
  if (all) return haystack.split(needle).join(replacement);
  const i = haystack.indexOf(needle);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

// The file's contents after the edit. { text, exact: true } when it could be
// replayed; { text: null, exact: false } when it could not.
export function previewEdit(absPath, edit) {
  if (!edit) return { text: null, exact: false };
  if (typeof edit.content === "string") return { text: edit.content, exact: true };
  if (typeof edit.oldString !== "string" || typeof edit.newString !== "string") {
    return { text: null, exact: false };
  }
  if (edit.oldString === "") return { text: null, exact: false }; // no unique target

  let current;
  try {
    current = readFileSync(absPath, "utf8");
  } catch {
    return { text: null, exact: false };
  }
  if (!current.includes(edit.oldString)) return { text: null, exact: false };

  return { text: substitute(current, edit.oldString, edit.newString, edit.replaceAll), exact: true };
}

// Pull the known keys out of a fragment that carries a resolving state line.
function fallbackFields(texts) {
  for (const text of texts || []) {
    if (typeof text !== "string" || !RESOLVED_STATE_LINE.test(text)) continue;
    const parsed = parseFrontmatterText(text);
    const fields = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (FALLBACK_KEYS.has(key)) fields[key] = value;
    }
    if (fields.state) return fields;
  }
  return null;
}

// The settings block the file will have after the edit, or null when the edit
// tells us nothing about it. diskFm is the block currently on disk.
export function nextFrontmatter(absPath, diskFm, edit) {
  const { text, exact } = previewEdit(absPath, edit);
  if (exact) return parseFrontmatterFromString(text) || {};

  const fields = fallbackFields(edit && edit.texts);
  return fields ? { ...diskFm, ...fields } : null;
}
