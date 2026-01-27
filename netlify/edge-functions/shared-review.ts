const CRAWLER_USER_AGENTS = [
  "Twitterbot",
  "facebookexternalhit",
  "Discordbot",
  "Slackbot",
  "LinkedInBot",
  "WhatsApp",
  "TelegramBot",
  "bot",
  "crawler",
];

interface ReviewData {
  reviews: Array<{
    user_id: string;
    score: number;
    created_date: string;
  }>;
  members: Array<{
    id: string;
    name: string;
    image: string;
  }>;
  work: {
    id: string;
    title: string;
    type: string;
    imageUrl?: string;
    externalId?: string;
    externalData?: {
      poster_path?: string;
      backdrop_path?: string;
      tagline?: string;
      vote_average?: number;
    };
  };
  clubName: string;
}

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
}

function generateOGImageUrl(
  origin: string,
  clubId: string,
  workId: string,
): string {
  // Use the OG image generation function
  // This will redirect to TMDB poster or generate SVG
  return `${origin}/api/og-image?clubId=${clubId}&workId=${workId}`;
}

function generateHTML(params: {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName?: string;
}): string {
  const { title, description, image, url, siteName = "Movie Club" } = params;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    
    <!-- Primary Meta Tags -->
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}">
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:site_name" content="${escapeHtml(siteName)}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(url)}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    
    <!-- Redirect to the actual page after meta tags are read -->
    <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
    
    <link rel="icon" href="/favicon.ico">
  </head>
  <body style="margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: #1e293b; color: white;">
    <div style="max-width: 600px; margin: 0 auto; text-align: center;">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p style="color: #94a3b8;">Redirecting to full page...</p>
      <a href="${escapeHtml(url)}" style="color: #60a5fa; text-decoration: none;">Click here if not redirected automatically</a>
    </div>
  </body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export default async (request: Request) => {
  const userAgent = request.headers.get("user-agent") ?? "";

  // Only intercept for crawlers/bots
  if (!isCrawler(userAgent)) {
    return; // Pass through to normal SPA
  }

  // Extract clubId and workId from URL
  const url = new URL(request.url);
  const pathMatch = url.pathname.match(/\/share\/club\/(\d+)\/review\/(\d+)/);

  if (!pathMatch) {
    return; // Not a matching route
  }

  const [, clubId, workId] = pathMatch;

  try {
    // Fetch review data from the existing API
    const apiUrl = `${url.origin}/api/club/${clubId}/reviews/${workId}/shared`;
    console.log(`[Edge Function] Fetching data from: ${apiUrl}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(
        `[Edge Function] API returned ${response.status}: ${response.statusText}`,
      );
      return; // Pass through on error
    }

    const data = (await response.json()) as ReviewData;

    // Calculate average score
    const scores = data.reviews
      .map((r) => Number(r.score))
      .filter((s) => !isNaN(s) && s > 0);
    const avgScore =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "N/A";

    // Generate OG image URL
    const ogImageUrl = generateOGImageUrl(url.origin, clubId, workId);

    // Construct title and description
    const title = `${data.work.title} - ${data.clubName} Review`;
    const description = `Average Score: ${avgScore}/10 from ${data.reviews.length} ${
      data.reviews.length === 1 ? "rating" : "ratings"
    }`;

    // Generate and return HTML with Open Graph meta tags
    const html = generateHTML({
      title,
      description,
      image: ogImageUrl,
      url: request.url,
      siteName: data.clubName,
    });

    console.log(
      `[Edge Function] Serving OG meta tags for crawler: ${userAgent.substring(0, 50)}`,
    );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("[Edge Function] Error:", error);
    return; // Pass through on error
  }
};
