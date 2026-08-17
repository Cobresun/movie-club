import { screen } from "@testing-library/vue";
import { vi } from "vitest";

import WorkDescription from "../components/WorkDescription.vue";
import { render } from "@/tests/utils";

/**
 * The component decides whether to offer "Read more" by comparing the
 * paragraph's scroll height to its client height. jsdom does no layout and
 * reports 0 for both, so the two heights are stubbed to stand in for text that
 * does or doesn't overflow the two-line clamp.
 */
const stubOverflow = (overflows: boolean) => {
  vi.spyOn(HTMLParagraphElement.prototype, "clientHeight", "get").mockReturnValue(40);
  vi.spyOn(HTMLParagraphElement.prototype, "scrollHeight", "get").mockReturnValue(
    overflows ? 120 : 40,
  );
};

describe("WorkDescription", () => {
  it("renders the overview text", () => {
    render(WorkDescription, {
      props: { overview: "A great film about things." },
    });

    expect(screen.getByText("A great film about things.")).toBeInTheDocument();
  });

  it("renders nothing when there is no overview", () => {
    const { container } = render(WorkDescription, { props: { overview: "" } });

    expect(container).toBeEmptyDOMElement();
  });

  it("does not offer Read more when the overview fits the clamp", async () => {
    stubOverflow(false);

    render(WorkDescription, { props: { overview: "Short text." } });

    expect(await screen.findByText("Short text.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /read more/i })).not.toBeInTheDocument();
  });

  it("expands and collapses an overview that overflows the clamp", async () => {
    stubOverflow(true);

    const rendered = render(WorkDescription, {
      props: { overview: "Long text that overflows." },
    });

    await rendered.user.click(await screen.findByRole("button", { name: "Read more" }));

    const showLess = await screen.findByRole("button", { name: "Show less" });
    await rendered.user.click(showLess);

    expect(await screen.findByRole("button", { name: "Read more" })).toBeInTheDocument();
  });
});
