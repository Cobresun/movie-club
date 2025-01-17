/// <reference types="vite/client" />

declare module "*.vue" {
  import { Component } from "vue";

  const component: Component;
  export default component;
}

interface ImportMetaEnv {
  VITE_TMDB_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
