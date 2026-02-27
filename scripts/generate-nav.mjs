import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "docs", "generated");
const SIDEBAR_OUT = path.join(ROOT, "docs", ".vuepress", "sidebar.generated.js");
const NAVBAR_OUT = path.join(ROOT, "docs", ".vuepress", "navbar.generated.js");

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listDirs(p) {
  if (!isDir(p)) return [];
  return fs.readdirSync(p).filter((name) => isDir(path.join(p, name)));
}

function toTitle(s) {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function mdToRoute(mdFilePath) {
  // VuePress route is based on docs folder path relative to /docs
  // We will link to generated paths (without .md)
  // Example: docs/generated/godaddy/php/README.md -> /generated/godaddy/php/
  const rel = mdFilePath.replace(/\\/g, "/").split("/docs/")[1];
  if (!rel) return "/";
  if (rel.endsWith("/README.md")) return `/${rel.replace("README.md", "")}`;
  return `/${rel.replace(".md", "")}`;
}

function collectPages(serviceDir, service, lang) {
  const base = path.join(serviceDir, lang);
  const pages = [];

  const readme = path.join(base, "README.md");
  if (fs.existsSync(readme)) {
    pages.push({ text: "Overview", link: mdToRoute(readme) });
  }

  const docsDir = path.join(base, "docs");
  if (isDir(docsDir)) {
    // Include top-level md files in docs/ as sidebar entries
    const entries = fs.readdirSync(docsDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".md"))
      .map((d) => {
        const full = path.join(docsDir, d.name);
        return {
          text: toTitle(d.name.replace(/\.md$/i, "")),
          link: mdToRoute(full),
        };
      });

    pages.push(...entries);
  }

  return pages;
}

async function main() {
  const services = listDirs(GENERATED_DIR);

  const navbar = [
    { text: "Home", link: "/" },
    { text: "Services", children: services.map((s) => ({ text: toTitle(s), link: `/generated/${s}/` })) },
    { text: "GitHub", link: "https://github.com/community-sdks" },
  ];

  // Sidebar per service root + per language
  const sidebar = {};
  for (const service of services) {
    const serviceRoot = `/generated/${service}/`;
    const serviceDir = path.join(GENERATED_DIR, service);
    const langs = listDirs(serviceDir).sort();

    // Service landing page will be docs/generated/<service>/README.md (created below)
    sidebar[serviceRoot] = [
      {
        text: toTitle(service),
        children: [
          { text: "Service Home", link: serviceRoot },
          ...langs.map((lang) => ({
            text: lang.toUpperCase(),
            collapsible: true,
            children: collectPages(serviceDir, service, lang),
          })),
        ],
      },
    ];
  }

  // Ensure we have a landing README for each service at docs/generated/<service>/README.md
  for (const service of services) {
    const serviceLanding = path.join(GENERATED_DIR, service, "README.md");
    if (!fs.existsSync(serviceLanding)) {
      const serviceDir = path.join(GENERATED_DIR, service);
      const langs = listDirs(serviceDir).sort();
      const lines = [
        `# ${toTitle(service)} SDK`,
        ``,
        `<LanguageTabs service="${service}" :langs='${JSON.stringify(langs)}' />`,
        ``,
        `## Available languages`,
        ``,
        ...langs.map((l) => `- **${l.toUpperCase()}**: /generated/${service}/${l}/`),
        ``,
        `---`,
        ``,
        `> This page is generated. Edit docs in the SDK repositories instead.`,
      ];
      await fsp.writeFile(serviceLanding, lines.join("\n"), "utf-8");
    }
  }

  const sidebarFile = `// AUTO-GENERATED FILE. DO NOT EDIT.\nexport default ${JSON.stringify(sidebar, null, 2)};\n`;
  const navbarFile = `// AUTO-GENERATED FILE. DO NOT EDIT.\nexport default ${JSON.stringify(navbar, null, 2)};\n`;

  await fsp.mkdir(path.dirname(SIDEBAR_OUT), { recursive: true });
  await fsp.writeFile(SIDEBAR_OUT, sidebarFile, "utf-8");
  await fsp.writeFile(NAVBAR_OUT, navbarFile, "utf-8");

  console.log("Generated:");
  console.log("-", path.relative(ROOT, SIDEBAR_OUT));
  console.log("-", path.relative(ROOT, NAVBAR_OUT));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});