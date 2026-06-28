// Pull a shell command, a file path, and the project root out of a hook payload.
// Tools disagree on field names, so check the documented spots for each.
// Used by the non-Claude adapters, whose exact payload shapes are unverified.

export function pickCommand(input) {
  return (
    input.tool_input?.command ||
    input.command ||
    input.args?.command ||
    input.toolInput?.command ||
    ""
  );
}

export function pickFilePath(input) {
  return (
    input.tool_input?.file_path ||
    input.tool_input?.path ||
    input.file_path ||
    input.path ||
    input.args?.path ||
    input.args?.file_path ||
    input.toolInput?.path ||
    ""
  );
}

export function pickCwd(input) {
  return input.cwd || input.workspacePaths?.[0] || input.workspace_root || process.cwd();
}
