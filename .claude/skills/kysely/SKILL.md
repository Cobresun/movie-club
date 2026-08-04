---
name: kysely
description: Kysely v0.27 query builder patterns with CockroachDB dialect. Use for any database queries, repository classes, or schema migrations.
---

# Kysely — Project Reference

**Version:** Kysely v0.27.6 with `@cubos/kysely-cockroach` dialect.

**Always consult [kysely.dev](https://kysely.dev) for full API reference.**

---

## Database Connection

Singleton in `netlify/functions/utils/database.ts`. Uses `pg` Pool with CockroachDB dialect, typed as `Kysely<DB>` from generated types.

**Generated types:** `lib/types/generated/db.ts` (auto-generated via `npm run codegen` / kysely-codegen).

**Key type helpers:**

- `Generated<T>` — column with database-generated default (optional on insert)
- `Int8` — CockroachDB bigint (string on select, accepts number/string/bigint on insert)
- `Timestamp` — Date on select, accepts Date or string on insert
- `Json` — JSON column (use `JSON.stringify()` on insert, cast on select)

---

## Query Execution Methods

| Method                      | Returns                     | Use when                   |
| --------------------------- | --------------------------- | -------------------------- |
| `execute()`                 | Array of rows               | Expecting multiple results |
| `executeTakeFirst()`        | Single row or `undefined`   | Optional single result     |
| `executeTakeFirstOrThrow()` | Single row (throws if none) | Required single result     |

---

## SELECT Patterns

```typescript
// Basic select all
db.selectFrom("club").selectAll().where("slug", "=", slug).executeTakeFirst();

// Specific columns with aliases
db.selectFrom("club").select(["club.id as club_id", "club.name as club_name", "club.slug"]);

// Aggregate functions
db.fn.agg<string[]>("array_agg", ["genre_name"]).distinct().as("genres");

// Dynamic WHERE (queries are immutable — reassign)
let query = db.selectFrom("club").select("id").where("slug", "=", slug);
if (isDefined(excludeId)) {
  query = query.where("id", "!=", excludeId);
}
```

---

## JOIN Patterns

```typescript
// Inner join
.innerJoin("club_member", "club_member.club_id", "club.id")

// Left join (preserves all left rows)
.leftJoin("movie_details", "movie_details.external_id", "work.external_id")
```

Always prefix column names with table when joining: `"club.id"`, `"club_member.club_id"`.

---

## Common Table Expressions (WITH)

Used to pre-aggregate before joining (avoids GROUP BY conflicts):

```typescript
db.with("genres_agg", (qb) =>
    qb.selectFrom("movie_genres")
      .select(["external_id", db.fn.agg<string[]>("array_agg", ["genre_name"]).as("genres")])
      .groupBy("external_id"),
  )
  .with("companies_agg", (qb) => ...)
  .selectFrom("work_list")
  .leftJoin("genres_agg", "genres_agg.external_id", "movie_details.external_id")
  // ...
```

---

## INSERT Patterns

```typescript
// Basic insert with returning
db.insertInto("club").values({ name, slug }).returning(["id", "slug"]).executeTakeFirst();

// Multi-row insert
db.insertInto("movie_genres").values(genres.map(g => ({ external_id, genre_name: g.name }))).execute();

// Upsert — ON CONFLICT with named constraint
db.insertInto("work").values({...})
  .onConflict(oc => oc.constraint("uq_club_id_type_external_id").doUpdateSet({ club_id: clubId }))
  .returning("id").executeTakeFirstOrThrow();

// Upsert — ON CONFLICT with columns
db.insertInto("club_settings").values({...})
  .onConflict(eb => eb.columns(["club_id", "key"]).doUpdateSet({ value: JSON.stringify(merged) }))
  .execute();

// Skip on conflict
.onConflict(oc => oc.columns(["external_id", "genre_name"]).doNothing())
```

---

## UPDATE Patterns

```typescript
// Basic update
db.updateTable("club").set({ name }).where("id", "=", clubId).executeTakeFirst();

// Multiple set calls
db.updateTable("review")
  .set("score", score)
  .set("created_date", new Date())
  .where("id", "=", id)
  .execute();

// Raw SQL in set (bulk positional update)
db.updateTable("work_list_item")
  .set({ position: sql`CASE work_id ${sql.join(whenClauses, sql` `)} END` })
  .where("list_id", "=", listId)
  .execute();
```

---

## DELETE Patterns

```typescript
db.deleteFrom("club_invite").where("expires_at", "<", now).where("club_id", "=", clubId).execute();
```

---

## Transactions

```typescript
await db.transaction().execute(async (trx) => {
  // SELECT FOR UPDATE to lock row
  const row = await trx
    .selectFrom("awards_temp")
    .select("data")
    .where("club_id", "=", clubId)
    .forUpdate()
    .executeTakeFirst();

  // All queries in transaction use `trx`, not `db`
  await trx
    .updateTable("awards_temp")
    .set({ data: JSON.stringify(newData) })
    .where("club_id", "=", clubId)
    .execute();
});
// Implicit commit on success, implicit rollback on throw
```

---

## Subqueries with Expression Builder

```typescript
import { expressionBuilder } from "kysely";

function systemListId(
  clubId: string,
  systemType: WorkListSystemType,
): ValueExpression<DB, "work_list_item", string> {
  const eb = expressionBuilder<DB, "work_list_item">();
  return eb
    .selectFrom("work_list")
    .where("club_id", "=", clubId)
    .where("system_type", "=", systemType)
    .select("id");
}

// Use as value in WHERE
.where("work_list_item.list_id", "=", systemListId(clubId, WorkListSystemType.reviews))
```

---

## Raw SQL

```typescript
// Typed raw expression
sql<number>`COALESCE(MAX(position), 0) + 1`.as("next_position");

// Existence check
sql<number>`1`.as("exists");

// Identifier escaping (for DDL)
await sql`DROP DATABASE IF EXISTS ${sql.id(dbName)}`.execute(db);

// Multi-line raw SQL (migrations)
await sql`ALTER TABLE club ADD CONSTRAINT club_slug_format_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')`.execute(
  db,
);
```

---

## Migration Patterns

**Location:** `migrations/schema/`. Naming: `YYYYMMDD_Description.ts`.

**Structure:**

```typescript
import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) { ... }
export async function down(db: Kysely<unknown>) { ... }
```

**Create table:**

```typescript
await db.schema
  .createTable("club_member")
  .addColumn("club_id", "int8")
  .addColumn("role", "varchar(50)")
  .addPrimaryKeyConstraint("pk_club_member", ["club_id", "user_id"])
  .addForeignKeyConstraint("fk_club_member_club_id", ["club_id"], "club", ["id"], (cb) =>
    cb.onDelete("cascade"),
  )
  .addUniqueConstraint("uq_name", ["col1", "col2"])
  .execute();
```

**Create enum:**

```typescript
await db.schema.createType("club_type").asEnum(["movie", "book"]).execute();
```

**Create index:**

```typescript
await db.schema.createIndex("idx_work_list_club_id").on("work_list").column("club_id").execute();
```

**Alter table:**

```typescript
await db.schema.alterTable("work_list_item").addColumn("position", "integer").execute();
await db.schema
  .alterTable("work_list_item")
  .alterColumn("position", (col) => col.setNotNull())
  .execute();
await db.schema
  .alterTable("work_list_item")
  .alterColumn("position", (col) => col.setDefault(0))
  .execute();
await db.schema.alterTable("work_list_item").dropColumn("old_column").execute();
```

**Backfills go through `withTables`, not raw `sql`.** The migration handle is
`Kysely<unknown>`, so every table name and column reads as untyped — that is a
reason to teach the handle the shape you need, not a reason to drop to a SQL
string. Declare the columns the migration touches (including ones it just added,
which aren't in the generated types yet) and let the query builder check them:

```typescript
type MigrationTables = {
  club: { id: string; created_at: Date | null };
  work_list: { id: string; club_id: string };
  work_list_item: { list_id: string; time_added: Date };
};

const typedDb = db.withTables<MigrationTables>();
const clubs = await typedDb.selectFrom("club").select(["id", "created_at"]).execute();
```

int8 keys come back as strings (gotcha 1), so type them `string`.

Kysely covers more of these than it looks: `UPDATE ... FROM` is `.from()` on an
update, a derived table is a `selectFrom` callback ending in `.as(...)`, and
`UNION ALL` is `.unionAll()` — so a whole backfill like "set each club's
`created_at` to its earliest activity across two tables" stays typed. See
`migrations/schema/20260729_AddObservability.ts` for that query and
`20260721_AddActorPopularity.ts` for a typed bulk `CASE` update.

Reach for raw `sql` only where the builder genuinely can't reach — e.g.
`ADD COLUMN IF NOT EXISTS`, `DROP INDEX ... CASCADE` — and keep it to that one
statement rather than letting it swallow the surrounding data queries.

---

## Commands

```bash
npm run migrate:dev    # Apply migrations (development)
npm run migrate:down   # Revert last migration
npm run codegen        # Regenerate TypeScript types from schema
```

**Always run `npm run codegen` after applying migrations that change the schema.**

---

## Common Gotchas

1. **CockroachDB Int8:** Primary keys are `int8` (bigint), which Kysely returns as `string`. Convert with `String()` or `Number()` as needed.
2. **JSON columns:** typed `Json` (a structural `JsonValue`) in the generated types, so the driver gives you a parsed value, not a string — but one the compiler can't narrow. Insert with `JSON.stringify()`; on the way out, parse with a Zod schema rather than `as MyType`, which asserts a shape nothing checked. (`SettingsRepository` still casts; that's the older pattern, not the one to copy — see `code-quality.md` on `as`.)
3. **Immutable queries:** `.where()` returns a new query — always reassign: `query = query.where(...)`.
4. **Migration types:** Use `Kysely<unknown>` in migration functions, not `Kysely<DB>` — the schema may not match during migration. Then `db.withTables<...>()` for anything that reads or writes rows; `Kysely<unknown>` is not a licence to hand-write SQL strings (see Migrations above).
5. **Named constraints:** Always name constraints (`pk_`, `fk_`, `uq_`, `idx_` prefixes) for debugging and `ON CONFLICT` references.
6. **Aggregate + GROUP BY:** When using multiple aggregates, prefer CTEs (`.with()`) over complex GROUP BY to avoid CockroachDB limitations.
7. **Condense undeployed migrations:** If a PR has multiple schema migrations touching the same table and none have been deployed to production, merge them into a single migration. This avoids unnecessary intermediate states and reduces deployment failure points. Pair data migrations with the same date prefix as their schema migration.
