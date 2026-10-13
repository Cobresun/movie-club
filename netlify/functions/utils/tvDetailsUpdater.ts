import { Kysely, Transaction } from "kysely";

import { hasValue } from "../../../lib/checks/checks.js";
import { DB } from "../../../lib/types/generated/db";
import { formatTvAddress, TMDBTvSeasonData, TMDBTvShowData } from "../../../lib/types/tv";

type Db = Kysely<DB> | Transaction<DB>;

function toDate(value: string | undefined): Date | null {
  return hasValue(value) ? new Date(value) : null;
}

/**
 * Cache a show and its season list. Upserts rather than doing nothing on
 * conflict, so the scheduled refresh reuses this path to pick up a currently
 * airing show's new seasons and episode counts.
 */
export async function upsertTvShowDetails(showId: string, data: TMDBTvShowData, dbOrTrx: Db) {
  const showValues = {
    name: data.name,
    overview: data.overview,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    first_air_date: toDate(data.first_air_date),
    last_air_date: toDate(data.last_air_date),
    status: data.status,
    number_of_seasons: data.number_of_seasons,
    number_of_episodes: data.number_of_episodes,
    original_language: data.original_language,
    tmdb_score: data.vote_average,
  };

  await dbOrTrx
    .insertInto("tv_show_details")
    .values({ external_id: showId, ...showValues })
    .onConflict((oc) =>
      oc.column("external_id").doUpdateSet({ ...showValues, updated_date: new Date() }),
    )
    .execute();

  const junctionInserts: Promise<unknown>[] = [];

  const genres = data.genres ?? [];
  if (genres.length > 0) {
    junctionInserts.push(
      dbOrTrx
        .insertInto("tv_show_genres")
        .values(genres.map((genre) => ({ external_id: showId, genre_name: genre.name })))
        .onConflict((oc) => oc.columns(["external_id", "genre_name"]).doNothing())
        .execute(),
    );
  }

  const creators = data.created_by ?? [];
  if (creators.length > 0) {
    junctionInserts.push(
      dbOrTrx
        .insertInto("tv_show_creators")
        .values(
          creators.map((creator) => ({
            external_id: showId,
            creator_name: creator.name,
            profile_path: creator.profile_path,
          })),
        )
        .onConflict((oc) => oc.columns(["external_id", "creator_name"]).doNothing())
        .execute(),
    );
  }

  const networks = data.networks ?? [];
  if (networks.length > 0) {
    junctionInserts.push(
      dbOrTrx
        .insertInto("tv_show_networks")
        .values(
          networks.map((network) => ({
            external_id: showId,
            network_name: network.name,
            logo_path: network.logo_path,
          })),
        )
        .onConflict((oc) => oc.columns(["external_id", "network_name"]).doNothing())
        .execute(),
    );
  }

  const cast = data.aggregate_credits?.cast ?? [];
  if (cast.length > 0) {
    junctionInserts.push(
      dbOrTrx
        .insertInto("tv_show_cast")
        .values(
          cast.map((member) => ({
            external_id: showId,
            actor_id: member.id,
            actor_name: member.name,
            character_name: member.roles?.[0]?.character ?? null,
            cast_order: member.order,
            profile_path: member.profile_path,
            popularity: member.popularity,
          })),
        )
        .onConflict((oc) => oc.columns(["external_id", "actor_id"]).doNothing())
        .execute(),
    );
  }

  // TMDB's season 0 is specials — recaps, webisodes and Christmas episodes the
  // club did not sit down to watch. It is cached so a club can reach it
  // deliberately, but never filled by a show-level score (see tvProvider).
  const seasons = data.seasons ?? [];
  if (seasons.length > 0) {
    junctionInserts.push(
      Promise.all(
        seasons.map((season) => {
          const seasonValues = {
            show_external_id: showId,
            season_number: season.season_number,
            name: season.name,
            overview: season.overview,
            poster_path: season.poster_path,
            air_date: toDate(season.air_date),
            episode_count: season.episode_count ?? 0,
          };
          return dbOrTrx
            .insertInto("tv_season_details")
            .values({
              external_id: formatTvAddress({
                showId,
                seasonNumber: season.season_number,
              }),
              ...seasonValues,
            })
            .onConflict((oc) =>
              oc.column("external_id").doUpdateSet({ ...seasonValues, updated_date: new Date() }),
            )
            .execute();
        }),
      ),
    );
  }

  await Promise.all(junctionInserts);
}

/**
 * Cache every episode TMDB lists for one season. The season row is upserted
 * alongside so its `episode_count` matches the episodes actually stored — a
 * currently airing season's count moves, and coverage counts read from it.
 */
export async function upsertTvSeasonDetails(showId: string, data: TMDBTvSeasonData, dbOrTrx: Db) {
  const seasonId = formatTvAddress({ showId, seasonNumber: data.season_number });
  const episodes = data.episodes ?? [];

  const seasonValues = {
    show_external_id: showId,
    season_number: data.season_number,
    name: data.name,
    overview: data.overview,
    poster_path: data.poster_path,
    air_date: toDate(data.air_date),
    episode_count: episodes.length,
  };

  await dbOrTrx
    .insertInto("tv_season_details")
    .values({ external_id: seasonId, ...seasonValues })
    .onConflict((oc) =>
      oc.column("external_id").doUpdateSet({ ...seasonValues, updated_date: new Date() }),
    )
    .execute();

  if (episodes.length === 0) return;

  await dbOrTrx
    .insertInto("tv_episode_details")
    .values(
      episodes.map((episode) => ({
        external_id: formatTvAddress({
          showId,
          seasonNumber: data.season_number,
          episodeNumber: episode.episode_number,
        }),
        show_external_id: showId,
        season_external_id: seasonId,
        season_number: data.season_number,
        episode_number: episode.episode_number,
        name: episode.name,
        overview: episode.overview,
        still_path: episode.still_path,
        air_date: toDate(episode.air_date),
        runtime: episode.runtime,
        tmdb_score: episode.vote_average,
      })),
    )
    .onConflict((oc) =>
      oc.column("external_id").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        overview: eb.ref("excluded.overview"),
        still_path: eb.ref("excluded.still_path"),
        air_date: eb.ref("excluded.air_date"),
        runtime: eb.ref("excluded.runtime"),
        tmdb_score: eb.ref("excluded.tmdb_score"),
        updated_date: new Date(),
      })),
    )
    .execute();
}
