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

## Database Migrations

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
