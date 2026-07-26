#!/usr/bin/env node
// Claude Code PreToolUse guard. Wired for Edit, Write, and Bash.
// Bash -> command rules (no commit/merge on main; deny destructive, ask before
// writes). Edit/Write -> edit rules (locked plans, what resolving a plan must
// carry, locked decisions, generated indexes, plan-first).

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkCommand } from "../../lib/guards.mjs";
import { pickCommand, pickFilePath, pickCwd, pickEdit } from "../../lib/payload.mjs";
import { decideClaude, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = pickCwd(input);

const result =
  input.tool_name === "Bash"
    ? checkCommand(pickCommand(input), cwd)
    : checkEdit(pickFilePath(input), cwd, pickEdit(input));

if (result) decideClaude(result);
pass();
