# Movie Club — Add from Google

Injects a **"View in MovieClub"** button into Google's movie knowledge panel
(the card shown when you search for a film). Clicking it opens the Movie Club
app at `/add?imdb=<id>&title=<title>&year=<year>`, where the movie is resolved
exactly (via its IMDb id → TMDB) and can be added to a club's Reviews list or
any other list.

The button is a plain link into the app — the script never calls the Movie
Club API from google.com (session cookies are `SameSite=Lax` and the API has
no CORS headers, so that can't work by design). All the real logic lives in
the app's `/add` route (`src/features/add/`).

## Install — Chrome/Edge (unpacked extension)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this `extension/` directory.
3. Google a movie (e.g. "inception movie") — the button appears under the
   title in the knowledge panel.

## Install — Tampermonkey (any desktop browser, Firefox for Android)

Install `movie-club.user.js` in Tampermonkey (drag it in, or open the file's
raw GitHub URL). The file is **generated** — never edit it directly:

```bash
# after changing content.js or userscript-header.txt:
npm run build:userscript
```

`content.js` is the single source of truth shared byte-for-byte by both
packagings. An id guard (`movie-club-add-btn`) keeps the button single even if
both the extension and the userscript are active.

## Pointing the button at a local app

On google.com, run in the DevTools console and reload:

```js
localStorage.setItem("movieClubBaseUrl", "http://localhost:8888");
```

(`localStorage.removeItem("movieClubBaseUrl")` restores production.)

## How detection works

- A movie page is recognized by `[data-attrid^="kc:/film/film"]` modules in
  the knowledge panel — `data-attrid` attributes are Google's most stable DOM
  hooks.
- Title comes from `[data-attrid="title"]`, year from the
  `[data-attrid="subtitle"]` text ("1994 ‧ Crime/Drama ‧ 2h 22m").
- The IMDb id is scraped from the ratings row's `imdb.com/title/tt…` link when
  present; the app falls back to a title+year search without it.
- Panels that hydrate late are caught by a MutationObserver (disconnects after
  success or 15 s). Non-movie searches are a silent no-op.

## Known limitations

- **Google ccTLDs:** match patterns can't wildcard the TLD, so the manifest
  lists `.com` plus a handful of common country domains. If your Google is
  another ccTLD, add it to `manifest.json` (`matches`) and
  `userscript-header.txt` (`@match`), then `npm run build:userscript`.
- **Soft navigations:** if Google swaps results without a full page load, the
  button from the previous movie may linger until refresh.
- **Mobile Chrome/Safari:** no extension support there. The `/add` URL contract
  is designed so future mobile entry points (Android Web Share Target, iOS
  share-sheet Shortcut) work without app changes — see `src/features/add/addLink.ts`.

## Linting

This directory is deliberately **outside** the repo's ESLint/TypeScript
coverage: `content.js` is a plain browser script with different globals, and
wiring a separate typed-lint config for one file isn't worth it. Keep it
small and dependency-free. (`scripts/build-userscript.ts` _is_ covered by the
normal lint/type-check globs.)
