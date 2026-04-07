---
paths:
  - "**/*.spec.*"
  - "**/*.test.*"
  - "**/tests/**"
  - "src/mocks/**"
---

# Testing

- **Framework:** Vitest with jsdom environment
- **Setup file:** `src/tests/setup.ts`
- **API mocking:** Mock Service Worker (MSW) — handlers in `src/mocks/handlers.ts`
- **Helper utilities:** `src/tests/utils.ts`
- **Test data:** `src/mocks/data/`
- **Coverage:** excludes mocks and test directories
- **Test location:** feature tests live in `src/features/<feature>/tests/`
