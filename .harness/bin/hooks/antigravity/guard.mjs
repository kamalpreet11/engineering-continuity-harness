#!/usr/bin/env node
// Antigravity PreToolUse "Decide" guard. Shell commands -> shell rule; file
// edits -> edit rules. Branches on whether a command is present.
//
// Payload and decision schema follow Antigravity's docs; confirm against a live
// session. decideAntigravity emits a superset and exits 2 on deny to hard-block.

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
