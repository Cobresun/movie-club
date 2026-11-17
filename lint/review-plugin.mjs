// Rules for the corrections review keeps sending back (CLAUDE.md, "What review
// sends back"). Each message says what to write instead, because the main
// reader is an agent fixing its own diff.
//
// Existing violations are grandfathered per file and rule in
// lint/baseline.json. A file may not exceed its allowance, and a file that
// drops below it fails until the baseline is regenerated, so the baseline can
// only shrink. Regenerate it with `npm run lint:baseline`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const BASELINE_FILE = "lint/baseline.json";
export const PLUGIN_NAME = "review";

const CLUB_TYPE_ENUMS = new Set(["ClubType", "WorkType"]);
const CLUB_TYPE_VALUES = new Set(["movie", "book", "tv"]);
const JOIN_METHODS = new Set([
  "innerJoin",
  "leftJoin",
  "rightJoin",
  "fullJoin",
  "crossJoin",
  "innerJoinLateral",
  "leftJoinLateral",
  "crossJoinLateral",
]);

function loadBaseline() {
  if (process.env.REVIEW_LINT_BASELINE === "off") return {};
  try {
    return JSON.parse(readFileSync(path.join(ROOT, BASELINE_FILE), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

function relativePath(filename) {
  return path.relative(ROOT, filename).split(path.sep).join("/");
}

// Wraps a rule so its findings are counted against the baseline at the end of
// the file instead of being reported as they are found.
function ratcheted(name, description, create, baseline) {
  return {
    meta: { type: "problem", docs: { description }, schema: [] },
    create(context) {
      const found = [];
      const report = (node, message) => {
        found.push({ node, message });
      };
      const visitors = create(context, report);
      const ownExit = visitors["Program:exit"];
      return {
        ...visitors,
        "Program:exit"(program) {
          if (ownExit) ownExit(program);
          const allowed = baseline[`${PLUGIN_NAME}/${name}`]?.[relativePath(context.filename)] ?? 0;
          if (found.length > allowed) {
            const suffix =
              allowed > 0
                ? ` (${BASELINE_FILE} grandfathers ${allowed} in this file; it now has ${found.length})`
                : "";
            for (const { node, message } of found) {
              if ("type" in node) context.report({ node, message: message + suffix });
              else context.report({ loc: node, message: message + suffix });
            }
          } else if (found.length < allowed) {
            context.report({
              loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
              message: `${BASELINE_FILE} grandfathers ${allowed} ${PLUGIN_NAME}/${name} in this file but it has ${found.length}; run \`npm run lint:baseline\` to shrink the baseline.`,
            });
          }
        },
      };
    },
  };
}

function unwrap(node) {
  let current = node;
  while (
    current.type === "ChainExpression" ||
    current.type === "TSNonNullExpression" ||
    current.type === "ParenthesizedExpression"
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(member) {
  if (member.type !== "MemberExpression") return undefined;
  if (!member.computed && member.property.type === "Identifier") return member.property.name;
  if (member.property.type === "Literal" && typeof member.property.value === "string") {
    return member.property.value;
  }
  return undefined;
}

function calleeName(call) {
  const callee = unwrap(call.callee);
  if (callee.type === "Identifier") return callee.name;
  return propertyName(callee);
}

function isIdentifier(node, name) {
  const inner = unwrap(node);
  return inner.type === "Identifier" && inner.name === name;
}

function isStringLiteral(node) {
  return node.type === "Literal" && typeof node.value === "string";
}

function isClubTypeMember(node) {
  const inner = unwrap(node);
  return (
    inner.type === "MemberExpression" &&
    inner.object.type === "Identifier" &&
    CLUB_TYPE_ENUMS.has(inner.object.name)
  );
}

function isClubTypeLiteral(node) {
  return isStringLiteral(node) && CLUB_TYPE_VALUES.has(node.value);
}

// `type`, `clubType`, `work.type`, `props.workType`, `club.value?.type`
function namesAType(node) {
  const inner = unwrap(node);
  if (inner.type === "Identifier") return /type$/i.test(inner.name);
  const name = propertyName(inner);
  return name !== undefined && /type$/i.test(name);
}

function isClubTypeValue(node, other) {
  return isClubTypeMember(node) || (isClubTypeLiteral(node) && namesAType(other));
}

// The folder or file-name prefix that marks code as one club type's:
// `src/common/clubType/tv/…`, `reviews/components/tv/…`, `providers/movieProvider.ts`.
export function clubTypeOf(relPath) {
  const segments = relPath.split("/");
  const fileName = segments.pop() ?? "";
  for (const segment of segments) {
    if (CLUB_TYPE_VALUES.has(segment)) return segment;
  }
  const match = /^(movie|book|tv)(?=[A-Z])/.exec(fileName);
  return match ? match[1] : undefined;
}

function resolveImport(fromFile, source) {
  if (source.startsWith("@/")) return relativePath(path.join(ROOT, "src", source.slice(2)));
  if (source.startsWith(".")) return relativePath(path.resolve(path.dirname(fromFile), source));
  return undefined;
}

const rules = {
  "no-raw-sql": {
    description: "Raw Kysely `sql` outside the exceptions in .claude/rules/database.md",
    create(_context, report) {
      const local = new Set();
      const inRawSql = (node) => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (
            parent.type === "TaggedTemplateExpression" &&
            parent.tag.type === "Identifier" &&
            local.has(parent.tag.name)
          ) {
            return true;
          }
        }
        return false;
      };
      const message =
        "Raw `sql` is unchecked against the schema: write typed Kysely (eb.fn, eb.case(), eb.ref). For a listed exception in .claude/rules/database.md, add `// oxlint-disable-next-line review/no-raw-sql -- <which exception>`.";
      return {
        ImportDeclaration(node) {
          if (node.source.value !== "kysely") return;
          for (const specifier of node.specifiers) {
            if (
              specifier.type === "ImportSpecifier" &&
              specifier.imported.type === "Identifier" &&
              specifier.imported.name === "sql"
            ) {
              local.add(specifier.local.name);
            }
          }
        },
        TaggedTemplateExpression(node) {
          if (node.tag.type === "Identifier" && local.has(node.tag.name) && !inRawSql(node)) {
            report(node, message);
          }
        },
        MemberExpression(node) {
          if (node.object.type === "Identifier" && local.has(node.object.name) && !inRawSql(node)) {
            report(node, message);
          }
        },
      };
    },
  },

  "no-club-type-branch": {
    description: "Inline club or work type branch outside the registry and providers",
    create(_context, report) {
      const branch =
        "Inline club-type branch: move the variation into the registry (`clubTypeConfig(type).<field>`, a feature `Record<ClubType, …>`) or the backend `MediaProvider` (`getProvider(work.type)`).";
      const fallback =
        "Default club type: wait for the club (`v-if`, `enabled`) and look its type up instead of falling back to a ClubType/WorkType value.";
      return {
        BinaryExpression(node) {
          if (!["===", "!==", "==", "!="].includes(node.operator)) return;
          if (isClubTypeValue(node.left, node.right) || isClubTypeValue(node.right, node.left)) {
            report(node, branch);
          }
        },
        SwitchStatement(node) {
          const typed = node.cases.some(
            (switchCase) =>
              switchCase.test !== null && isClubTypeValue(switchCase.test, node.discriminant),
          );
          if (typed) report(node, branch);
        },
        LogicalExpression(node) {
          if (node.operator !== "??" && node.operator !== "||") return;
          if (isClubTypeValue(node.right, node.left)) report(node, fallback);
        },
      };
    },
  },

  "club-type-boundary": {
    description: "One club type's code importing another club type's code",
    create(context, report) {
      const here = clubTypeOf(relativePath(context.filename));
      const check = (node, source) => {
        if (here === undefined || typeof source !== "string") return;
        const target = resolveImport(context.filename, source);
        if (target === undefined) return;
        const there = clubTypeOf(target);
        if (there !== undefined && there !== here) {
          report(
            node,
            `${here} code imports ${there} code: move what both need into a neutral module with a neutral name.`,
          );
        }
      };
      return {
        ImportDeclaration(node) {
          check(node, node.source.value);
        },
        ExportNamedDeclaration(node) {
          if (node.source) check(node, node.source.value);
        },
        ExportAllDeclaration(node) {
          check(node, node.source.value);
        },
        ImportExpression(node) {
          if (isStringLiteral(node.source)) check(node, node.source.value);
        },
      };
    },
  },

  "test-query-like-a-user": {
    description: "DOM selectors, container access and title/test-id queries in tests",
    create(_context, report) {
      return {
        CallExpression(node) {
          const name = calleeName(node);
          if (name === undefined) return;
          if (/^(querySelector(All)?|getElementsBy\w+|getElementById|closest)$/.test(name)) {
            report(
              node,
              "Query the way a user finds things (getByRole, getByLabelText, getByText); if the element has no role or name, fix the component.",
            );
          } else if (/^(get|query|find)(All)?By(Title|TestId)$/.test(name)) {
            report(
              node,
              `${name} isn't how a user finds things: use getByRole(role, { name }), getByLabelText or getByText.`,
            );
          }
        },
        MemberExpression(node) {
          if (isIdentifier(node.object, "container")) {
            report(node, "Don't reach into `container`: query `screen` by role, label or text.");
          }
        },
      };
    },
  },

  "test-no-style-assertions": {
    description: "Assertions on classes or inline styles",
    create(_context, report) {
      return {
        CallExpression(node) {
          const name = calleeName(node);
          if (name === "toHaveClass" || name === "toHaveStyle") {
            report(
              node,
              `${name} asserts styling: assert what a user perceives instead (role, accessible name, text, aria-pressed/aria-expanded).`,
            );
          }
        },
      };
    },
  },

  "test-env-stubs": {
    description: "vi.unstubAllEnvs() used to fake a missing secret",
    create(_context, report) {
      const inCleanupHook = (node) => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (parent.type === "CallExpression" && calleeName(parent) === "afterEach") return true;
        }
        return false;
      };
      return {
        CallExpression(node) {
          const callee = unwrap(node.callee);
          if (
            callee.type === "MemberExpression" &&
            isIdentifier(callee.object, "vi") &&
            propertyName(callee) === "unstubAllEnvs" &&
            !inCleanupHook(node)
          ) {
            report(
              node,
              'Fake a missing secret with vi.stubEnv(KEY, ""): vi.unstubAllEnvs() restores the real environment, which Netlify populates. Keep unstubAllEnvs in afterEach.',
            );
          }
        },
      };
    },
  },

  "test-no-clipboard-spy": {
    description: "Spying on or replacing navigator.clipboard in a test",
    create(context, report) {
      const message =
        "Read the clipboard instead of spying on it: `await navigator.clipboard.readText()` (render() installs a working clipboard).";
      const mentionsClipboard = (node) => /\bclipboard\b/.test(context.sourceCode.getText(node));
      return {
        CallExpression(node) {
          const callee = unwrap(node.callee);
          const name = calleeName(node);
          const [first, second] = node.arguments;
          if (
            name === "spyOn" &&
            callee.type === "MemberExpression" &&
            first !== undefined &&
            mentionsClipboard(first)
          ) {
            report(node, message);
          } else if (
            name === "defineProperty" &&
            first !== undefined &&
            isIdentifier(first, "navigator") &&
            second !== undefined &&
            isStringLiteral(second) &&
            second.value === "clipboard"
          ) {
            report(node, message);
          }
        },
        AssignmentExpression(node) {
          if (/^navigator\.clipboard\b/.test(context.sourceCode.getText(node.left))) {
            report(node, message);
          }
        },
      };
    },
  },

  "test-no-hand-built-harness": {
    description: "A component defined inside a test to host the code under test",
    create(_context, report) {
      return {
        CallExpression(node) {
          if (calleeName(node) === "defineComponent") {
            report(
              node,
              "Render the real component with render() from @/tests/utils, or call a composable through withSetup(); don't hand-build a defineComponent harness.",
            );
          }
        },
      };
    },
  },

  "no-vue-cast": {
    description: "Type assertions in .vue script blocks, which type-aware lint does not reach",
    create(_context, report) {
      const message =
        "Narrow instead of casting: instanceof, isString()/isRecord() from lib/checks/checks.ts, or a Zod parse (see .claude/rules/code-quality.md).";
      return {
        TSAsExpression(node) {
          // `x as unknown as T` is one cast
          if (node.parent?.type === "TSAsExpression") return;
          const annotation = node.typeAnnotation;
          const isConst =
            annotation.type === "TSTypeReference" &&
            annotation.typeName.type === "Identifier" &&
            annotation.typeName.name === "const";
          if (!isConst) report(node, message);
        },
        TSTypeAssertion(node) {
          report(node, message);
        },
      };
    },
  },

  "no-suppression-comments": {
    description:
      "eslint-disable, @ts-expect-error/@ts-ignore and reasonless oxlint-disable comments",
    create(context, report) {
      return {
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            const text = comment.value.replace(/^[\s*]+/, "");
            if (/^eslint-(disable|enable)/.test(text)) {
              report(
                comment.loc,
                "ESLint doesn't run here, so this comment does nothing: fix the code, or use `// oxlint-disable-next-line <rule> -- <reason>`.",
              );
            } else if (/^@ts-(expect-error|ignore|nocheck)\b/.test(text)) {
              report(
                comment.loc,
                "Don't suppress the compiler: narrow the type, parse with Zod, or fix the declaration it disagrees with.",
              );
            } else if (/^oxlint-disable/.test(text) && !/\s--\s*\S/.test(text)) {
              report(
                comment.loc,
                "Say why: `// oxlint-disable-next-line <rule> -- <reason the rule is wrong here>`.",
              );
            }
          }
        },
      };
    },
  },

  "no-hand-written-presence-check": {
    description: "Hand-written undefined/null/empty-string checks",
    create(_context, report) {
      const isUndefined = (node) =>
        isIdentifier(node, "undefined") ||
        (node.type === "UnaryExpression" && node.operator === "void");
      const isNull = (node) =>
        node.type === "Literal" && node.value === null && node.raw === "null";
      const isTypeofUndefined = (node, other) =>
        node.type === "UnaryExpression" &&
        node.operator === "typeof" &&
        isStringLiteral(other) &&
        other.value === "undefined";
      const isTrimCall = (node) => {
        const inner = unwrap(node);
        return inner.type === "CallExpression" && calleeName(inner) === "trim";
      };
      const isEmptyString = (node) => isStringLiteral(node) && node.value === "";
      return {
        BinaryExpression(node) {
          const { left, right, operator } = node;
          const negated = operator === "!==" || operator === "!=";
          if (["===", "!=="].includes(operator)) {
            if (
              isUndefined(left) ||
              isUndefined(right) ||
              isTypeofUndefined(left, right) ||
              isTypeofUndefined(right, left)
            ) {
              report(
                node,
                `Use ${negated ? "isDefined(x)" : "!isDefined(x)"} from lib/checks/checks.ts instead of comparing with undefined.`,
              );
              return;
            }
            if (
              (isTrimCall(left) && isEmptyString(right)) ||
              (isTrimCall(right) && isEmptyString(left))
            ) {
              report(
                node,
                `Use ${negated ? "hasValue(x.trim())" : "!hasValue(x.trim())"} from lib/checks/checks.ts instead of comparing a trimmed string with "".`,
              );
            }
          } else if (["==", "!="].includes(operator)) {
            if (isNull(left) || isNull(right) || isUndefined(left) || isUndefined(right)) {
              report(
                node,
                `Use ${negated ? "isDefined(x)" : "!isDefined(x)"} from lib/checks/checks.ts instead of a loose null check.`,
              );
            }
          }
        },
      };
    },
  },

  "select-all-after-join": {
    description: "Bare selectAll() in a Kysely chain that joins",
    create(_context, report) {
      // Method names along a fluent chain, both below and above `node`.
      const chainMethods = (call) => {
        const names = [];
        let below = unwrap(call.callee);
        while (below.type === "MemberExpression") {
          const object = unwrap(below.object);
          if (object.type !== "CallExpression") break;
          const name = calleeName(object);
          if (name !== undefined) names.push(name);
          below = unwrap(object.callee);
        }
        let above = call;
        while (
          above.parent?.type === "MemberExpression" &&
          above.parent.object === above &&
          above.parent.parent?.type === "CallExpression" &&
          above.parent.parent.callee === above.parent
        ) {
          above = above.parent.parent;
          const name = calleeName(above);
          if (name !== undefined) names.push(name);
        }
        return names;
      };
      return {
        CallExpression(node) {
          if (calleeName(node) !== "selectAll" || node.arguments.length > 0) return;
          if (unwrap(node.callee).type !== "MemberExpression") return;
          if (chainMethods(node).some((name) => JOIN_METHODS.has(name))) {
            report(
              unwrap(node.callee).property,
              'Name the table: selectAll("<table>") after a join, or joined columns silently shadow base-table columns of the same name.',
            );
          }
        },
      };
    },
  },
};

export function createPlugin(baseline = loadBaseline()) {
  return {
    meta: { name: PLUGIN_NAME },
    rules: Object.fromEntries(
      Object.entries(rules).map(([name, { description, create }]) => [
        name,
        ratcheted(name, description, create, baseline),
      ]),
    ),
  };
}

export const RULE_NAMES = Object.keys(rules);

export default createPlugin();
