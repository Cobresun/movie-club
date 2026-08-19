import { screen } from "@testing-library/vue";

import CommentThread from "../components/CommentThread.vue";
import { comment, commentsApi } from "@/mocks/comments";
import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

const CLUB_SLUG = "test-club";
const WORK_ID = "movie-123";

/** A comment by somebody other than the signed-in member. */
const theirComment = (content: string, spoiler = false) =>
  comment({ id: `their-${content}`, workId: WORK_ID, userName: "Alice", content, spoiler });

/** A comment the signed-in member wrote, so the owner controls show up. */
const myComment = (content: string, spoiler = false) =>
  comment({
    id: `mine-${content}`,
    workId: WORK_ID,
    userId: memberData.id,
    userName: memberData.name,
    content,
    spoiler,
  });

const renderThread = () =>
  render(CommentThread, { props: { workId: WORK_ID, clubSlug: CLUB_SLUG } });

describe("CommentThread", () => {
  it("renders the Comments heading", () => {
    renderThread();

    expect(screen.getByText("Comments")).toBeInTheDocument();
  });

  it("shows empty state message when there are no comments", async () => {
    renderThread();

    expect(await screen.findByText(/No comments yet/i)).toBeInTheDocument();
  });

  it("renders existing comments", async () => {
    server.use(...commentsApi([theirComment("Great movie!")]));

    renderThread();

    expect(await screen.findByText("Great movie!")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("send button is disabled until a comment is typed", async () => {
    const rendered = renderThread();

    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();

    await rendered.user.type(screen.getByPlaceholderText("Write a comment…"), "Hello world");

    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("adds a typed comment to the thread and clears the box", async () => {
    server.use(...commentsApi());

    const rendered = renderThread();

    const textarea = await screen.findByPlaceholderText("Write a comment…");
    await rendered.user.type(textarea, "Hello world");
    await rendered.user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Hello world")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
  });

  it("shows spoiler label for comments marked as spoiler", async () => {
    server.use(...commentsApi([theirComment("The ending is wild!", true)]));

    renderThread();

    expect(await screen.findByText("Spoiler")).toBeInTheDocument();
  });

  it("hides spoiler content from assistive tech until it is revealed", async () => {
    server.use(...commentsApi([theirComment("Secret ending revealed", true)]));

    const rendered = renderThread();

    // The blur is visual only, so aria-hidden is what actually keeps the
    // spoiler from being read out before the member asks for it.
    const spoiler = await screen.findByText("Secret ending revealed");
    expect(spoiler).toHaveAttribute("aria-hidden", "true");

    await rendered.user.click(spoiler);

    expect(screen.getByText("Secret ending revealed")).not.toHaveAttribute("aria-hidden");
  });

  it("shows the author their own spoiler comment unmasked", async () => {
    server.use(...commentsApi([myComment("My own spoiler", true)]));

    const rendered = renderThread();
    logIn(rendered.pinia);

    expect(await screen.findByText("My own spoiler")).toBeInTheDocument();
  });

  it("shows edit and delete buttons only for the current user's comments", async () => {
    server.use(...commentsApi([myComment("My comment"), theirComment("Other comment")]));

    const rendered = renderThread();
    logIn(rendered.pinia);

    // Only the owned comment gets an edit/delete pair.
    expect(await screen.findAllByRole("button", { name: "Edit comment" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Delete comment" })).toHaveLength(1);
  });

  it("saves an edit back to the thread", async () => {
    server.use(...commentsApi([myComment("Edit me")]));

    const rendered = renderThread();
    logIn(rendered.pinia);

    await rendered.user.click(await screen.findByRole("button", { name: "Edit comment" }));

    const editBox = screen.getByDisplayValue("Edit me");
    await rendered.user.clear(editBox);
    await rendered.user.type(editBox, "Edited after all");
    await rendered.user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Edited after all")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("leaves the comment alone when an edit is cancelled", async () => {
    server.use(...commentsApi([myComment("Cancel this")]));

    const rendered = renderThread();
    logIn(rendered.pinia);

    await rendered.user.click(await screen.findByRole("button", { name: "Edit comment" }));

    const editBox = screen.getByDisplayValue("Cancel this");
    await rendered.user.clear(editBox);
    await rendered.user.type(editBox, "Never mind");
    await rendered.user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(screen.getByText("Cancel this")).toBeInTheDocument();
  });

  it("takes a comment off the thread once the delete is confirmed", async () => {
    server.use(...commentsApi([myComment("Delete me"), theirComment("Keep me")]));

    const rendered = renderThread();
    logIn(rendered.pinia);

    await rendered.user.click(await screen.findByRole("button", { name: "Delete comment" }));
    await rendered.user.click(await screen.findByRole("button", { name: /^delete$/i }));

    await screen.findByText("Keep me");
    expect(screen.queryByText("Delete me")).not.toBeInTheDocument();
  });

  it("keeps the comment when the delete is called off", async () => {
    server.use(...commentsApi([myComment("Delete me")]));

    const rendered = renderThread();
    logIn(rendered.pinia);

    await rendered.user.click(await screen.findByRole("button", { name: "Delete comment" }));
    expect(await screen.findByText("Delete Comment")).toBeInTheDocument();

    await rendered.user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("Delete me")).toBeInTheDocument();
  });
});
