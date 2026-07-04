#!/usr/bin/env node
// Codex CLI PreToolUse guard. Shell commands -> shell rule; file edits via
// apply_patch -> edit rules. Branches on whether a command is present.
//
// Payload shape follows Codex's docs (same permissionDecision schema as Claude);
// confirm it against a live session.

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkCommand } from "../../lib/guards.mjs";
import { pickCommand, pickFilePath, pickCwd } from "../../lib/payload.mjs";
import { decideCodex, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = pickCwd(input);
const command = pickCommand(input);

const result = command ? checkCommand(command, cwd) : checkEdit(pickFilePath(input), cwd);

if (result) decideCodex(result);
pass();
