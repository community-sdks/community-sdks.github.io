import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "repos.json");
const TMP_DIR = path.join(ROOT, ".tmp_repos");
const OUT_DIR = path.join(ROOT, "docs", "generated");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function emptyDir(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
}

function repoToLang(repoName) {
  // e.g. godaddy-php -> php
  const parts = repoName.split("-");
  return parts[parts.length - 1].toLowerCase();
}

function safeCopyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function safeCopyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return false;
  ensureDir(destDir);
  // Node 20: fs.cpSync available
  fs.cpSync(srcDir, destDir, { recursive: true });
  return true;
}

function gitClone(org, repo, targetDir) {
  ensureDir(path.dirname(targetDir));
  const url =
    process.env.GITHUB_TOKEN
      ? `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${org}/${repo}.git`
      : `https://github.com/${org}/${repo}.git`;

  execSync(`git clone --depth=1 ${url} "${targetDir}"`, { stdio: "inherit" });
}

function escapeAngleBracketsInTypeLikeSyntax(md) {
  // Escapes generics like Option<...>, Vec<...>, Result<...>, etc.
  // Only inside text (not inside code fences), to avoid breaking code blocks.
  const lines = md.split("\n");
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Toggle code fence blocks
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    // Replace <...> that appears after an identifier, e.g. Option<, Vec<, Result<, Box<, etc.
    // Also covers patterns like Option<[**Vec<String>**](String.md)>
    lines[i] = line
      .replace(/([A-Za-z0-9_]+)</g, "$1&lt;")
      .replace(/>/g, "&gt;");
  }

  return lines.join("\n");
}

function walkFiles(dir, fn) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, fn);
    else fn(full);
  }
}

async function main() {
  const raw = await fsp.readFile(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(raw);

  const org = cfg.org;
  const services = cfg.services || {};

  console.log(`Syncing docs from org: ${org}`);

  await emptyDir(TMP_DIR);
  await emptyDir(OUT_DIR);

  for (const [service, repos] of Object.entries(services)) {
    for (const repo of repos) {
      const lang = repoToLang(repo);
      const repoDir = path.join(TMP_DIR, repo);

      console.log(`\n==> Cloning ${org}/${repo}`);
      gitClone(org, repo, repoDir);

      const destBase = path.join(OUT_DIR, service, lang);
      ensureDir(destBase);

      // Copy README.md -> docs/generated/<service>/<lang>/README.md
      const readmeSrc = path.join(repoDir, "README.md");
      const readmeDest = path.join(destBase, "README.md");
      const hasReadme = safeCopyFile(readmeSrc, readmeDest);

      if (hasReadme) {
        const md = fs.readFileSync(readmeDest, "utf-8");
        const fixed = escapeAngleBracketsInTypeLikeSyntax(md);
        if (fixed !== md) fs.writeFileSync(readmeDest, fixed);
      }

      // Copy docs/ -> docs/generated/<service>/<lang>/docs/
      const docsSrc = path.join(repoDir, "docs");
      const docsDest = path.join(destBase, "docs");
      const hasDocs = safeCopyDir(docsSrc, docsDest);

      if (hasDocs) {
        walkFiles(docsDest, (file) => {
          if (!file.toLowerCase().endsWith(".md")) return;
          const md = fs.readFileSync(file, "utf-8");
          const fixed = escapeAngleBracketsInTypeLikeSyntax(md);
          if (fixed !== md) fs.writeFileSync(file, fixed);
        });
      }

      // Write meta.json for navigation
      const meta = {
        org,
        repo,
        service,
        lang,
        hasReadme,
        hasDocs,
      };

      await fsp.writeFile(path.join(destBase, "_meta.json"), JSON.stringify(meta, null, 2), "utf-8");

      console.log(`Copied: README=${hasReadme}, docs/=${hasDocs} -> ${path.relative(ROOT, destBase)}`);
    }
  }

  console.log("\nDone syncing docs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});