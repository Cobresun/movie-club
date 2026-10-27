import type { WorkDisplay } from "../types";
import { asTv, tvAirYear } from "./data";
import { isDefined } from "@/../lib/checks/checks";
import { episodeCode } from "@/../lib/types/tv";
import { formatRuntime } from "@/common/workDisplay";

export const tvDisplay: WorkDisplay = {
  subtitle: (data) => {
    const tv = asTv(data);
    if (tv === undefined) return undefined;
    const year = tvAirYear(tv);
    // An episode's own title ("Half Loop") means nothing away from its season,
    // so wherever one is shown on its own it carries its show and its code.
    const parts =
      isDefined(tv.seasonNumber) && isDefined(tv.episodeNumber)
        ? [tv.showTitle, episodeCode(tv.seasonNumber, tv.episodeNumber), year]
        : [year];
    const subtitle = parts.filter(isDefined).join(" · ");
    return subtitle === "" ? undefined : subtitle;
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
  noun: (data) => asTv(data)?.level,
};
