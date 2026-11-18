import { dailyGamePageFiles } from "./dailyGamePages";

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Movie Club</title>
    <meta
      name="description"
      content="Review movies with your friends."
    />
    <meta property="og:title" content="Movie Club" />
    <meta name="twitter:card" content="summary" />
  </head>
  <body><div id="app"></div></body>
</html>`;

const ORIGIN = "https://club.example";

const GAME = {
  path: "/guessit",
  title: "Guessit: The daily <test> game",
  description: `One "mystery" a day & no account.`,
  structuredData: (url: string) => ({ "@type": "WebApplication", name: "</script>", url }),
};

const ARCHIVE = {
  path: "/guessit/archive",
  title: "Guessit archive",
  description: "Every past puzzle.",
};

const files = dailyGamePageFiles(INDEX_HTML, [GAME, ARCHIVE], ORIGIN);

describe("dailyGamePageFiles", () => {
  it("gives each page the app's HTML under its own title, description and canonical URL", () => {
    const html = files["pages/guessit.html"];

    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain("<title>Guessit: The daily &lt;test&gt; game</title>");
    expect(html).not.toContain("<title>Movie Club</title>");
    expect(html).toContain(
      '<meta name="description" content="One &quot;mystery&quot; a day &amp; no account." />',
    );
    expect(html).not.toContain("Review movies with your friends.");
    expect(html).toContain('<link rel="canonical" href="https://club.example/guessit" />');
    expect(html).toContain('<meta property="og:url" content="https://club.example/guessit" />');
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:card"/g)).toHaveLength(1);
  });

  it("describes a page's structured data without letting it close its script", () => {
    expect(files["pages/guessit.html"]).toContain(
      '<script type="application/ld+json">{"@type":"WebApplication","name":"\\u003c/script>","url":"https://club.example/guessit"}</script>',
    );
    expect(files["pages/guessit/archive.html"]).not.toContain("application/ld+json");
  });

  it("serves each page at its own path", () => {
    expect(files._redirects).toBe(
      "/guessit /pages/guessit.html 200\n/guessit/archive /pages/guessit/archive.html 200\n",
    );
  });

  it("lists the landing page and every page in the sitemap that robots.txt points to", () => {
    expect(files["sitemap.xml"]).toContain("<loc>https://club.example/</loc>");
    expect(files["sitemap.xml"]).toContain("<loc>https://club.example/guessit</loc>");
    expect(files["sitemap.xml"]).toContain("<loc>https://club.example/guessit/archive</loc>");
    expect(files["robots.txt"]).toContain("Sitemap: https://club.example/sitemap.xml");
  });
});
