import { defineComponent } from "vue";

import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

// The auth store uses authClient.useSession() from better-auth/vue, which is
// already implicitly stubbed at the Pinia level: createTestingPinia() replaces
// all actions/getters with spies whose initial state is the store default.
// We verify the derived computed properties and public surface rather than
// the BetterAuth internals.

describe("useAuthStore", () => {
  it("isLoggedIn is false when there is no session", () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        return { isLoggedIn: auth.isLoggedIn };
      },
      template: `<div>{{ isLoggedIn ? 'logged-in' : 'logged-out' }}</div>`,
    });

    const { getByText } = render(Harness);
    expect(getByText("logged-out")).toBeInTheDocument();
  });

  it("user is undefined when there is no session", () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        return { user: auth.user };
      },
      template: `<div>{{ user ? user.name : 'no-user' }}</div>`,
    });

    const { getByText } = render(Harness);
    expect(getByText("no-user")).toBeInTheDocument();
  });

  it("showAuthModal defaults to false", () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        return { showAuthModal: auth.showAuthModal };
      },
      template: `<div>{{ showAuthModal ? 'open' : 'closed' }}</div>`,
    });

    const { getByText } = render(Harness);
    expect(getByText("closed")).toBeInTheDocument();
  });

  // Note: login() and closeAuthModal() are one-line state setters that
  // createTestingPinia replaces with no-op spies, so calling them through the
  // harness only exercises the stub. The reactive flag itself is covered here.
  it("showAuthModal state change is reflected in the template", async () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        auth.showAuthModal = true;
        return { auth };
      },
      template: `<div><button @click="auth.showAuthModal = false">dismiss</button>{{ auth.showAuthModal ? 'modal-open' : 'modal-closed' }}</div>`,
    });

    const { getByRole, getByText, findByText } = render(Harness);
    expect(getByText("modal-open")).toBeInTheDocument();
    getByRole("button").click();
    expect(await findByText("modal-closed")).toBeInTheDocument();
  });

  it("isClubMember returns false when userClubs is undefined", () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        const isMember = auth.isClubMember("some-club");
        return { isMember };
      },
      template: `<div>{{ isMember ? 'member' : 'not-member' }}</div>`,
    });

    const { getByText } = render(Harness);
    expect(getByText("not-member")).toBeInTheDocument();
  });

  it("request is a computed axios instance", () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        // request is a computed wrapping axios.create() — just verify it exists
        const hasRequest = auth.request !== undefined;
        return { hasRequest };
      },
      template: `<div>{{ hasRequest ? 'has-request' : 'no-request' }}</div>`,
    });

    const { getByText } = render(Harness);
    expect(getByText("has-request")).toBeInTheDocument();
  });
});
