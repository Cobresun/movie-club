import { screen } from "@testing-library/vue";

import MemberFilterChips from "../components/MemberFilterChips.vue";
import SegmentedToggle from "../components/SegmentedToggle.vue";
import { render } from "@/tests/utils";

const members = [
  { id: "1", name: "dev", image: "https://test.com/dev.jpg" },
  { id: "2", name: "user" },
];

describe("MemberFilterChips", () => {
  it("offers a chip per member plus the All chip", () => {
    render(MemberFilterChips, { props: { members, modelValue: undefined } });

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dev/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /user/ })).toBeInTheDocument();
  });

  it("hides the All chip when the caller opts out", () => {
    render(MemberFilterChips, {
      props: { members, modelValue: "1", includeAll: false },
    });

    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });

  it("selects a member by emitting their id", async () => {
    const rendered = render(MemberFilterChips, {
      props: { members, modelValue: undefined },
    });

    await rendered.user.click(screen.getByRole("button", { name: /dev/ }));

    expect(rendered.emitted()["update:modelValue"]).toEqual([["1"]]);
  });

  it("clears the selection by emitting undefined from the All chip", async () => {
    const rendered = render(MemberFilterChips, {
      props: { members, modelValue: "1" },
    });

    await rendered.user.click(screen.getByRole("button", { name: "All" }));

    expect(rendered.emitted()["update:modelValue"]).toEqual([[undefined]]);
  });

  it("marks the selected member's chip as the active one", () => {
    render(MemberFilterChips, { props: { members, modelValue: "2" } });

    expect(screen.getByRole("button", { name: /user/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dev/, pressed: false })).toBeInTheDocument();
  });

  it("marks All as the active chip while no member is selected", () => {
    render(MemberFilterChips, { props: { members, modelValue: undefined } });

    expect(screen.getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dev/, pressed: true })).not.toBeInTheDocument();
  });

  it("offers nothing but the All chip for a club with no members", () => {
    render(MemberFilterChips, { props: { members: [], modelValue: undefined } });

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dev|user/ })).not.toBeInTheDocument();
  });
});

describe("SegmentedToggle", () => {
  const options = [
    { value: "scores", label: "Scores" },
    { value: "counts", label: "Counts" },
  ] as const;

  it("renders one tab per option", () => {
    render(SegmentedToggle, { props: { options, modelValue: "scores" } });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Scores",
      "Counts",
    ]);
  });

  it("marks only the current option as selected", () => {
    render(SegmentedToggle, { props: { options, modelValue: "counts" } });

    expect(screen.getByRole("tab", { name: "Counts" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Scores" })).toHaveAttribute("aria-selected", "false");
  });

  it("emits the option's value when a tab is clicked", async () => {
    const rendered = render(SegmentedToggle, {
      props: { options, modelValue: "scores" },
    });

    await rendered.user.click(screen.getByRole("tab", { name: "Counts" }));

    expect(rendered.emitted()["update:modelValue"]).toEqual([["counts"]]);
  });

  it("still emits when the current option is re-clicked, leaving dedupe to v-model", async () => {
    const rendered = render(SegmentedToggle, {
      props: { options, modelValue: "scores" },
    });

    await rendered.user.click(screen.getByRole("tab", { name: "Scores" }));

    expect(rendered.emitted()["update:modelValue"]).toEqual([["scores"]]);
  });
});
