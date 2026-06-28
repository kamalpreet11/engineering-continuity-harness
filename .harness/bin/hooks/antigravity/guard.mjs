#!/usr/bin/env node
// Antigravity PreToolUse "Decide" guard. Shell commands -> shell rule; file
// edits -> edit rules. Branches on whether a command is present.
//
// UNTESTED: Antigravity's hook payload and decision schema are the least-verified
// of the four (official docs are JS-rendered and could not be read verbatim).
// decideAntigravity emits a superset decision and exits 2 on deny (documented to
// block). Verify against a real Antigravity session before relying on it.

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkCommand } from "../../lib/guards.mjs";
import { pickCommand, pickFilePath, pickCwd } from "../../lib/payload.mjs";
import { decideAntigravity, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = pickCwd(input);
const command = pickCommand(input);

const result = command ? checkCommand(command, cwd) : checkEdit(pickFilePath(input), cwd);

if (result) decideAntigravity(result);
pass();
