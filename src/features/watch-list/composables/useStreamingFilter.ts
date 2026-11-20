import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";

import { hasValue } from "../../../../lib/checks/checks";
import { type DetailedWorkListItem } from "../../../../lib/types/lists";
import { type ChoiceFilterOption, workWatchProvidersPath } from "@/common/clubType";
import { streamingServices, viewerAvailability, viewerRegion } from "@/common/streamingServices";
import { useWatchProvidersForEach } from "@/service/useTMDB";

const providersPath = (work: DetailedWorkListItem) =>
  workWatchProvidersPath(work.type, work.externalId);

/**
 * A "Streaming on" filter over the viewer's subscription services. Its values
 * come from TMDB, one lookup per distinct work (an episode shares its show's),
 * and nothing is fetched until `active` turns true. A work type with no
 * availability source gives no values, so the filter never shows for it.
 */
export function useStreamingFilter(
  works: MaybeRefOrGetter<DetailedWorkListItem[]>,
  active: MaybeRefOrGetter<boolean>,
): ComputedRef<ChoiceFilterOption> {
  const paths = computed(() =>
    toValue(active) && hasValue(viewerRegion())
      ? [...new Set(toValue(works).map(providersPath).filter(hasValue))]
      : [],
  );

  const results = useWatchProvidersForEach(paths);

  const servicesByPath = computed(
    () =>
      new Map(
        paths.value.map((path, index) => [
          path,
          streamingServices(viewerAvailability(results[index]?.data)).map(
            (service) => service.provider_name,
          ),
        ]),
      ),
  );

  return computed(() => {
    const services = servicesByPath.value;
    return {
      kind: "choice",
      key: "streaming",
      label: "Streaming on",
      icon: "play-circle-outline",
      values: (work) => {
        const path = providersPath(work);
        return hasValue(path) ? (services.get(path) ?? []) : [];
      },
      searchPlaceholder: "Find a service",
      order: "popular",
    };
  });
}
