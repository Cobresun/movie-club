import path from "node:path";
import { RuleTester } from "oxlint/plugins-dev";

import { ROOT, clubTypeOf, createPlugin } from "./review-plugin.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const { rules } = createPlugin({});
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const at = (file) => path.join(ROOT, file);

tester.run("no-raw-sql", rules["no-raw-sql"], {
  valid: [
    `import { sql } from "kysely"; db.selectFrom("work").select((eb) => eb.fn.count("id").as("n"));`,
    "const sql = (s) => s; sql`not kysely`;",
  ],
  invalid: [
    {
      code: 'import { sql } from "kysely"; db.select(sql<number>`COUNT(*)`.as("n"));',
      errors: 1,
    },
    {
      code: 'import { sql as raw } from "kysely"; raw`CASE id ${raw.join(parts, raw` `)} END`; raw.lit("x");',
      errors: 2,
    },
  ],
});

tester.run("no-club-type-branch", rules["no-club-type-branch"], {
  valid: [
    "const label = clubTypeConfig(club.type).reviewLabel;",
    "const config = { [ClubType.MOVIE]: movie, [ClubType.TV]: tv };",
    'if (status === "movie") {}',
  ],
  invalid: [
    { code: "if (club.type === ClubType.TV) {}", errors: 1 },
    { code: 'if (props.workType !== "book") {}', errors: 1 },
    { code: "const type = club.value?.type ?? ClubType.MOVIE;", errors: 1 },
    { code: 'switch (work.type) { case "tv": break; }', errors: 1 },
    { code: "switch (x) { case WorkType.BOOK: break; }", errors: 1 },
  ],
});

tester.run("club-type-boundary", rules["club-type-boundary"], {
  valid: [
    {
      code: 'import { shared } from "../display"; import { tv } from "./data";',
      filename: at("src/common/clubType/tv/index.ts"),
    },
    { code: 'import { a } from "../movie/display";', filename: at("src/common/clubType/index.ts") },
  ],
  invalid: [
    {
      code: 'import { movieDisplay } from "../movie/display";',
      filename: at("src/common/clubType/tv/display.ts"),
      errors: 1,
    },
    {
      code: 'import { fetchMovie } from "./movieProvider";',
      filename: at("netlify/functions/utils/providers/tvProvider.ts"),
      errors: 1,
    },
    {
      code: 'const m = await import("@/common/clubType/book/search");',
      filename: at("src/features/reviews/components/tv/EpisodeList.vue.ts"),
      errors: 1,
    },
  ],
});

tester.run("test-query-like-a-user", rules["test-query-like-a-user"], {
  valid: ['screen.getByRole("button", { name: "Save" });', 'screen.getByText("Hi");'],
  invalid: [
    { code: 'document.querySelector(".poster");', errors: 1 },
    { code: "const { container } = render(X); container.firstChild;", errors: 1 },
    { code: 'screen.getByTitle("Close");', errors: 1 },
    { code: 'screen.queryAllByTestId("row");', errors: 1 },
  ],
});

tester.run("test-no-style-assertions", rules["test-no-style-assertions"], {
  valid: ['expect(button).toHaveAttribute("aria-pressed", "true");'],
  invalid: [
    { code: 'expect(button).toHaveClass("bg-primary");', errors: 1 },
    { code: "expect(el).toHaveStyle({ opacity: 0 });", errors: 1 },
  ],
});

tester.run("test-env-stubs", rules["test-env-stubs"], {
  valid: ["afterEach(() => { vi.unstubAllEnvs(); });", 'vi.stubEnv("GEMINI_API_KEY", "");'],
  invalid: [{ code: 'it("has no key", () => { vi.unstubAllEnvs(); });', errors: 1 }],
});

tester.run("test-no-clipboard-spy", rules["test-no-clipboard-spy"], {
  valid: ["expect(await navigator.clipboard.readText()).toBe(url);"],
  invalid: [
    { code: 'vi.spyOn(navigator.clipboard, "writeText");', errors: 1 },
    { code: "navigator.clipboard.writeText = vi.fn();", errors: 1 },
    { code: 'Object.defineProperty(navigator, "clipboard", { value: {} });', errors: 1 },
  ],
});

tester.run("test-no-hand-built-harness", rules["test-no-hand-built-harness"], {
  valid: ["const { result } = withSetup(() => useThing());"],
  invalid: [
    {
      code: "render(defineComponent({ setup: () => useThing(), template: '<div />' }));",
      errors: 1,
    },
  ],
});

tester.run("no-vue-cast", rules["no-vue-cast"], {
  valid: ['const tabs = ["a", "b"] as const;', "const x = value satisfies Foo;"],
  invalid: [
    { code: "const token = route.query.token as string;", errors: 1 },
    { code: "const w = window as unknown as Record<string, unknown>;", errors: 1 },
    { code: "const el = <HTMLInputElement>event.target;", errors: 1 },
  ],
});

tester.run("no-suppression-comments", rules["no-suppression-comments"], {
  valid: [
    "// oxlint-disable-next-line typescript/no-deprecated -- required by HandlerContext\nfoo();",
    "// mentions @ts-expect-error in prose\nfoo();",
  ],
  invalid: [
    { code: "// eslint-disable-next-line no-console\nfoo();", errors: 1 },
    { code: "// @ts-expect-error readonly in tests\nstore.user = u;", errors: 1 },
    { code: "/* @ts-ignore */\nfoo();", errors: 1 },
    { code: "// oxlint-disable-next-line no-console\nfoo();", errors: 1 },
  ],
});

tester.run("no-hand-written-presence-check", rules["no-hand-written-presence-check"], {
  valid: [
    "if (isDefined(x)) {}",
    "if (hasValue(name.trim())) {}",
    'if (x === "") {}',
    "if (x === null) {}",
  ],
  invalid: [
    { code: "if (x !== undefined) {}", errors: 1 },
    { code: "if (undefined === x) {}", errors: 1 },
    { code: 'if (typeof x === "undefined") {}', errors: 1 },
    { code: "if (x != null) {}", errors: 1 },
    { code: "if (x == undefined) {}", errors: 1 },
    { code: 'if (name.trim() !== "") {}', errors: 1 },
  ],
});

tester.run("select-all-after-join", rules["select-all-after-join"], {
  valid: [
    'db.selectFrom("club").selectAll().where("id", "=", id);',
    'db.selectFrom("club").innerJoin("member", "member.club_id", "club.id").selectAll("club");',
  ],
  invalid: [
    {
      code: 'db.selectFrom("club").innerJoin("member", "member.club_id", "club.id").selectAll().execute();',
      errors: 1,
    },
    {
      code: 'db.selectFrom("club").selectAll().leftJoin("member", "member.club_id", "club.id");',
      errors: 1,
    },
  ],
});

describe("the baseline ratchet", () => {
  const ratchetTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
  const filename = at("src/features/example/thing.ts");
  const ratcheted = createPlugin({
    "review/no-hand-written-presence-check": { "src/features/example/thing.ts": 1 },
  }).rules["no-hand-written-presence-check"];

  ratchetTester.run("no-hand-written-presence-check (baselined)", ratcheted, {
    valid: [{ code: "if (a !== undefined) {}", filename }],
    invalid: [
      {
        // One more than the baseline allows reports every occurrence
        code: "if (a !== undefined) {} if (b !== undefined) {}",
        filename,
        errors: 2,
      },
      {
        // Fewer than the baseline allows fails until the baseline shrinks
        code: "if (isDefined(a)) {}",
        filename,
        errors: [
          {
            message:
              "lint/baseline.json grandfathers 1 review/no-hand-written-presence-check in this file but it has 0; run `npm run lint:baseline` to shrink the baseline.",
            line: 1,
          },
        ],
      },
      {
        // The allowance is per file
        code: "if (a !== undefined) {}",
        filename: at("src/features/example/other.ts"),
        errors: 1,
      },
    ],
  });
});

describe("clubTypeOf", () => {
  it.each([
    ["src/common/clubType/tv/data.ts", "tv"],
    ["src/features/reviews/components/tv/EpisodeRow.vue", "tv"],
    ["netlify/functions/utils/providers/movieDailyGame.ts", "movie"],
    ["netlify/functions/utils/providers/types.ts", undefined],
    ["src/features/reviews/tvShowSummary.ts", "tv"],
    ["src/common/television.ts", undefined],
  ])("%s is %s code", (file, type) => {
    expect(clubTypeOf(file)).toBe(type);
  });
});
