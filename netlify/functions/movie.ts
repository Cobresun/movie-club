import { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { Path } from "path-parser";

import { ok } from "./utils/responses";
import { methodNotAllowed } from "./utils/responses";
import { getMovieData } from "./utils/tmdb";
import { StringRecord } from "./utils/types";

export const path = new Path<StringRecord>("/api/movie/:movieId<\\d+>");

/**
 * 
 * GET /movie/:movieId -> returns full movie data
 * 
 */

export async function handler(event: HandlerEvent): Promise<HandlerResponse> {
    if (event.httpMethod === 'GET') {
        const pathArray = event.path.split("/");
        const movieIndex = pathArray.indexOf('movie') + 1;
        const movieId = parseInt(pathArray[movieIndex]);

        if (isNaN(movieId)) {
            return {
                statusCode: 404,
                body: 'Invalid movieId.'
            }
        }

        const movieData = await getMovieData(movieId)

        return ok(JSON.stringify(movieData));
    }
    else {
        return methodNotAllowed();
    }
}
