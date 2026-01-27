# Open Graph Link Preview Implementation

This directory contains the implementation for generating rich link previews when sharing movie reviews on social media platforms like Discord, Twitter, Facebook, etc.

## How It Works

### Architecture

1. **Edge Function** (`netlify/edge-functions/shared-review.ts`)
   - Intercepts requests to `/share/club/:clubId/review/:workId`
   - Detects if the request is from a social media crawler (checks User-Agent)
   - For crawlers: Serves pre-rendered HTML with Open Graph meta tags
   - For regular users: Passes through to the Vue SPA

2. **OG Image Generator** (`netlify/functions/og-image.ts`)
   - Generates dynamic Open Graph images
   - For movies with posters: Redirects to TMDB poster image
   - For movies without posters: Generates an SVG image with:
     - Movie title, average score, and rating count
     - Professional gradient background with decorative elements
   - Caches images for performance

### Configuration

The edge function is configured in `netlify.toml`:

```toml
[[edge_functions]]
  path = "/share/club/:clubId/review/:workId"
  function = "shared-review"
```

## Meta Tags Generated

The edge function generates the following Open Graph meta tags:

- `og:title` - Movie title + "Movie Club Review"
- `og:description` - Average score and rating count
- `og:image` - Dynamically generated image from `/api/og-image`
- `og:url` - Canonical URL of the shared review
- `og:type` - "article"
- `og:site_name` - "Movie Club"
- `twitter:card` - "summary_large_image"

## Testing

### Local Testing

You can test the edge function locally with curl:

```bash
# Simulate a Discord bot request
curl -A "Discordbot" http://localhost:8888/share/club/1/review/123

# Test the OG image endpoint directly
curl http://localhost:8888/api/og-image?clubId=1&workId=123 > test.png
```

### Social Media Debuggers

After deploying, test with these tools:

- **Discord**: Just paste the URL in any channel
- **Twitter**: https://cards-dev.twitter.com/validator
- **Facebook**: https://developers.facebook.com/tools/debug/
- **LinkedIn**: https://www.linkedin.com/post-inspector/

### Crawler Detection

The edge function detects the following user agents:

- Twitterbot
- facebookexternalhit
- Discordbot
- Slackbot
- LinkedInBot
- WhatsApp
- TelegramBot
- Generic "bot" and "crawler" strings

## Performance

- **Edge Function**: Runs at CDN edge locations (low latency)
- **OG Images**: Cached indefinitely with `Cache-Control: public, max-age=31536000, immutable`
- **API Data**: Edge function caches HTML responses for 1 hour

## Troubleshooting

### Preview Not Showing

1. Check if the URL is publicly accessible
2. Verify the edge function is deployed (`netlify functions:list`)
3. Test with curl using a crawler user agent
4. Check Netlify function logs for errors

### Image Not Loading

1. Verify the OG image function is deployed
2. Check if TMDB poster path is valid
3. Test the image endpoint directly in a browser
4. Check function logs for errors
5. Verify SVG fallback is working for movies without posters

### Stale Previews

Social media platforms cache previews aggressively. To refresh:

- **Discord**: Add a query parameter (e.g., `?v=2`)
- **Twitter**: Use the card validator to force refresh
- **Facebook**: Use the debug tool's "Scrape Again" button

## Development

To modify the OG image design, edit `netlify/functions/og-image.ts`.

**Current Implementation:**

- Movies with TMDB posters: Redirects to the TMDB poster URL
- Movies without posters: Generates an SVG with title, score, and branding

**Future Enhancements:**
You can enhance the OG images by:

1. Using Cloudinary transformations to overlay text on posters
2. Using an external service like Vercel OG Image
3. Pre-generating images for popular movies

Key customization points in the SVG fallback:

- `width` and `height` (default: 1200x630)
- Background gradient colors
- Text positioning and font sizes
- Decorative elements

To modify what data is shown in previews, edit `netlify/edge-functions/shared-review.ts`.
