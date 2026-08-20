import * as mdijs from "@mdi/js";
import { TestingPinia, createTestingPinia } from "@pinia/testing";
import { VueQueryPlugin } from "@tanstack/vue-query";
import userEvent from "@testing-library/user-event";
import { RenderOptions, render as testingLibraryRender } from "@testing-library/vue";
import mdiVue from "mdi-vue/v3";
import { TransitionGroup, createApp } from "vue";
import Toast from "vue-toastification";

import PiniaStoreHelperTest from "./PiniaStoreHelper.test.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import LoadingSpinner from "@/common/components/LoadingSpinner.vue";
import PageHeader from "@/common/components/PageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VBackdrop from "@/common/components/VBackdrop.vue";
import VBtn from "@/common/components/VBtn.vue";
import VModal from "@/common/components/VModal.vue";
import VSelect from "@/common/components/VSelect.vue";
import VSwitch from "@/common/components/VSwitch.vue";
import LazyLoad from "@/directives/LazyLoad";
import Reveal from "@/directives/Reveal";
import MenuCard from "@/features/clubs/components/MenuCard.vue";
import memberData from "@/mocks/data/member.json";
import { useAuthStore } from "@/stores/auth";

export const render = <C>(component: C, options: Partial<RenderOptions<C>> = {}) => {
  const user = userEvent.setup();
  const pinia = createTestingPinia();
  testingLibraryRender(PiniaStoreHelperTest, {
    global: { plugins: [VueQueryPlugin, pinia] },
  });
  return {
    ...testingLibraryRender(component, {
      ...options,
      global: {
        ...options.global,
        components: {
          // Mirror the global components registered in src/main.ts so view
          // tests render real markup instead of unresolved custom elements.
          "v-avatar": VAvatar,
          "v-backdrop": VBackdrop,
          "v-btn": VBtn,
          "v-select": VSelect,
          "v-switch": VSwitch,
          "empty-state": EmptyState,
          "loading-spinner": LoadingSpinner,
          "menu-card": MenuCard,
          "v-modal": VModal,
          "page-header": PageHeader,
          DraggableTransitionGroup: TransitionGroup,
          ...options.global?.components,
        },
        plugins: [
          // Disable query retries so error-path tests surface the error state
          // immediately instead of racing the default 3× exponential backoff.
          [
            VueQueryPlugin,
            { queryClientConfig: { defaultOptions: { queries: { retry: false } } } },
          ],
          pinia,
          [mdiVue, { icons: mdijs }],
          Toast,
        ],
        directives: { "lazy-load": LazyLoad, reveal: Reveal },
        stubs: {
          // Render router-links as real anchors rather than VTU's
          // `<router-link-stub>`: that keeps the link's slot content in the
          // accessibility tree, so tests query navigation by role and name
          // instead of counting stub elements.
          "router-link": {
            props: ["to"],
            template: '<a href="#"><slot /></a>',
          },
          "router-view": true,
          ...(Array.isArray(options.global?.stubs)
            ? Object.fromEntries(options.global.stubs.map((s: string) => [s, true]))
            : options.global?.stubs),
        },
      },
    }),
    user,
    pinia,
  };
};

/**
 * Signs the mock member (`src/mocks/data/member.json`) in on a rendered
 * component's Pinia instance, so tests can exercise the paths that depend on
 * who is logged in — owning a comment, having scored a work.
 *
 * Call it with the `pinia` that `render` returns; components read the user
 * reactively, so state that only appears once signed in needs an `await
 * screen.findBy…` rather than a synchronous `getBy…`.
 */
export const logIn = (pinia: TestingPinia) => {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly property for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
  // @ts-expect-error Forcing logged in to true for testing
  authStore.isLoggedIn = true;
  // Views that mutate the profile call `refreshSession()` in a mutation's
  // `onSettled` and chain onto it; a bare testing-pinia action stub returns
  // undefined, so the chained `.catch()` would throw.
  vi.mocked(authStore.refreshSession).mockResolvedValue(undefined);
};

/**
 * Runs a composable in an app scope and hands back what it returned, so a
 * service test can assert on the composable's own refs instead of rendering a
 * component and reading its template back. Installs the same plugins `render`
 * does — Pinia for the stores composables read, Vue Query for the queries they
 * build, Toast for the mutations that report failures.
 *
 * The callback runs inside `setup()`, so it can also seed store state before
 * calling the composable under test.
 */
export const withSetup = <T>(composable: () => T) => {
  const pinia = createTestingPinia();
  let result!: T;

  const app = createApp({
    setup() {
      result = composable();
      return () => null;
    },
  });
  app.use(pinia);
  // Disable query retries so error-path tests surface the error state
  // immediately instead of racing the default 3x exponential backoff.
  app.use(VueQueryPlugin, {
    queryClientConfig: { defaultOptions: { queries: { retry: false } } },
  });
  app.use(Toast);
  app.mount(document.createElement("div"));

  return { result, pinia, unmount: () => app.unmount() };
};
