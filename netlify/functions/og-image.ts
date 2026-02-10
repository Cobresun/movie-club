import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import SharedReviewService from "./services/SharedReviewService";
import { badRequest, redirect, svg } from "./utils/responses";
import { Router } from "./utils/router";

const router = new Router("/api/og-image");

router.get("/", async ({ event }, res) => {
  try {
    const { clubId, workId } = event.queryStringParameters ?? {};

    if (clubId === undefined || workId === undefined) {
      return res(badRequest("Missing required parameters: clubId and workId"));
    }

    // Fetch review data using the shared service
    const reviewData = await SharedReviewService.getSharedReviewData(
      clubId,
      workId,
    );

    if (!reviewData) {
      console.error("Failed to fetch review data: work not found");
      return res(generateFallbackSVG("Movie Review", "N/A", 0));
    }

    const movieTitle = reviewData.work.title;
    const scores = reviewData.reviews
      .map((r) => Number(r.score))
      .filter((s) => !isNaN(s) && s > 0);
    const avgScore =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "N/A";
    const reviewCount = reviewData.reviews.length;

    const posterPath = reviewData.work.externalData?.poster_path;

    if (posterPath !== undefined) {
      const tmdbPosterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      return res(redirect(tmdbPosterUrl));
    }

    return res(generateFallbackSVG(movieTitle, avgScore, reviewCount));
  } catch (error) {
    console.error("Error generating OG image:", error);
    return res(generateFallbackSVG("Movie Club", "N/A", 0));
  }
});

/**
 * Generate a simple SVG image as fallback
 */
function generateFallbackSVG(title: string, score: string, count: number) {
  const truncatedTitle =
    title.length > 40 ? title.substring(0, 37) + "..." : title;

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#grad)"/>
  
  <!-- Decorative Elements -->
  <circle cx="100" cy="100" r="40" fill="#fbbf24" opacity="0.1"/>
  <circle cx="1100" cy="530" r="60" fill="#fbbf24" opacity="0.1"/>
  
  <!-- Title -->
  <text x="100" y="180" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="bold" fill="#ffffff">
    ${escapeXml(truncatedTitle)}
  </text>
  
  <!-- Score -->
  <text x="100" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="120" font-weight="bold" fill="#fbbf24">
    ${escapeXml(score)}
  </text>
  <text x="${100 + score.length * 70}" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="60" font-weight="bold" fill="#94a3b8">
    /10
  </text>
  
  <!-- Rating Count -->
  <text x="100" y="410" font-family="system-ui, -apple-system, sans-serif" font-size="36" fill="#cbd5e1">
    from ${count} ${count === 1 ? "rating" : "ratings"}
  </text>
  
  <!-- Branding -->
  <text x="100" y="570" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="bold" fill="#64748b" letter-spacing="2">
    MOVIE CLUB
  </text>
  
  <!-- Star Icon -->
  <path d="M 1050 100 L 1070 150 L 1125 150 L 1080 185 L 1100 240 L 1050 205 L 1000 240 L 1020 185 L 975 150 L 1030 150 Z" fill="#fbbf24" opacity="0.3"/>
</svg>`;

  return svg(svgContent);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context, params: {} });
};

export { handler };
