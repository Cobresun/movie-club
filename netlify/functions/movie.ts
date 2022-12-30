import { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { Path } from "path-parser";
import { ok } from "./utils/responses";
import { methodNotAllowed } from "./utils/responses";
import { StringRecord } from "./utils/types";
import { getTMDBConfig, getTMDBMovieData } from "./utils/tmdb";

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

        const configuration = await getTMDBConfig()
        const movieData = await getTMDBMovieData(movieId)

        movieData.data.poster_url = configuration.data.images.base_url + "w500" + movieData.data.poster_path

        return ok(JSON.stringify(movieData.data));
    }
    else {
        return methodNotAllowed();
    }
}
