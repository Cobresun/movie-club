import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import CommentThread from "../components/CommentThread.vue";

import memberData from "@/mocks/data/member.json";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

const CLUB_SLUG = "test-club";
const WORK_ID = "movie-123";

const mockComments = (
  comments: {
    id: string;
    workId: string;
    userId: string;
    userName: string;
    content: string;
    createdDate: string;
    spoiler: boolean;
    userImage?: string;
  }[],
) => {
  server.use(
    http.get(`/api/club/${CLUB_SLUG}/reviews/${WORK_ID}/comments`, () =>
      HttpResponse.json(comments),
    ),
  );
};

const mockAddComment = () => {
  server.use(
    http.post(
      `/api/club/${CLUB_SLUG}/reviews/${WORK_ID}/comments`,
      () => new HttpResponse(null, { status: 200 }),
    ),
  );
};

const mockEditComment = (commentId: string) => {
  server.use(
    http.put(
      `/api/club/${CLUB_SLUG}/reviews/${WORK_ID}/comments/${commentId}`,
      () => new HttpResponse(null, { status: 200 }),
    ),
  );
};

const mockDeleteComment = (commentId: string) => {
  server.use(
    http.delete(
      `/api/club/${CLUB_SLUG}/reviews/${WORK_ID}/comments/${commentId}`,
      () => new HttpResponse(null, { status: 200 }),
    ),
  );
};

// Wraps CommentThread in a parent component that pre-seeds the auth store with
// the current-user data before CommentThread's setup() runs.  This is necessary
// because CommentThread captures `currentUserId` once at setup time via
// `ref(user.value?.id)`, so the user must be present before the child mounts.
const AuthWrapperForTest = defineComponent({
  components: { CommentThread },
  setup() {
    const auth = useAuthStore();
    // @ts-expect-error Overwriting writable-computed stub for test
    auth.user = {
      id: memberData.id,
      email: memberData.email,
      name: memberData.name,
      image: memberData.image,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    };
  },
  template: `<CommentThread workId="${WORK_ID}" clubSlug="${CLUB_SLUG}" />`,
});

const renderAsCurrentUser = () => render(AuthWrapperForTest);

describe("CommentThread", () => {
  beforeEach(() => {
    server.use(
      http.get(`/api/club/${CLUB_SLUG}/reviews/${WORK_ID}/comments`, () =>
        HttpResponse.json([]),
      ),
    );
  });

  it("renders the Comments heading", () => {
    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    expect(screen.getByText("Comments")).toBeInTheDocument();
  });

  it("shows empty state message when there are no comments", async () => {
    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    expect(await screen.findByText(/No comments yet/i)).toBeInTheDocument();
  });

  it("renders existing comments", async () => {
    mockComments([
      {
        id: "c1",
        workId: WORK_ID,
        userId: "other-user",
        userName: "Alice",
        content: "Great movie!",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
    ]);

    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    expect(await screen.findByText("Great movie!")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows the comment input textarea and send button", () => {
    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    expect(screen.getByPlaceholderText("Write a comment…")).toBeInTheDocument();
  });

  it("send button is disabled when textarea is empty", () => {
    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    const btn = screen.getByRole("button", { name: /send/i });
    expect(btn).toBeDisabled();
  });

  it("enables send button when text is entered", async () => {
    mockAddComment();
    const { user } = render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    const textarea = screen.getByPlaceholderText("Write a comment…");
    await user.type(textarea, "Hello world");

    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("shows spoiler label for comments marked as spoiler (for other users)", async () => {
    mockComments([
      {
        id: "c2",
        workId: WORK_ID,
        userId: "other-user",
        userName: "Bob",
        content: "The ending is wild!",
        createdDate: new Date().toISOString(),
        spoiler: true,
      },
    ]);

    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    expect(await screen.findByText("Spoiler")).toBeInTheDocument();
  });

  it("blurs spoiler comment content for other users", async () => {
    mockComments([
      {
        id: "c3",
        workId: WORK_ID,
        userId: "other-user",
        userName: "Carol",
        content: "Secret ending revealed",
        createdDate: new Date().toISOString(),
        spoiler: true,
      },
    ]);

    render(CommentThread, {
      props: { workId: WORK_ID, clubSlug: CLUB_SLUG },
    });

    await screen.findByText("Secret ending revealed");

    const blurredPara = document.querySelector(".blur-sm");
    expect(blurredPara).toBeInTheDocument();
  });

  it("shows edit and delete buttons only for the current user's comments", async () => {
    mockComments([
      {
        id: "c4",
        workId: WORK_ID,
        userId: memberData.id,
        userName: memberData.name,
        content: "My comment",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
      {
        id: "c5",
        workId: WORK_ID,
        userId: "other-user",
        userName: "Other",
        content: "Other comment",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
    ]);

    renderAsCurrentUser();

    await screen.findByText("My comment");

    // pencil and delete icons are rendered as buttons; current user owns c4
    const editButtons = document.querySelectorAll(
      "button[class*='text-gray-500']",
    );
    // Exactly 2 action buttons (edit + delete) for the owned comment
    expect(editButtons.length).toBe(2);
  });

  it("enters edit mode when pencil button is clicked", async () => {
    mockComments([
      {
        id: "c6",
        workId: WORK_ID,
        userId: memberData.id,
        userName: memberData.name,
        content: "Edit me",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
    ]);
    mockEditComment("c6");

    const { user } = renderAsCurrentUser();

    await screen.findByText("Edit me");

    const editBtn = document.querySelectorAll(
      "button[class*='text-gray-500']",
    )[0] as HTMLElement;
    await user.click(editBtn);

    // Edit textarea should appear with current content
    const editTextarea = document.querySelectorAll("textarea")[0];
    expect(editTextarea.value).toBe("Edit me");

    // Cancel button should appear
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("cancels editing when Cancel is clicked", async () => {
    mockComments([
      {
        id: "c7",
        workId: WORK_ID,
        userId: memberData.id,
        userName: memberData.name,
        content: "Cancel this",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
    ]);

    const { user } = renderAsCurrentUser();
    await screen.findByText("Cancel this");

    const editBtn = document.querySelectorAll(
      "button[class*='text-gray-500']",
    )[0] as HTMLElement;
    await user.click(editBtn);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.queryByRole("button", { name: /save/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Cancel this")).toBeInTheDocument();
  });

  it("shows delete confirmation modal when delete button is clicked", async () => {
    mockComments([
      {
        id: "c8",
        workId: WORK_ID,
        userId: memberData.id,
        userName: memberData.name,
        content: "Delete me",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
    ]);
    mockDeleteComment("c8");

    const { user } = renderAsCurrentUser();
    await screen.findByText("Delete me");

    const deleteBtn = document.querySelectorAll(
      "button[class*='text-gray-500']",
    )[1] as HTMLElement;
    await user.click(deleteBtn);

    expect(await screen.findByText("Delete Comment")).toBeInTheDocument();
  });
});
