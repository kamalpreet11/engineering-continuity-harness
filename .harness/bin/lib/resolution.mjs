// What it takes to end a document's life, as tool-agnostic rules.
//
// For a plan: resolving it is the last edit it may ever receive, so that edit has
// to carry everything the rules promise. A plan marked implemented must also
// account for the knowledge it produced — the concepts, decisions, and specs it
// wrote — or say plainly that it produced none. That is what keeps docs/concepts,
// docs/decisions, and docs/specs from staying empty forever.
//
// For a decision: it is final once a newer decision replaces it.
//
// checkResolution is a pure function over the settings block the plan is about to
// have. It touches the disk only to confirm a named knowledge document exists.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readFrontmatter, splitKeywords } from "./frontmatter.mjs";

export const RESOLVED_STATES = ["implemented", "abandoned", "superseded"];

const KNOWLEDGE_ENTRY = /^(concepts|decisions|specs)\/[^/]+\.html$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER = /REPLACE/i;

const deny = (reason) => ({ decision: "deny", reason });
const field = (fm, key) => (fm && typeof fm[key] === "string" ? fm[key].trim() : "");

const SEE_PLANNING = "See .harness/instructions/planning.md.";
const SEE_KNOWLEDGE = "See .harness/instructions/knowledge.md.";
const ATOMIC = "The file locks the moment its state stops being created, so set the state and everything it needs in the same edit.";

function requireDate(fm, key, state) {
  const value = field(fm, key);
  if (!value) {
    return deny(`A plan marked ${state} needs "${key}: YYYY-MM-DD" alongside the state. ${ATOMIC} ${SEE_PLANNING}`);
  }
  if (!DATE.test(value)) {
    return deny(`"${key}: ${value}" is not a date. Write it as YYYY-MM-DD. ${SEE_PLANNING}`);
  }
  return null;
}

function requireText(fm, key, what) {
  const value = field(fm, key);
  if (!value || PLACEHOLDER.test(value)) {
    return deny(`${what} Add "${key}: ..." alongside the state. ${ATOMIC} ${SEE_PLANNING}`);
  }
  return null;
}

// Normalize one knowledge entry to a path relative to docs/.
function normalizeEntry(entry) {
  return entry
    .split("\\").join("/")
    .replace(/^\.\//, "")
    .replace(/^docs\//, "")
    .replace(/^\/+/, "");
}

// A plan claiming to be implemented must say what it taught the project.
function checkKnowledge(fm, root) {
  const value = field(fm, "knowledge");

  if (!value) {
    return deny(
      'This plan does not say what it taught the project. Add "knowledge:" naming the concepts, decisions, and specs this work produced, as paths under docs/ separated by "|". '
      + 'Example: knowledge: concepts/auth-flow.html | decisions/token-storage.html. '
      + 'If the work genuinely produced none, write "knowledge: none" with a "knowledge_reason:" saying why. '
      + `${ATOMIC} ${SEE_KNOWLEDGE}`
    );
  }

  if (value.toLowerCase() === "none") {
    const reason = field(fm, "knowledge_reason");
    if (!reason || PLACEHOLDER.test(reason)) {
      return deny(
        '"knowledge: none" needs a "knowledge_reason:" — one plain sentence on why this work produced no concept, decision, or spec. '
        + `If you cannot write that sentence, the work probably owes a document. ${SEE_KNOWLEDGE}`
      );
    }
    return null;
  }

  const entries = splitKeywords(value);
  if (entries.length === 0) {
    return deny(`"knowledge:" is empty. Name the documents this work produced, or write "knowledge: none" with a reason. ${SEE_KNOWLEDGE}`);
  }

  for (const raw of entries) {
    const entry = normalizeEntry(raw);
    if (!KNOWLEDGE_ENTRY.test(entry)) {
      return deny(
        `"knowledge: ${raw}" is not a knowledge document. Every entry is a concept, a decision, or a spec: concepts/<name>.html, decisions/<name>.html, or specs/<name>.html. ${SEE_KNOWLEDGE}`
      );
    }
    if (!existsSync(join(root, "docs", entry))) {
      return deny(
        `"knowledge:" names docs/${entry}, which does not exist. Write the document first, then resolve the plan. ${SEE_KNOWLEDGE}`
      );
    }
  }
  return null;
}

// Rule check for the settings block a plan is about to have. Returns
// { decision, reason } when the resolution is incomplete, or null when it is fine
// (including when the plan is not being resolved at all).
export function checkResolution({ nextFm, root }) {
  const state = field(nextFm, "state");
  if (!RESOLVED_STATES.includes(state)) return null;

  if (state === "implemented") {
    return requireDate(nextFm, "implemented", state) || checkKnowledge(nextFm, root);
  }
  if (state === "abandoned") {
    return requireDate(nextFm, "abandoned", state)
      || requireText(nextFm, "abandoned_reason", "A plan marked abandoned must record why it was dropped.");
  }
  return requireDate(nextFm, "superseded", state)
    || requireText(nextFm, "superseded_by", "A plan marked superseded must link the plan that replaced it.");
}

// Has a newer decision replaced this one? knowledge.md says the old file stays
// exactly as it was, so the marker usually lives only on the replacement: another
// decision whose "supersedes:" names this one. An explicit "superseded_by:" on the
// file itself counts too. rel is the path relative to the project root.
export function isSupersededDecision(root, rel) {
  const file = rel.split("/").pop();
  const own = readFrontmatter(join(root, rel)) || {};
  if (field(own, "superseded_by")) return true;

  const names = new Set([file.replace(/\.html$/, ""), field(own, "name")].filter(Boolean));
  const dir = join(root, "docs", "decisions");
  let siblings;
  try {
    siblings = readdirSync(dir);
  } catch {
    return false;
  }

  for (const sibling of siblings) {
    if (!sibling.endsWith(".html") || sibling === file || sibling === "index.html") continue;
    const fm = readFrontmatter(join(dir, sibling)) || {};
    for (const claim of splitKeywords(field(fm, "supersedes"))) {
      const cleaned = normalizeEntry(claim).replace(/^decisions\//, "").replace(/\.html$/, "");
      if (names.has(cleaned)) return true;
    }
  }
  return false;
}
