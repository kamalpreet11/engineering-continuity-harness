// Atomic file writes. A plain writeFileSync truncates the target, then fills it,
// so a concurrent reader (e.g. the PreToolUse guard reading plan frontmatter) can
// catch a half-written file and parse nothing. Writing to a temp file in the same
// directory and renaming over the target closes that window: rename is atomic
// within a filesystem, so a reader sees either the old file or the new one.

import { writeFileSync, renameSync, unlinkSync } from "node:fs";

let seq = 0;

export function writeFileAtomic(path, data) {
  // Temp file sits next to the target so the rename stays on one filesystem.
  // pid + a per-process counter keep the name unique without a clock or RNG.
  const tmp = `${path}.tmp-${process.pid}-${seq++}`;
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // Nothing to clean up; ignore.
    }
    throw err;
  }
}
