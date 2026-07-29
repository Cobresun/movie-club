import { screen } from "@testing-library/vue";
import { config } from "@vue/test-utils";
import { http, HttpResponse } from "msw";
import { defineComponent, h } from "vue";

import { WorkType } from "../../../../lib/types/generated/db";
import { server } from "@/mocks/server";
import { useAddListItem } from "@/service/useList";
import { render } from "@/tests/utils";

// vue-toastification renders its toasts inside a <transition-group>, which VTU
// stubs by default — the stub drops its children, so the toast text never hits
// the DOM. Un-stub transitions for this file so we can assert on what the user
// actually sees.
config.global.stubs = { transition: false, "transition-group": false };

// Minimal host that fires the add mutation on click, mirroring how AddWorkModal
// calls mutate() and then immediately closes (which unmounts the modal).
const Harness = defineComponent({
  setup() {
    const { mutate } = useAddListItem("test-club", "list-1");
    return () =>
      h(
        "button",
        {
          onClick: () => mutate({ type: WorkType.movie, title: "Inception", externalId: "1" }),
        },
        "add",
      );
  },
});

// The shared render() helper installs the toast plugin, and setup.ts renders a
// Pinia helper through it too, so every toast shows up in more than one
// container. Query for all matches rather than a single one.
const findToast = (message: string) => screen.findAllByText(message);

describe("useAddListItem", () => {
  it("shows a success toast even when the host unmounts before the request settles", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posted: unknown;
    server.use(
      http.post("/api/club/test-club/list/list-1/items", async ({ request }) => {
        posted = await request.json();
        await gate; // hold the response open until after we unmount
        return HttpResponse.json({ id: "new" });
      }),
    );

    const view = render(Harness);
    await view.user.click(screen.getByRole("button", { name: "add" }));

    // The Add modal closes (unmounts) the instant the mutation is fired.
    view.unmount();

    // Only now does the in-flight POST resolve.
    release();

    expect(await findToast('Added "Inception" to the list')).not.toHaveLength(0);
    expect(posted).toEqual({ type: WorkType.movie, title: "Inception", externalId: "1" });
  });

  it("shows an error toast when the request fails", async () => {
    server.use(
      http.post("/api/club/test-club/list/list-1/items", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { user } = render(Harness);
    await user.click(screen.getByRole("button", { name: "add" }));

    expect(await findToast('Failed to add "Inception". Please try again.')).not.toHaveLength(0);
  });
});
