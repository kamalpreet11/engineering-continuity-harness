#!/usr/bin/env node
// Cursor guard. Wired for beforeShellExecution (shell rule) and preToolUse
// (edit rules). Branches on whether the payload carries a command.
//
// Payload shape follows Cursor's docs; confirm it against a live session.

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
