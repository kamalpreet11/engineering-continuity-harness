#!/usr/bin/env node
// Claude Code PreToolUse guard. Wired for Edit, Write, and Bash.
// Bash -> shell rule (no commit/merge on main). Edit/Write -> edit rules
// (locked plans, generated indexes, plan-first). Verified.

import { readInput } from "../../lib/hook-io.mjs";
import { checkEdit, checkShell } from "../../lib/guards.mjs";
import { denyClaude, pass } from "../../lib/emit.mjs";

const input = await readInput();
const cwd = input.cwd || process.cwd();

const result =
  input.tool_name === "Bash"
    ? checkShell(input.tool_input?.command, cwd)
    : checkEdit(input.tool_input?.file_path, cwd);

if (result) denyClaude(result.reason);
pass();
