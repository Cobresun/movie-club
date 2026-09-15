import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkData, ListInsertDto, WorkDataSummary } from "../../../../lib/types/lists";
import { MovieCastMember } from "../../../../lib/types/movie";
import {
  DetailedTvData,
  episodeCode,
  formatTvAddress,
  parseTvAddress,
  TvAddress,
  TvDataSummary,
  TvLevel,
  tvLevel,
  TvSeasonSummary,
} from "../../../../lib/types/tv";
import { db } from "../database";
import { getTMDBTvSeason, getTMDBTvShowData } from "../tmdb";
import { upsertTvSeasonDetails, upsertTvShowDetails } from "../tvDetailsUpdater";
import { MediaProvider, numOrUndefined, RefreshResult, ScoreTarget } from "./types";

/** TMDB's season 0 holds specials, which the show's season list leaves out. */
const SPECIALS_SEASON = "0";

/**
 * Show-level metadata plus its junction aggregates. Seasons and episodes read
 * from this too — genres, creators, networks and cast belong to the series,
 * not to any one episode of it.
 */
function showQuery(showIds: string[]) {
  return db
    .with("genres_agg", (qb) =>
      qb
        .selectFrom("tv_show_genres")
        .select(["external_id", db.fn.agg<string[]>("array_agg", ["genre_name"]).as("genres")])
        .groupBy("external_id"),
    )
    .with("creators_agg", (qb) =>
      qb
        .selectFrom("tv_show_creators")
        .select((eb) => [
          "external_id",
          eb.fn.agg<string[]>("array_agg", ["creator_name"]).as("creators"),
        ])
        .groupBy("external_id"),
    )
    .with("networks_agg", (qb) =>
      qb
        .selectFrom("tv_show_networks")
        .select((eb) => [
          "external_id",
          eb.fn.agg<string[]>("array_agg", ["network_name"]).as("networks"),
        ])
        .groupBy("external_id"),
    )
    .with("cast_names_agg", (qb) =>
      qb
        .selectFrom("tv_show_cast")
        .select((eb) => [
          "external_id",
          eb.fn.agg<string[]>("array_agg", ["actor_name"]).orderBy("cast_order").as("cast_names"),
        ])
        .groupBy("external_id"),
    )
    .selectFrom("tv_show_details")
    .where("tv_show_details.external_id", "in", showIds)
    .leftJoin("genres_agg", "genres_agg.external_id", "tv_show_details.external_id")
    .leftJoin("creators_agg", "creators_agg.external_id", "tv_show_details.external_id")
    .leftJoin("networks_agg", "networks_agg.external_id", "tv_show_details.external_id")
    .leftJoin("cast_names_agg", "cast_names_agg.external_id", "tv_show_details.external_id")
    .select([
      "tv_show_details.external_id",
      "tv_show_details.name",
      "tv_show_details.overview",
      "tv_show_details.poster_path",
      "tv_show_details.backdrop_path",
      "tv_show_details.first_air_date",
      "tv_show_details.status",
      "tv_show_details.original_language",
      "tv_show_details.number_of_seasons",
      "tv_show_details.number_of_episodes",
      "tv_show_details.tmdb_score",
      "genres_agg.genres",
      "creators_agg.creators",
      "networks_agg.networks",
      "cast_names_agg.cast_names",
    ]);
}

type ShowRow = Awaited<ReturnType<ReturnType<typeof showQuery>["execute"]>>[number];

interface ShowContext {
  showTitle: string;
  genres: string[];
  creators: string[];
  networks: string[];
  castNames: string[];
  row: ShowRow;
}

function showContext(row: ShowRow): ShowContext {
  return {
    showTitle: row.name ?? "Untitled",
    genres: row.genres?.filter(Boolean) ?? [],
    creators: row.creators?.filter(Boolean) ?? [],
    networks: row.networks?.filter(Boolean) ?? [],
    castNames: row.cast_names?.filter(Boolean) ?? [],
    row,
  };
}

/** The fields every level shares, so a season or episode still filters and
 * searches by the series it belongs to. */
function seriesFields(context: ShowContext) {
  return {
    kind: "tv" as const,
    showId: context.row.external_id,
    showTitle: context.showTitle,
    genres: context.genres,
    creators: context.creators,
    networks: context.networks,
    castNames: context.castNames,
  };
}

function toShowSummary(context: ShowContext): TvDataSummary {
  const row = context.row;
  return {
    ...seriesFields(context),
    level: "show",
    title: context.showTitle,
    overview: row.overview ?? undefined,
    posterPath: row.poster_path ?? undefined,
    backdropPath: row.backdrop_path ?? undefined,
    airDate: row.first_air_date?.toISOString(),
    status: row.status ?? undefined,
    originalLanguage: row.original_language ?? undefined,
    numberOfSeasons: numOrUndefined(row.number_of_seasons),
    numberOfEpisodes: numOrUndefined(row.number_of_episodes),
    voteAverage: numOrUndefined(row.tmdb_score),
  };
}

const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w300";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w154";

/** What a discussion prompt calls the work, at each level a club can score. */
const TV_PROMPT_UNIT: Record<TvLevel, string> = {
  show: "series",
  season: "season",
  episode: "episode",
};

/** `Severance S01E04 "The You You Are"`, `Severance, Season 1`, or the show. */
function promptLabel(address: TvAddress, showTitle: string, title: string): string {
  if (address.seasonNumber === undefined) return title;
  if (address.episodeNumber === undefined) return `${showTitle}, ${title}`;
  return `${showTitle} ${episodeCode(address.seasonNumber, address.episodeNumber)} "${title}"`;
}

function stillUrl(stillPath: string): string {
  return `${TMDB_STILL_BASE}${stillPath}`;
}

class TvProvider implements MediaProvider {
  readonly type = WorkType.tv;

  /**
   * Cache what the address needs: a show pulls its own details and season
   * list, a season or episode also pulls that season's episodes. Safe to call
   * on a work whose details already exist — every write upserts.
   */
  async fetchAndCacheDetails(externalId: string): Promise<void> {
    const address = parseTvAddress(externalId);
    if (address === undefined) return;

    await this.cacheShow(address.showId);
    if (address.seasonNumber !== undefined) {
      await this.cacheSeason(address.showId, address.seasonNumber);
    }
  }

  async getExternalData(externalIds: string[]): Promise<Map<string, DetailedWorkData>> {
    const map = new Map<string, DetailedWorkData>();
    if (externalIds.length === 0) return map;

    const [summaries, casts] = await Promise.all([
      this.getExternalDataSummary(externalIds),
      this.getCast(externalIds),
    ]);
    for (const [externalId, summary] of summaries) {
      if (summary.kind !== "tv") continue;
      const detailed: DetailedTvData = { ...summary, actors: casts.get(externalId) ?? [] };
      map.set(externalId, detailed);
    }
    return map;
  }

  async getExternalDataSummary(externalIds: string[]): Promise<Map<string, WorkDataSummary>> {
    const map = new Map<string, WorkDataSummary>();
    if (externalIds.length === 0) return map;

    const addresses = new Map<string, TvAddress>();
    for (const externalId of externalIds) {
      const address = parseTvAddress(externalId);
      if (isDefined(address)) addresses.set(externalId, address);
    }
    if (addresses.size === 0) return map;

    const showIds = [...new Set([...addresses.values()].map((address) => address.showId))];
    const seasonIds: string[] = [];
    const episodeIds: string[] = [];
    for (const [externalId, address] of addresses) {
      const level = tvLevel(address);
      if (level === "season") seasonIds.push(externalId);
      if (level === "episode") episodeIds.push(externalId);
    }

    const wantsShow = [...addresses.values()].some((address) => tvLevel(address) === "show");

    const [showRows, showSeasonRows, seasonRows, episodeRows] = await Promise.all([
      showQuery(showIds).execute(),
      !wantsShow
        ? []
        : db
            .selectFrom("tv_season_details")
            .where("show_external_id", "in", showIds)
            .where("season_number", "!=", SPECIALS_SEASON)
            .select([
              "show_external_id",
              "season_number",
              "name",
              "episode_count",
              "poster_path",
              "air_date",
            ])
            .orderBy("season_number")
            .execute(),
      seasonIds.length === 0
        ? []
        : db
            .selectFrom("tv_season_details")
            .where("external_id", "in", seasonIds)
            .selectAll()
            .execute(),
      episodeIds.length === 0
        ? []
        : db
            .selectFrom("tv_episode_details")
            .where("external_id", "in", episodeIds)
            .selectAll()
            .execute(),
    ]);

    const contexts = new Map<string, ShowContext>();
    for (const row of showRows) contexts.set(row.external_id, showContext(row));

    const seasonsByShow = new Map<string, TvSeasonSummary[]>();
    for (const row of showSeasonRows) {
      const seasons = seasonsByShow.get(row.show_external_id) ?? [];
      seasons.push({
        seasonNumber: Number(row.season_number),
        name: row.name ?? `Season ${row.season_number}`,
        episodeCount: Number(row.episode_count),
        posterPath: row.poster_path ?? undefined,
        airDate: row.air_date?.toISOString(),
      });
      seasonsByShow.set(row.show_external_id, seasons);
    }

    for (const [externalId, address] of addresses) {
      const context = contexts.get(address.showId);
      if (context === undefined) continue;
      if (tvLevel(address) === "show") {
        map.set(externalId, {
          ...toShowSummary(context),
          seasons: seasonsByShow.get(address.showId) ?? [],
        });
      }
    }

    for (const row of seasonRows) {
      const context = contexts.get(row.show_external_id);
      if (context === undefined) continue;
      map.set(row.external_id, {
        ...seriesFields(context),
        level: "season",
        seasonNumber: Number(row.season_number),
        title: row.name ?? `Season ${row.season_number}`,
        overview: row.overview ?? undefined,
        posterPath: row.poster_path ?? context.row.poster_path ?? undefined,
        airDate: row.air_date?.toISOString(),
        episodeCount: Number(row.episode_count),
      });
    }

    for (const row of episodeRows) {
      const context = contexts.get(row.show_external_id);
      if (context === undefined) continue;
      map.set(row.external_id, {
        ...seriesFields(context),
        level: "episode",
        seasonNumber: Number(row.season_number),
        episodeNumber: Number(row.episode_number),
        title: row.name ?? episodeCode(Number(row.season_number), Number(row.episode_number)),
        overview: row.overview ?? undefined,
        posterPath: context.row.poster_path ?? undefined,
        stillPath: row.still_path ?? undefined,
        airDate: row.air_date?.toISOString(),
        runtime: numOrUndefined(row.runtime),
        voteAverage: numOrUndefined(row.tmdb_score),
      });
    }

    return map;
  }

  /** The show's recurring cast, keyed by whichever work asked for it — an
   * episode's leaderboard entry is its series' cast. */
  async getCast(externalIds: string[]): Promise<Map<string, MovieCastMember[]>> {
    const map = new Map<string, MovieCastMember[]>();
    if (externalIds.length === 0) return map;

    const addresses = new Map<string, TvAddress>();
    for (const externalId of externalIds) {
      const address = parseTvAddress(externalId);
      if (isDefined(address)) addresses.set(externalId, address);
    }
    if (addresses.size === 0) return map;

    const showIds = [...new Set([...addresses.values()].map((address) => address.showId))];
    const rows = await db
      .selectFrom("tv_show_cast")
      .where("external_id", "in", showIds)
      .select(["external_id", "actor_name", "character_name", "profile_path"])
      .orderBy("external_id")
      .orderBy("cast_order")
      .execute();

    const byShow = new Map<string, MovieCastMember[]>();
    for (const row of rows) {
      const cast = byShow.get(row.external_id) ?? [];
      cast.push({
        name: row.actor_name,
        character: row.character_name,
        profilePath: row.profile_path,
      });
      byShow.set(row.external_id, cast);
    }

    for (const [externalId, address] of addresses) {
      const cast = byShow.get(address.showId);
      if (isDefined(cast)) map.set(externalId, cast);
    }
    return map;
  }

  /**
   * Every level is scored on its own: a score on the show stays on the show,
   * one on a season stays on that season, and neither is ever written down to
   * the episodes beneath it.
   *
   * `seasonNumber` narrows a show to one of its seasons, and `episodeNumber`
   * narrows that season to one episode — how a club scores a season or an
   * episode before it exists as a work. The numbers are the only thing the
   * caller chooses: whether TMDB lists that season or episode, and what it is
   * called, is read from the server's own cached TMDB data.
   */
  async resolveScoreTarget(
    work: { externalId: string | null },
    options: { seasonNumber?: number; episodeNumber?: number },
  ): Promise<ScoreTarget> {
    const address = parseTvAddress(work.externalId);
    if (address === undefined) return { kind: "self" };

    const seasonNumber = address.seasonNumber ?? options.seasonNumber;
    const target: TvAddress = {
      showId: address.showId,
      seasonNumber,
      episodeNumber:
        address.episodeNumber ?? (seasonNumber === undefined ? undefined : options.episodeNumber),
    };
    if (tvLevel(target) === tvLevel(address)) return { kind: "self" };

    const targetWork =
      tvLevel(target) === "season" ? await this.seasonWork(target) : await this.episodeWork(target);
    return targetWork === undefined ? { kind: "missing" } : { kind: "work", work: targetWork };
  }

  private async seasonWork(address: TvAddress): Promise<ListInsertDto | undefined> {
    const externalId = formatTvAddress(address);
    const row = await db
      .selectFrom("tv_season_details")
      .where("external_id", "=", externalId)
      .select(["name", "season_number", "poster_path"])
      .executeTakeFirst();
    if (row === undefined) return undefined;
    return {
      type: WorkType.tv,
      title: row.name ?? `Season ${row.season_number}`,
      externalId,
      imageUrl: hasValue(row.poster_path) ? `${TMDB_POSTER_BASE}${row.poster_path}` : undefined,
    };
  }

  private async episodeWork(address: TvAddress): Promise<ListInsertDto | undefined> {
    if (address.seasonNumber === undefined) return undefined;
    // The season may never have been opened, so its episodes are not cached
    // yet — scoring one of them is exactly the moment they have to exist.
    await this.cacheSeason(address.showId, address.seasonNumber);

    const externalId = formatTvAddress(address);
    const row = await db
      .selectFrom("tv_episode_details")
      .where("external_id", "=", externalId)
      .select(["name", "season_number", "episode_number", "still_path"])
      .executeTakeFirst();
    if (row === undefined) return undefined;
    return {
      type: WorkType.tv,
      title: row.name ?? episodeCode(Number(row.season_number), Number(row.episode_number)),
      externalId,
      imageUrl: hasValue(row.still_path) ? stillUrl(row.still_path) : undefined,
    };
  }

  async getDiscussionPrompt(work: { title: string; externalId: string | null }): Promise<string> {
    const address = parseTvAddress(work.externalId);
    if (address === undefined) {
      return `Generate 3 to 5 discussion prompts for a TV club that just watched "${work.title}".`;
    }

    const summaries = await this.getExternalDataSummary([formatTvAddress(address)]);
    const data = summaries.get(formatTvAddress(address));
    const summary = data?.kind === "tv" ? data : undefined;

    const label = promptLabel(
      address,
      summary?.showTitle ?? work.title,
      summary?.title ?? work.title,
    );
    const unit = TV_PROMPT_UNIT[tvLevel(address)];
    const premise = hasValue(summary?.overview) ? `\n\nWhat happens: ${summary.overview}` : "";

    return `Generate 3 to 5 discussion prompts for a TV club that just watched ${label}.${premise}

Every prompt must be specific to THIS ${unit} — naming its actual characters, scenes, lines, or moments — never a generic question that could apply to any ${unit} of television. Prompts may draw on what the series has established so far, but must never reference anything that happens after this ${unit}: the club is watching in order, and a prompt that spoils what comes later ruins the watch.

Order the prompts by depth: the first should be casual and easy to answer — a low-stakes entry point. Each subsequent prompt should be more thought-provoking than the last, with the final one being substantial.

Whenever the ${unit} supports it, frame prompts as debates: questions with defensible answers on more than one side, designed to spark disagreement among friends rather than consensus. Keep each prompt succinct — one clear, concise question with no preamble.

If you do not recognize this series or cannot confirm it is real, return 0 questions.`;
  }

  /**
   * Refreshes the stalest shows and every season of theirs the club has
   * already opened. Re-reading the season is what picks up a currently airing
   * show's new episodes, so a season the club finished mid-run reopens with a
   * larger denominator rather than silently staying at 9/9.
   */
  async refreshStaleDetails(limit: number): Promise<RefreshResult> {
    const stale = await db
      .selectFrom("tv_show_details")
      .select("external_id")
      .orderBy("updated_date", "asc")
      .limit(limit)
      .execute();

    const result: RefreshResult = { processed: 0, updated: 0, errors: [] };
    for (const { external_id } of stale) {
      result.processed++;
      try {
        const { data } = await getTMDBTvShowData(Number.parseInt(external_id, 10));
        await db.transaction().execute((trx) => upsertTvShowDetails(external_id, data, trx));

        const cachedSeasons = await db
          .selectFrom("tv_episode_details")
          .where("show_external_id", "=", external_id)
          .select("season_number")
          .distinct()
          .execute();
        for (const { season_number } of cachedSeasons) {
          await this.cacheSeason(external_id, Number(season_number), { force: true });
        }
        result.updated++;
      } catch (error) {
        result.errors.push({
          externalId: external_id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return result;
  }

  private async cacheShow(showId: string): Promise<void> {
    const cached = await db
      .selectFrom("tv_show_details")
      .select("external_id")
      .where("external_id", "=", showId)
      .executeTakeFirst();
    if (isDefined(cached)) return;

    const { data } = await getTMDBTvShowData(Number.parseInt(showId, 10));
    await db.transaction().execute((trx) => upsertTvShowDetails(showId, data, trx));
  }

  private async cacheSeason(
    showId: string,
    seasonNumber: number,
    options?: { force: boolean },
  ): Promise<void> {
    if (options?.force !== true) {
      const cached = await db
        .selectFrom("tv_episode_details")
        .select("external_id")
        .where("season_external_id", "=", formatTvAddress({ showId, seasonNumber }))
        .executeTakeFirst();
      if (isDefined(cached)) return;
    }

    const { data } = await getTMDBTvSeason(Number.parseInt(showId, 10), seasonNumber);
    await db.transaction().execute((trx) => upsertTvSeasonDetails(showId, data, trx));
  }
}

export default new TvProvider();
