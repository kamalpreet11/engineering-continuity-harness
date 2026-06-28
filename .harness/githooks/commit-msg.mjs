#!/usr/bin/env node
// The real commit-msg logic. Invoked by the ./commit-msg wrapper as
//   node commit-msg.mjs <path-to-commit-message-file>
// Exit non-zero to reject the commit. Imports resolve relative to this file,
// so it works regardless of the directory git runs the hook from.

import { readFileSync } from "node:fs";
import { checkCommitMessage } from "../bin/lib/commit.mjs";

const file = process.argv[2];
let raw = "";
try {
  raw = readFileSync(file, "utf8");
} catch {
  process.exit(0); // no message file, let git handle it
}

// Drop git comment lines (the "# Please enter..." block and verbose diff).
const body = raw.split("\n").filter((l) => !l.startsWith("#")).join("\n");

const result = checkCommitMessage(body);
if (result) {
  process.stderr.write(`\nCommit blocked by the harness commit rule:\n  ${result.reason}\nSee .harness/instructions/git.md\n\n`);
  process.exit(1);
}
