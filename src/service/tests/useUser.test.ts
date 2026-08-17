import { http } from "msw";

import { useUser, useUserClubs } from "../useUser";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { withSetup } from "@/tests/utils";

describe("useUser", () => {
  it("returns undefined when no user is in auth store", () => {
    const { result } = withSetup(() => useUser());

    expect(result.value).toBeUndefined();
  });

  it("maps the session user onto the club-facing user", () => {
    const { result } = withSetup(() => {
      const auth = useAuthStore();
      // @ts-expect-error overwriting readonly for test
      auth.user = {
        id: "u-1",
        email: "alice@test.com",
        name: "Alice",
        image: "https://img.test/alice.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
      };
      return useUser();
    });

    expect(result.value).toMatchObject({
      id: "u-1",
      name: "Alice",
      email: "alice@test.com",
      image: "https://img.test/alice.jpg",
    });
  });
});

describe("useUserClubs", () => {
  it("does not fetch clubs when the user is not logged in", async () => {
    server.use(
      http.get("/api/member/clubs", () => {
        throw new Error("A logged-out user has no clubs to fetch");
      }),
    );

    const { result } = withSetup(() => useUserClubs());

    await vi.waitFor(() => {
      expect(result.status.value).toBe("loading");
      expect(result.fetchStatus.value).toBe("idle");
    });
  });
});
