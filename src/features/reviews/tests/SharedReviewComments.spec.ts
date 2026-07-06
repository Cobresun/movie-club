import { screen } from "@testing-library/vue";

import { WorkCommentDto } from "../../../../lib/types/lists";
import SharedReviewComments from "../components/SharedReviewComments.vue";

import { render } from "@/tests/utils";

const makeComment = (
  overrides: Partial<WorkCommentDto> = {},
): WorkCommentDto => ({
  id: "c1",
  workId: "w1",
  userId: "u1",
  userName: "Ada",
  content: "Loved the cinematography.",
  createdDate: new Date().toISOString(),
  spoiler: false,
  ...overrides,
});

describe("SharedReviewComments", () => {
  it("renders each comment's author and content", () => {
    render(SharedReviewComments, {
      props: {
        comments: [
          makeComment({ id: "c1", userName: "Ada", content: "Great pacing." }),
          makeComment({ id: "c2", userName: "Linus", content: "Slow middle." }),
        ],
      },
    });

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Great pacing.")).toBeInTheDocument();
    expect(screen.getByText("Linus")).toBeInTheDocument();
    expect(screen.getByText("Slow middle.")).toBeInTheDocument();
  });

  it("flags spoiler comments and blurs them until clicked", async () => {
    const { user } = render(SharedReviewComments, {
      props: {
        comments: [
          makeComment({
            id: "c1",
            content: "The killer was the butler.",
            spoiler: true,
          }),
        ],
      },
    });

    expect(screen.getByText(/Spoiler/)).toBeInTheDocument();
    const hidden = screen.getByText("The killer was the butler.");
    expect(hidden).toHaveClass("blur-sm");

    await user.click(hidden);

    expect(screen.getByText("The killer was the butler.")).not.toHaveClass(
      "blur-sm",
    );
  });

  it("does not blur non-spoiler comments", () => {
    render(SharedReviewComments, {
      props: { comments: [makeComment({ content: "No spoilers here." })] },
    });

    expect(screen.queryByText(/Spoiler/)).not.toBeInTheDocument();
    expect(screen.getByText("No spoilers here.")).not.toHaveClass("blur-sm");
  });

  it("renders nothing in the list when there are no comments", () => {
    render(SharedReviewComments, { props: { comments: [] } });

    // The "Reviews" heading is always present; no comment cards render.
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.queryByText(/Spoiler/)).not.toBeInTheDocument();
  });
});
