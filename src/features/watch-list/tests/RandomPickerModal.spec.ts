import { screen, waitFor } from "@testing-library/vue";
import { afterEach, beforeEach } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import RandomPickerModal from "../components/RandomPickerModal.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const item = (id: string, title: string): DetailedWorkListItem => ({
  id,
  type: WorkType.movie,
  title,
  createdDate: "2024-05-01T00:00:00.000Z",
  externalId: id,
  imageUrl: `https://test.com/${id}.jpg`,
});

// The reel spins for a fixed ~4s before landing, so the modal is driven with
// fake timers rather than waiting it out.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Renders the modal and runs the reel to its landing. */
async function pickFrom(
  items: DetailedWorkListItem[],
  otherLists = [] as { id: string; title: string }[],
) {
  const rendered = render(RandomPickerModal, { props: { items, otherLists } });
  await vi.runAllTimersAsync();
  return rendered;
}

describe("RandomPickerModal", () => {
  it("lands on the only candidate and offers what to do with it", async () => {
    await pickFrom([item("1", "Solaris")]);

    expect(await screen.findByText("Solaris")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make up next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never Mind" })).toBeInTheDocument();
  });

  it("offers no actions until the reel stops", async () => {
    render(RandomPickerModal, { props: { items: [item("1", "Solaris")], otherLists: [] } });

    await vi.advanceTimersByTimeAsync(100);

    expect(screen.queryByRole("button", { name: "Make up next" })).not.toBeInTheDocument();
  });

  it("makes the winner next up and closes", async () => {
    const rendered = await pickFrom([item("1", "Solaris")]);

    await rendered.user.click(await screen.findByRole("button", { name: "Make up next" }));

    await waitFor(() => {
      expect(rendered.emitted()["makeNext"]).toEqual([[expect.objectContaining({ id: "1" })]]);
    });
    expect(rendered.emitted()["close"]).toHaveLength(1);
  });

  it("moves the winner to another list and closes", async () => {
    const rendered = await pickFrom([item("1", "Solaris")], [{ id: "9", title: "Sci-Fi" }]);

    await screen.findByRole("button", { name: "Make up next" });
    await rendered.user.selectOptions(screen.getByRole("combobox"), "9");

    await waitFor(() => {
      expect(rendered.emitted()["moveToList"]).toEqual([
        [{ item: expect.objectContaining({ id: "1" }), listId: "9" }],
      ]);
    });
    expect(rendered.emitted()["close"]).toHaveLength(1);
  });

  it("offers no list picker when the club has no other lists", async () => {
    await pickFrom([item("1", "Solaris")]);

    await screen.findByRole("button", { name: "Make up next" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("closes without a choice on Never Mind", async () => {
    const rendered = await pickFrom([item("1", "Solaris")]);

    await rendered.user.click(await screen.findByRole("button", { name: "Never Mind" }));

    expect(rendered.emitted()["close"]).toHaveLength(1);
    expect(rendered.emitted()["makeNext"]).toBeUndefined();
  });
});
