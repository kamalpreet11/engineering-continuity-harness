#!/usr/bin/env node
// Regenerate the two browse pages from the docs frontmatter:
//   docs/index.html        -> master hub across plans / concepts / decisions / specs
//   docs/plans/index.html  -> the deeper plan navigator
//
// These pages are generated, never hand-edited. Run after any doc changes:
//   node .harness/bin/build-index.mjs

import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFrontmatter, splitKeywords } from "./lib/frontmatter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", ".."); // .harness/bin -> project root
const docsDir = join(projectRoot, "docs");

const SECTIONS = [
  { type: "plans", title: "Plans", dir: "plans" },
  { type: "concepts", title: "Concepts", dir: "concepts" },
  { type: "decisions", title: "Decisions", dir: "decisions" },
  { type: "specs", title: "Specs", dir: "specs" },
];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Read every doc in a section directory (skipping the generated index.html).
function readSection(dir) {
  const full = join(docsDir, dir);
  if (!existsSync(full)) return [];
  const rows = [];
  for (const file of readdirSync(full)) {
    if (!file.endsWith(".html") || file === "index.html") continue;
    const fm = readFrontmatter(join(full, file)) || {};
    rows.push({
      file,
      href: `${dir}/${file}`,
      name: fm.name || file.replace(/\.html$/, ""),
      description: fm.description || "",
      keywords: splitKeywords(fm.keywords),
      state: fm.state || "",
      tech_debt: fm.tech_debt || "",
      created: fm.created || "",
    });
  }
  rows.sort((a, b) => (b.created || "").localeCompare(a.created || "") || a.name.localeCompare(b.name));
  return rows;
}

function stateBadge(state) {
  if (!state) return "";
  return `<span class="badge state-${esc(state)}">${esc(state)}</span>`;
}

function debtBadge(debt) {
  if (!debt) return "";
  return `<span class="badge debt-${esc(debt)}">tech debt ${esc(debt)}</span>`;
}

const STYLE = `
  :root { --ink:#1a1a1a; --muted:#666; --line:#e3e3e3; --bg:#fafafa; --accent:#2563eb; }
  * { box-sizing: border-box; }
  body { font: 16px/1.6 -apple-system, system-ui, Segoe UI, Roboto, sans-serif; color: var(--ink); background: var(--bg); margin: 0; }
  main { max-width: 960px; margin: 0 auto; padding: 48px 24px 96px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 28px; }
  .search { width: 100%; padding: 12px 16px; font-size: 16px; border: 1px solid var(--line); border-radius: 10px; margin-bottom: 32px; background: #fff; }
  section { margin-bottom: 40px; }
  section h2 { font-size: 20px; margin: 0 0 12px; display: flex; align-items: baseline; gap: 10px; }
  section h2 .count { font-size: 13px; color: var(--muted); font-weight: 400; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); background: #f7f7f7; }
  tr:last-child td { border-bottom: none; }
  td.name a { color: var(--accent); text-decoration: none; font-weight: 600; }
  td.desc { color: #333; }
  td.date { color: var(--muted); font-size: 13px; white-space: nowrap; }
  .badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
  .state-created { background: #dbeafe; color: #1e40af; }
  .state-implemented { background: #dcfce7; color: #166534; }
  .state-abandoned { background: #fee2e2; color: #991b1b; }
  .state-superseded { background: #fef3c7; color: #92400e; }
  .debt-pending { background: #fef3c7; color: #92400e; }
  .debt-cleared { background: #dcfce7; color: #166534; }
  .kw { display: inline-block; background: #f1f1f1; color: #555; font-size: 11px; padding: 2px 7px; border-radius: 6px; margin: 2px 4px 2px 0; }
  .empty { color: var(--muted); font-style: italic; padding: 8px 0; }
  .nav { margin-bottom: 20px; font-size: 14px; }
  .nav a { color: var(--accent); }
  .hidden { display: none; }
`;

const SEARCH_JS = `
  const box = document.getElementById('search');
  const rows = Array.from(document.querySelectorAll('tr[data-search]'));
  const sections = Array.from(document.querySelectorAll('section'));
  box.addEventListener('input', () => {
    const q = box.value.trim().toLowerCase();
    rows.forEach(r => {
      const hit = !q || r.getAttribute('data-search').includes(q);
      r.classList.toggle('hidden', !hit);
    });
    sections.forEach(s => {
      const visible = s.querySelectorAll('tr[data-search]:not(.hidden)').length;
      s.classList.toggle('hidden', q && visible === 0);
    });
  });
`;

function rowSearchAttr(r) {
  return esc([r.name, r.description, r.keywords.join(" "), r.state, r.tech_debt].join(" ").toLowerCase());
}

// ---- Master hub: docs/index.html ----
function buildHub(data) {
  const sections = SECTIONS.map((sec) => {
    const rows = data[sec.type];
    const isPlans = sec.type === "plans";
    let body;
    if (rows.length === 0) {
      body = `<p class="empty">None yet.</p>`;
    } else {
      const tagCol = isPlans ? "State" : sec.type === "decisions" ? "Tech debt" : "Tags";
      const trs = rows
        .map((r) => {
          let tag = "";
          if (isPlans) tag = stateBadge(r.state);
          else if (sec.type === "decisions") tag = debtBadge(r.tech_debt);
          else tag = r.keywords.slice(0, 3).map((k) => `<span class="kw">${esc(k)}</span>`).join("");
          return `        <tr data-search="${rowSearchAttr(r)}">
          <td class="name"><a href="${esc(r.href)}">${esc(r.name)}</a></td>
          <td class="desc">${esc(r.description)}</td>
          <td>${tag}</td>
          <td class="date">${esc(r.created)}</td>
        </tr>`;
        })
        .join("\n");
      const more = isPlans ? `<a href="plans/index.html">open the plan navigator &rarr;</a>` : "";
      body = `<table>
        <thead><tr><th>Name</th><th>Description</th><th>${tagCol}</th><th>Date</th></tr></thead>
        <tbody>
${trs}
        </tbody>
      </table>${more ? `<p style="font-size:13px;margin-top:8px;color:var(--muted)">${more}</p>` : ""}`;
    }
    return `    <section>
      <h2>${esc(sec.title)} <span class="count">${rows.length}</span></h2>
      ${body}
    </section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project knowledge</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Project knowledge</h1>
  <p class="sub">Browse every plan, concept, decision, and spec. Generated by the harness &mdash; do not edit by hand.</p>
  <input id="search" class="search" type="search" placeholder="Search everything by name, description, or keyword...">
${sections}
</main>
<script>${SEARCH_JS}</script>
</body>
</html>
`;
}

// ---- Plan navigator: docs/plans/index.html ----
function buildPlanNavigator(plans) {
  const tableRows = plans.length
    ? plans
        .map(
          (r) => `        <tr data-search="${rowSearchAttr(r)}">
          <td class="date">${esc(r.created)}</td>
          <td class="name"><a href="${esc(r.file)}">${esc(r.name)}</a></td>
          <td class="desc">${esc(r.description)}</td>
          <td>${stateBadge(r.state)}</td>
        </tr>`
        )
        .join("\n")
    : `        <tr><td colspan="4" class="empty">No plans yet.</td></tr>`;

  const indexRows = plans.length
    ? plans
        .map(
          (r) => `        <tr data-search="${rowSearchAttr(r)}">
          <td class="name"><a href="${esc(r.file)}">${esc(r.name)}</a></td>
          <td>${r.keywords.map((k) => `<span class="kw">${esc(k)}</span>`).join(" ")}</td>
        </tr>`
        )
        .join("\n")
    : `        <tr><td colspan="2" class="empty">No keywords yet.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plans</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <p class="nav"><a href="../index.html">&larr; All knowledge</a></p>
  <h1>Plans</h1>
  <p class="sub">Every plan and how the project has evolved. Generated by the harness &mdash; do not edit by hand.</p>
  <input id="search" class="search" type="search" placeholder="Search plans by name, description, keyword, or state...">

  <section>
    <h2>All plans <span class="count">${plans.length}</span></h2>
    <table>
      <thead><tr><th>Date</th><th>Plan</th><th>Description</th><th>State</th></tr></thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Indexes</h2>
    <table>
      <thead><tr><th>Plan</th><th>Keywords</th></tr></thead>
      <tbody>
${indexRows}
      </tbody>
    </table>
  </section>
</main>
<script>${SEARCH_JS}</script>
</body>
</html>
`;
}

function main() {
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  const data = {};
  for (const sec of SECTIONS) data[sec.type] = readSection(sec.dir);

  writeFileSync(join(docsDir, "index.html"), buildHub(data));

  const plansDir = join(docsDir, "plans");
  if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
  writeFileSync(join(plansDir, "index.html"), buildPlanNavigator(data.plans));

  const total = SECTIONS.reduce((n, s) => n + data[s.type].length, 0);
  console.log(`Rebuilt docs/index.html and docs/plans/index.html (${total} docs).`);
}

main();
