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
- `refetchOnMount`: Custom logic — allows first refetch per query hash, suppresses subsequent remounts
- **Persistence:** localStorage via `clientPersister`, 1-week maxAge
- **User queries excluded from persistence:** `shouldDehydrateQuery` filters out `queryKey[0] === "user"`

---

## Query Key Convention

Always use **string arrays** (not objects). Patterns:

| Pattern | Example | Used for |
|---------|---------|----------|
| `[resource, id]` | `["club", clubSlug]` | Single resource |
| `[resource, id, sub]` | `["club", clubSlug, "settings"]` | Nested resource |
| `[resource, id, type]` | `["list", clubSlug, WorkListType.reviews]` | Typed sub-resource |
| `[domain, action, param]` | `["tmdb", "search", query]` | External API |

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

**Function overloads for type-safe return types:**
```typescript
export function useList(clubSlug: string, type: WorkListType.reviews): UseQueryReturnType<DetailedReviewListItem[], AxiosError>;
export function useList(clubSlug: string, type: WorkListType.backlog | WorkListType.watchlist): UseQueryReturnType<DetailedWorkListItem[], AxiosError>;
```

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
    queryClient.setQueryData<DetailedReviewListItem[]>(
      ["list", clubSlug, WorkListType.reviews],
      (current) => current?.map(item => item.id === workId ? { ...item, updatedField } : item),
    );
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["list", clubSlug, WorkListType.reviews] }),
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
- Clear `localStorage` between tests to reset persisted cache
- Use MSW for API mocking — do not mock query hooks directly

---

## Common Gotchas

1. **v4 vs v5 API:** This project uses v4. Key differences from v5: `cacheTime` (not `gcTime`), array-form `invalidateQueries(["key"])` (not always object-form), `isLoading` (not `isPending` for queries), `onSuccess`/`onError`/`onSettled` callbacks exist on useQuery (removed in v5)
2. **User queries never persisted:** `queryKey[0] === "user"` is excluded from localStorage dehydration
3. **Refetch suppression:** Custom `refetchOnMount` only allows first refetch per query hash — subsequent component mounts skip refetch
4. **Reactive keys:** Pass `Ref` values directly in queryKey arrays — Vue Query unwraps them automatically
