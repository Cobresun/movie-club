import { hasValue } from "@/../lib/checks/checks";
import {
  type TMDBWatchProvider,
  type TMDBWatchProviderRegion,
  type TMDBWatchProvidersResponse,
} from "@/../lib/types/tmdb";

/**
 * The viewer's country, from their browser locale. There is no fallback to
 * another country: its services would be wrong for the viewer, so a locale
 * without a region shows no availability at all.
 */
export function viewerRegion(): string | undefined {
  if (typeof navigator === "undefined" || !hasValue(navigator.language)) {
    return undefined;
  }
  try {
    return new Intl.Locale(navigator.language).region ?? undefined;
  } catch {
    return undefined;
  }
}

/** A work's availability in the viewer's country, if TMDB has any. */
export function viewerAvailability(
  response: TMDBWatchProvidersResponse | undefined,
): TMDBWatchProviderRegion | undefined {
  const region = viewerRegion();
  return hasValue(region) ? response?.results[region] : undefined;
}

/**
 * The subscription services a work streams on (TMDB's `flatrate` bucket), in
 * TMDB's display order. Free, ad-supported, rent and buy are left out: these
 * are the services you can actually stream the work on.
 */
export function streamingServices(
  availability: TMDBWatchProviderRegion | undefined,
): TMDBWatchProvider[] {
  return [...(availability?.flatrate ?? [])].sort(
    (a, b) => a.display_priority - b.display_priority,
  );
}
