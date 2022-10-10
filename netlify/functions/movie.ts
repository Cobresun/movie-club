import axios from "axios";
import {
    HandlerEvent,
    HandlerContext,
    HandlerResponse,
  } from "@netlify/functions";
import { Path } from "path-parser";
import { ok } from "./utils/responses";
import { methodNotAllowed } from "./utils/responses";
import { StringRecord } from "./utils/types";

export const path = new Path<StringRecord>("/api/movie/:movieId<\\d+>");

const tmdbApiKey = process.env.TMDB_API_KEY

/**
 * 
 * GET /movie/:movieId -> returns full movie data
 * 
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
//exports.handler = async function(event, _context) {
export async function handler(
    event: HandlerEvent,
    context: HandlerContext
    ): Promise<HandlerResponse> {
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

            let configuration = await getConfiguration()

            let movieData = await getMovieData(movieId)

            movieData.data.poster_url = configuration.data.images.base_url + "w500" + movieData.data.poster_path

            return ok(JSON.stringify(movieData.data));
        }
        else {
            return methodNotAllowed();
        }
}

async function getConfiguration() {
    return axios
        .get(`https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`)
}

async function getMovieData(movieId: number) {
    return axios
        .get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`)
}