#!/usr/bin/env node
// Cursor guard. Wired for beforeShellExecution (shell rule) and preToolUse
// (edit rules). One script, branches on whether the payload carries a command.
//
// UNTESTED: Cursor's exact hook payload shape was taken from the docs, not run.
// Verify against a real Cursor session before relying on it. The rule logic is
// shared with the verified Claude path; only the payload parsing is unproven.

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkCommand } from "../../lib/guards.mjs";
import { pickCommand, pickFilePath, pickCwd } from "../../lib/payload.mjs";
import { decideCursor, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = pickCwd(input);
const command = pickCommand(input);

const result = command ? checkCommand(command, cwd) : checkEdit(pickFilePath(input), cwd);

if (result) decideCursor(result);
pass();
