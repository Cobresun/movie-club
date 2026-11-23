import { http, HttpResponse } from "msw";

import { type Gif } from "@/service/useGiphy";

/**
 * GIPHY's trending and search endpoints over a fixed set of GIFs. A search
 * matches on title, as a stand-in for GIPHY's own ranking.
 */
export const giphyApi = (gifs: Gif[]) => [
  http.get("https://api.giphy.com/v1/gifs/trending", () =>
    HttpResponse.json<{ data: Gif[] }>({ data: gifs }),
  ),
  http.get("https://api.giphy.com/v1/gifs/search", ({ request }) => {
    const query = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
    return HttpResponse.json<{ data: Gif[] }>({
      data: gifs.filter((gif) => gif.title.toLowerCase().includes(query)),
    });
  }),
];
