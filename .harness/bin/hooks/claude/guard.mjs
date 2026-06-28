#!/usr/bin/env node
// Claude Code PreToolUse guard. Wired for Edit, Write, and Bash.
// Bash -> command rules (no commit/merge on main; deny destructive, ask before
// writes). Edit/Write -> edit rules (locked plans, generated indexes, plan-first).
// Verified.

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkCommand } from "../../lib/guards.mjs";
import { decideClaude, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = input.cwd || process.cwd();

const result =
  input.tool_name === "Bash"
    ? checkCommand(input.tool_input?.command, cwd)
    : checkEdit(input.tool_input?.file_path, cwd);

if (result) decideClaude(result);
pass();
