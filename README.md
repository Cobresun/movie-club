# movie-club

[![Netlify Status](https://api.netlify.com/api/v1/badges/1d88681f-226e-4972-a2bb-1360f2610294/deploy-status)](https://app.netlify.com/sites/awesome-kalam-929708/deploys)

## Project setup

```
npm install
npm i netlify-cli -g
```

When developing if you don't see the Login button on the screen, go into your browser console and execute the following command:

`localStorage.setItem("netlifySiteURL", "https://cobresun-movie-club.netlify.app")`

... then refresh the page.

Also when developing use the `cobresunofficial@gmail.com` account.

### Compiles and hot-reloads for development (including Netlify functions)

```
netlify init (authorize with Cobresun Netlify account)
netlify dev
```

### Compiles and minifies for production

```
npm run build
```

### Lints and fixes files

```
npm run lint
```

## Testing

### Runs tests a single time

```
npm test
```

### Runs tests and hot-reruns tests

```
npm run test:watch
```

### Runs tests and generates a coverage report

```
npm run coverage
```

## Database Management

### Database Migrations

To manage database migrations, the following NPM scripts are used:

- **For Deployment Environment:**
  - `migrate`: Executes schema migrations for the deployment environment without specifying an `.env` file and runs code generation.
- **For Development Environment:**
  - `migrate:dev`: Executes schema migrations in the development environment, requiring the `.env` file, and runs code generation.
  - `migrate:down`: Reverts the last schema migration in the development environment, requiring the `.env` file, and runs code generation.
  - `migrate:data`: Handles data migrations in the development environment, requiring the `.env` file.
- **Code Generation:**
  - `codegen`: Generates types and queries based on the current database schema using the Kysely code generator with PostgreSQL dialect.

Migration scripts should be placed in the `migrations/schema` directory and named following this convention: `<dateISO>_<yourchanges>`, e.g., `20240201_AddClubTable`.

### Running Migrations

- **Applying Migrations for Deployment:**
  ```
  npm run migrate
  ```
- **Applying Migrations for Development:**
  ```
  npm run migrate:dev
  ```
- **Reverting the Last Migration (Development Only):**
  ```
  npm run migrate:down
  ```
- **Handling Data Migrations (Development Only):**
  ```
  npm run migrate:data -- <YourDataMigration>
  ```
- **Generating Code Based on Current Schema:**
  ```
  npm run codegen
  ```

For development migrations, ensure you have the `.env` file set up with the necessary environment variables. The `.env` file details can be found in the Cobresun Notion.

### Managing Personal Development Databases

To avoid migration conflicts when working on features with database schema changes, you can create and manage your own isolated development databases.

#### Prerequisites

- AWS S3 credentials set in your `.env` file:
  ```
  AWS_ACCESS_KEY_COCKROACH_BACKUP=your_access_key
  AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP=your_secret_key
  ```

#### Creating Your Own Database

When working on a feature that requires database migrations:

```bash
# Spawn a new database from the latest snapshot
npm run db:spawn my-feature-name
```

This creates a database named `dev_{your_username}_my-feature-name` and optionally updates your `.env` file to point to it.

#### Development Workflow

**Option 1: Use shared dev database (no migrations)**

```bash
# Just work normally with the shared dev database
npm run dev
```

**Option 2: Use personal database (with migrations)**

```bash
# 1. Create your own database from the latest snapshot
npm run db:spawn my-feature

# 2. Update .env when prompted (or manually set DATABASE_URL)

# 3. Run your migrations
npm run migrate:dev

# 4. Develop normally
npm run dev

# 5. When done, clean up your database
npm run db:cleanup my-feature
```

#### Managing Databases

- **List all databases:**

  ```bash
  npm run db:list
  ```

- **Clean up your database:**

  ```bash
  npm run db:cleanup my-feature-name
  ```

- **Clean up old databases:**

  ```bash
  npm run db:cleanup --older-than 7  # Removes databases older than 7 days
  ```

- **Restore .env to use shared dev database:**
  ```bash
  npm run db:cleanup --restore-env
  ```

#### Creating Database Snapshots (Maintainers)

Snapshots are used as the base for spawning new databases. Maintainers should create new snapshots periodically:

```bash
# Create a snapshot of the dev database
npm run db:snapshot

# Or snapshot a specific database
npm run db:snapshot prod
```

#### Deploy Preview Databases

When you open a PR that modifies database migrations, a preview database is automatically created for your deploy preview. This prevents conflicts with other developers' work. The preview database is automatically cleaned up when the PR is closed or merged.
