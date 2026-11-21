import * as path from "path";
import { runnerImport, type Plugin } from "vite";

import { isDefined } from "../lib/checks/checks.js";
import type * as Seo from "../src/features/daily-game/seo";
import { type PageHead } from "../src/features/daily-game/seo";

/** Where the copies of `index.html` go, apart from any route a static file could shadow. */
const PAGES_DIR = "pages";

const escapeAttribute = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// The tags a page's own head replaces: the site-wide title, description and
// link preview `index.html` carries for every other route.
const SITE_HEAD_TAGS = [
  /[ \t]*<title>[\s\S]*?<\/title>[ \t]*\n?/g,
  /[ \t]*<meta\s+name="description"[^>]*>[ \t]*\n?/g,
  /[ \t]*<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>[ \t]*\n?/g,
];

function pageHeadTags(page: PageHead, origin: string): string {
  const url = `${origin}${page.path}`;
  const title = escapeAttribute(page.title);
  const description = escapeAttribute(page.description);
  const image = `${origin}/android-chrome-512x512.png`;
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:site_name" content="Movie Club" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ];
  if (isDefined(page.structuredData)) {
    // `<` escaped so no string in the data can close the script element.
    const json = JSON.stringify(page.structuredData(url)).replaceAll("<", "\\u003c");
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return tags.map((tag) => `    ${tag}\n`).join("");
}

/** `index.html` with `page`'s own title, description, canonical URL and link preview. */
export function pageHtml(indexHtml: string, page: PageHead, origin: string): string {
  const withoutSiteHead = SITE_HEAD_TAGS.reduce((html, tag) => html.replace(tag, ""), indexHtml);
  return withoutSiteHead.replace("</head>", `${pageHeadTags(page, origin)}  </head>`);
}

/**
 * Every file the build adds so crawlers, which mostly read the HTML as served,
 * see each page's own head: a copy of `index.html` per page, the rewrites that
 * serve them, and the sitemap and robots.txt that point to them.
 */
export function dailyGamePageFiles(
  indexHtml: string,
  pages: readonly PageHead[],
  origin: string,
): Record<string, string> {
  const files: Record<string, string> = {};
  const rewrites: string[] = [];
  for (const page of pages) {
    const fileName = `${PAGES_DIR}${page.path}.html`;
    files[fileName] = pageHtml(indexHtml, page, origin);
    rewrites.push(`${page.path} /${fileName} 200`);
  }
  // Netlify reads `_redirects` before netlify.toml, so these win over its
  // catch-all `/* /index.html`.
  files._redirects = `${rewrites.join("\n")}\n`;

  const urls = ["/", ...pages.map((page) => page.path)]
    .map((pagePath) => `  <url><loc>${escapeAttribute(`${origin}${pagePath}`)}</loc></url>`)
    .join("\n");
  files["sitemap.xml"] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urls,
    `</urlset>`,
    ``,
  ].join("\n");
  files["robots.txt"] = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
  return files;
}

/**
 * Emits {@link dailyGamePageFiles} for the daily game pages in the club-type
 * registry. `origin` is the production site, which canonical URLs and the
 * sitemap name on every deploy.
 */
export function dailyGamePages({ origin }: { origin: string }): Plugin {
  return {
    name: "daily-game-pages",
    apply: "build",
    enforce: "post",
    async generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset" || typeof index.source !== "string") {
        this.error("daily-game-pages: the build emitted no index.html to copy");
      }
      const root = this.environment.config.root;
      const { module } = await runnerImport<typeof Seo>(
        path.resolve(root, "src/features/daily-game/seo.ts"),
        {
          configFile: false,
          root,
          logLevel: "error",
          resolve: { alias: { "@": path.resolve(root, "src") } },
        },
      );
      const files = dailyGamePageFiles(index.source, module.indexedDailyGamePages(), origin);
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}
