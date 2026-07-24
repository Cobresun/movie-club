import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { defineComponent, h } from "vue";
import { globalEventBus, TYPE } from "vue-toastification";

import { WorkType } from "../../../../lib/types/generated/db";
import { server } from "@/mocks/server";
import { useAddListItem } from "@/service/useList";
import { render } from "@/tests/utils";

// Spy on vue-toastification's real global event bus (which the plugin the test
// harness installs emits to) rather than mocking useToast — the mutation's toast
// interface is resolved deep inside the service, and asserting the emitted "add"
// event verifies the real end-to-end path. Toasts are emitted as
// emit("add", { content, type }); the event name is a private enum, so match it
// with expect.anything() and assert on the toast payload.

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

describe("useAddListItem", () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    emitSpy = vi.spyOn(globalEventBus, "emit");
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

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

    await waitFor(() =>
      expect(emitSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: 'Added "Inception" to the list',
          type: TYPE.SUCCESS,
        }),
      ),
    );
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

    await waitFor(() =>
      expect(emitSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: 'Failed to add "Inception". Please try again.',
          type: TYPE.ERROR,
        }),
      ),
    );
  });
});
