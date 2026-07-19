import "@tanstack/vue-table";

export {};

declare module "vue-router" {
  interface RouteMeta {
    depth: number;
    /**
     * AuthModal returns the user to this route's fullPath after auth, instead
     * of the default club — for pages that are themselves the destination of
     * an external link (club invites, /add deep links).
     */
    returnHereAfterAuth?: boolean;
  }
}

declare module "@tanstack/vue-table" {
  interface ColumnMeta {
    class?: string;
  }

  interface HeaderContext {
    meta?: Record<string, unknown>;
  }

  interface CellContext {
    meta?: Record<string, unknown>;
  }
}
