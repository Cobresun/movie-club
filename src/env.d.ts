/// <reference types="vite/client" />

declare module "*.vue" {
  import { Component } from "vue";

  const component: Component;
  export default component;
}

declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  VITE_GOOGLE_BOOKS_API_KEY: string;
  VITE_TMDB_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
