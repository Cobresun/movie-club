import { isDefined } from "@/../lib/checks/checks";
import { clubTypeDailyGame, dailyGameClubTypes, type DailyGameConfig } from "@/common/clubType";
import { archivePath } from "@/features/daily-game/archive";
import { formatPuzzleDate } from "@/features/daily-game/game";

/** What a search engine or link preview shows for one daily game page. */
export interface PageHead {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  /** schema.org JSON-LD for the page, given its absolute URL. */
  readonly structuredData?: (url: string) => Record<string, unknown>;
}

export function gamePageHead(game: DailyGameConfig): PageHead {
  return {
    path: game.path,
    title: `${game.name}: ${game.headline}`,
    description: game.description,
    structuredData: (url) => ({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: game.name,
      alternateName: game.headline,
      description: game.description,
      url,
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    }),
  };
}

export function archivePageHead(game: DailyGameConfig): PageHead {
  return {
    path: archivePath(game),
    title: `${game.name} archive: play past puzzles`,
    description: `Missed a day of ${game.name}? Every past puzzle is here to play. ${game.tagline}`,
  };
}

export function pastPuzzleTitle(game: DailyGameConfig, date: string): string {
  return `${game.name}: ${formatPuzzleDate(date)}`;
}

/**
 * The daily game pages worth a search result, each served by the build with
 * its own head (`scripts/dailyGamePages.ts`). A past day's puzzle is left out:
 * there is one per day, and the archive links to them all.
 */
export function indexedDailyGamePages(): PageHead[] {
  return dailyGameClubTypes().flatMap((clubType) => {
    const game = clubTypeDailyGame(clubType);
    return isDefined(game) ? [gamePageHead(game), archivePageHead(game)] : [];
  });
}
