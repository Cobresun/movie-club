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

To handle database migrations, use the following:

- `migrate`: Executes schema migrations and runs code generation.
- `migrate:down`: Reverts the last schema migration and runs code generation.
- `migrate:data`: Handles data migrations.
- `codegen`: Generates types and queries based on the current database schema.

To run these migrations, you need a local `.env` file with the necessary environment variables. The `.env` file can be found in the Cobresun Notion.

Migration scripts should be placed in the `migrations/schema` directory and named using the following convention: `<dateISO>_<yourchanges>`, e.g., `20240201_AddClubTable`.

### Running Migrations

- **Applying Migrations:**
  ```
  npm run migrate
  ```
- **Reverting the Last Migration:**
  ```
  npm run migrate:down
  ```
- **Handling Data Migrations:**
  ```
  npm run migrate:data -- <YourDataMigration>
  ```
- **Generating Code Based on Current Schema:**
  ```
  npm run codegen
  ```

Make sure to have the `.env` file set up correctly before running migrations. For details on the required environment variables, check the Cobresun Notion.
