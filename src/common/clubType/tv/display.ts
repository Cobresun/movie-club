import type { WorkDisplay } from "../types";
import { asTv, isTvData, tvAirYear } from "./data";
import { isDefined } from "@/../lib/checks/checks";
import { episodeCode } from "@/../lib/types/tv";
import { formatRuntime } from "@/common/workDisplay";

export const tvDisplay: WorkDisplay = {
  subtitle: (data) => {
    const tv = asTv(data);
    if (tv === undefined) return undefined;
    const year = tvAirYear(tv);
    // An episode leads with its code: "S01E04" is how a club refers to it,
    // and the year alone would not distinguish it from its siblings.
    const parts =
      isDefined(tv.seasonNumber) && isDefined(tv.episodeNumber)
        ? [episodeCode(tv.seasonNumber, tv.episodeNumber), year]
        : [year];
    const subtitle = parts.filter(isDefined).join(" · ");
    return subtitle === "" ? undefined : subtitle;
  },
  // An episode's own title ("Half Loop") means nothing away from its season
  // list, so wherever one stands alone it carries its show's name.
  title: (data) => {
    const tv = asTv(data);
    return tv?.level === "episode" ? `${tv.showTitle}: ${tv.title}` : undefined;
  },
  metaLine: (data) => {
    const tv = asTv(data);
    if (tv === undefined) return undefined;
    const parts: string[] = [];
    if (tv.level === "episode" && isDefined(tv.runtime) && tv.runtime > 0) {
      parts.push(formatRuntime(tv.runtime));
    }
    if (tv.level === "show" && isDefined(tv.numberOfSeasons) && tv.numberOfSeasons > 0) {
      parts.push(`${tv.numberOfSeasons} seasons`);
    }
    if (tv.genres.length > 0) parts.push(tv.genres.join(", "));
    return parts.length > 0 ? parts.join(" · ") : undefined;
  },
  overview: (data) => asTv(data)?.overview,
  actors: (details) => (isTvData(details) ? details.actors : undefined),
  noun: (data) => asTv(data)?.level,
};
