export {};

declare module "vue-router" {
  interface RouteMeta {
    depth: number;
  }
}
