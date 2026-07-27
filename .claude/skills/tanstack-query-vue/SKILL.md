---
name: tanstack-query-vue
description: TanStack Query (Vue Query) v4 patterns for data fetching, caching, mutations, and optimistic updates. Use for any work involving service composables, query keys, or server state management.
---

# TanStack Query (Vue Query) v4 — Project Reference

**Version:** `@tanstack/vue-query` v4 (NOT v5 — API differs significantly).

**Always consult [tanstack.com/query/v4/docs](https://tanstack.com/query/v4/docs) for full API reference.**

---

## Query Client Configuration

Configured in `src/main.ts`. Key defaults:

- `refetchOnWindowFocus: false`
- `cacheTime`: 1 week
- `refetchOnMount`: custom — always refetches an invalidated query, otherwise counts fetches per query hash in an in-memory map and stops refetching after the first couple of mounts
- **Persistence:** IndexedDB (`idb-keyval` behind `createAsyncStoragePersister`), 1-week maxAge. Deliberately **not** localStorage: no ~5MB quota to silently blow past on a large club's cached lists, and no synchronous main-thread serialization
- **User queries excluded from persistence:** `shouldDehydrateQuery` filters out `queryKey[0] === "user"`

The persister and that in-memory map are one mechanism: the map is empty on every page load, so a hard refresh paints instantly from IndexedDB and then revalidates in the background, while navigation within the session stays quiet. A fixed `staleTime` can't express that — it can't distinguish a remount from a reload.

---

## Query Key Convention

Always use **string arrays** (not objects). Patterns:

| Pattern                   | Example                          | Used for           |
| ------------------------- | -------------------------------- | ------------------ |
| `[resource, id]`          | `["club", clubSlug]`             | Single resource    |
| `[resource, id, sub]`     | `["club", clubSlug, "settings"]` | Nested resource    |
| `[resource, id, subId]`   | `["list", clubSlug, listId]`     | Sub-resource by id |
| `[domain, action, param]` | `["tmdb", "search", query]`      | External API       |

`src/service/useList.ts` exports key factories — `clubListsKey`, `listKey`, `reviewsListKey`, `workDetailsKey`. Call those instead of re-typing the array; a mutation that invalidates a hand-written key that has drifted fails silently.

Prefix matching for invalidation: `invalidateQueries(["club"])` invalidates all queries starting with `"club"`.

---

## useQuery Patterns

**Standard query:**

```typescript
export function useClub(clubSlug: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club", clubSlug],
    queryFn: async () => await fetchClub(clubSlug),
  });
}
```

**Conditional fetching with `enabled`:**

```typescript
export function useUserClubs() {
  const auth = useAuthStore();
  const isLoggedIn = computed(() => auth.isLoggedIn);
  return useQuery<ClubPreview[]>({
    queryKey: ["user", "clubs"],
    enabled: isLoggedIn,
    queryFn: async () => (await auth.request.get<ClubPreview[]>("/api/member/clubs")).data,
  });
}
```

**Reactive query keys with Refs** — query auto-refetches when Ref values change:

```typescript
export function useAwards(clubId: Ref<string>, year: Ref<string>) {
  return useQuery({ queryKey: ["awards", clubId, year], queryFn: ... });
}
```

**`MaybeRef` ids** — take the id as `MaybeRef<string>`, unwrap it into a `computed`, build the key from a `computed`, and guard the empty case with `enabled` so the query doesn't fire against a not-yet-resolved id:

```typescript
export function useList(
  clubSlug: string,
  listId: MaybeRef<string>,
): UseQueryReturnType<DetailedWorkListItem[], AxiosError> {
  const listIdRef = computed(() => unref(listId));
  return useQuery({
    queryKey: computed(() => listKey(clubSlug, listIdRef.value)),
    queryFn: async () => (await axios.get(`/api/club/${clubSlug}/list/${listIdRef.value}`)).data,
    enabled: () => listIdRef.value !== "",
  });
}
```

This matters where an id is itself fetched — a list view resolving `reviewsListId` through `useReviewsListId` first. Callers pass either a plain string or a ref and get the same composable.

---

## useMutation Patterns

### Pattern 1: Simple invalidation (most common)

```typescript
export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (...) => auth.request.post(`/api/club`, body),
    onSuccess: () => {
      queryClient.invalidateQueries(["user", "clubs"]).catch(console.error);
    },
  });
}
```

### Pattern 2: Optimistic update + settle refetch

```typescript
return useMutation({
  mutationFn: ({ workId, score }) => auth.request.post(...),
  onMutate: ({ workId, score }) => {
    queryClient.setQueryData<DetailedReviewListItem[]>(reviewsListKey(clubSlug), (current) =>
      current?.map(item => item.id === workId ? { ...item, updatedField } : item),
    );
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: reviewsListKey(clubSlug) }),
});
```

### Pattern 3: Full rollback (cancel + snapshot + restore on error)

```typescript
return useMutation({
  mutationFn: (newSettings) => auth.request.post(...),
  onMutate: async (newSettings) => {
    await queryClient.cancelQueries(["club", clubSlug, "settings"]);
    const previous = queryClient.getQueryData<ClubSettings>(["club", clubSlug, "settings"]);
    if (previous) {
      queryClient.setQueryData<ClubSettings>(["club", clubSlug, "settings"], { ...previous, ...newSettings });
    }
    return { previous };
  },
  onError: (_error, _variables, context) => {
    if (context?.previous) {
      queryClient.setQueryData(["club", clubSlug, "settings"], context.previous);
    }
  },
  onSettled: () => queryClient.invalidateQueries(["club", clubSlug, "settings"]).catch(console.error),
});
```

---

## Conventions

- **Naming:** `use[Resource]` for queries, `use[Action][Resource]` for mutations (e.g., `useCreateClub`, `useDeleteListItem`)
- **Always** provide generic type parameter: `useQuery<ReturnType>(...)`, `useQuery<ReturnType, AxiosError>(...)`
- **Always** `.catch(console.error)` on `invalidateQueries()` calls to prevent unhandled rejections
- **Optimistic IDs:** Use `OPTIMISTIC_WORK_ID = "temp"` constant for temporary items (defined in `src/service/useList.ts`)
- **Component-level callbacks:** Mutations accept inline `onSuccess` at call site for navigation/UI side effects
- **Imports:** `import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"`

---

## Testing

- Register `VueQueryPlugin` in test globals (handled by custom `render` in `src/tests/utils.ts`)
- VueQueryPlugin auto-creates a default QueryClient for tests
- Persistence is not wired up in tests — the IndexedDB persister lives in `src/main.ts`, which tests never run, so there is no cache to clear between them
- Use MSW for API mocking (`src/mocks/server`, started in `src/tests/setup.ts`) — do not mock query hooks directly

---

## Common Gotchas

1. **v4 vs v5 API:** This project uses v4. Key differences from v5: `cacheTime` (not `gcTime`), array-form `invalidateQueries(["key"])` (not always object-form), `isLoading` (not `isPending` for queries), `onSuccess`/`onError`/`onSettled` callbacks exist on useQuery (removed in v5)
2. **User queries never persisted:** `queryKey[0] === "user"` is excluded from dehydration, so auth-dependent data never survives a reload
3. **Refetch suppression:** custom `refetchOnMount` counts fetches per query hash and goes quiet after the first couple of mounts, so a component that mounts repeatedly in one session will _not_ refetch. Invalidate explicitly after a mutation rather than expecting a remount to refresh anything
4. **Reactive keys:** Pass `Ref` values directly in queryKey arrays — Vue Query unwraps them automatically
