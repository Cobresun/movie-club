import { ref, watch } from "vue";
import { z } from "zod";

/**
 * Tracks which lists the user has collapsed on a given club's lists page.
 * Persists to localStorage so state survives reloads. Keyed per-club so
 * collapsing Backlog on club A doesn't collapse it on club B.
 */
export function useCollapsedLists(clubSlug: string) {
  const storageKey = `movieclub:collapsedLists:${clubSlug}`;

  const initial = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return new Set<string>();
      const result = z.array(z.string()).safeParse(JSON.parse(raw));
      return result.success ? new Set(result.data) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  })();

  const collapsed = ref<Set<string>>(initial);

  watch(
    collapsed,
    (next) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // localStorage unavailable (private mode, quota) — silently drop.
      }
    },
    { deep: true },
  );

  const isCollapsed = (id: string) => collapsed.value.has(id);
  const toggle = (id: string) => {
    const next = new Set(collapsed.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed.value = next;
  };

  return { isCollapsed, toggle };
}
