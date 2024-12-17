import "@tanstack/vue-table";

export {};

declare module "vue-router" {
  interface RouteMeta {
    depth: number;
    transitionIn?: string;
    transitionOut?: string;
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
