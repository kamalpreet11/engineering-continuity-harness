#!/usr/bin/env node
// Codex CLI PreToolUse guard. Shell commands -> shell rule; file edits via
// apply_patch -> edit rules. Branches on whether a command is present.
//
// UNTESTED: Codex's PreToolUse payload shape was taken from the docs, not run.
// Codex uses the same permissionDecision deny schema as Claude. Verify against a
// real Codex session before relying on it. The rule logic is the shared, verified
// path; only payload parsing and the deny schema are unproven here.

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkShell } from "../../lib/guards.mjs";
import { pickCommand, pickFilePath, pickCwd } from "../../lib/payload.mjs";
import { denyCodex, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = pickCwd(input);
const command = pickCommand(input);

const result = command ? checkShell(command, cwd) : checkEdit(pickFilePath(input), cwd);

if (result) denyCodex(result.reason);
pass();
