// Pull a shell command, a file path, the project root, and the proposed edit out
// of a hook payload. Tools disagree on field names, so check the known spots for
// each.

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

// Every string in a payload, one or two levels deep. The edit preview falls back
// to scanning these when it cannot replay the edit exactly.
function collectStrings(value, depth = 0) {
  if (typeof value === "string") return [value];
  if (depth > 2 || !value || typeof value !== "object") return [];
  const out = [];
  for (const inner of Array.isArray(value) ? value : Object.values(value)) {
    out.push(...collectStrings(inner, depth + 1));
  }
  return out;
}

// The proposed edit, normalized for edit-preview.mjs. content is a whole-file
// write; oldString/newString is a targeted replacement. Only fields we can replay
// faithfully are named — a patch or diff string reaches texts only, so an
// unfamiliar format degrades to the scan instead of being mistaken for a file.
export function pickEdit(input) {
  const src = input.tool_input || input.args || input.toolInput || input.input || {};
  const str = (...keys) => {
    for (const key of keys) if (typeof src[key] === "string") return src[key];
    return undefined;
  };
  return {
    content: str("content", "contents"),
    oldString: str("old_string", "oldString"),
    newString: str("new_string", "newString"),
    replaceAll: Boolean(src.replace_all ?? src.replaceAll),
    texts: collectStrings(src),
  };
}
