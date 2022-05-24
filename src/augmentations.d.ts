export {}

declare module 'vue-router' {
    interface RouteMeta {
        depth: number;
        transitionIn?: string;
        transitionOut?: string;
    }
}