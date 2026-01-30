# Preview Database System

This project uses isolated preview databases for deploy previews and local development to prevent database migration conflicts.

## Prerequisites

### For Local Development

- **AWS S3 Access**: Required for backup/restore operations
- **Environment Variables**: `AWS_ACCESS_KEY_COCKROACH_BACKUP` and `AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP`

### For Netlify Deploy Previews

**No manual setup required!** The Netlify build plugin automatically handles everything, as long as the AWS credentials are set in Netlify environment variables.

## Overview

When multiple developers or PRs have schema migrations, they can conflict if all using the same dev database. This system creates isolated database forks using CockroachDB's native BACKUP and RESTORE:

- **PR Preview Databases** (`pr_123`): Auto-created for deploy previews with migrations
- **Developer Databases** (`dev_alice_feature`): Personal dev databases for isolated work
- **Shared Dev Database** (`dev`): Main development database (protected)

## How It Works

The system uses CockroachDB's native BACKUP and RESTORE commands with S3 storage:

1. **Snapshot Creation**: `npm run db:snapshot` backs up the dev database to S3
2. **Database Spawn**: `npm run db:spawn` restores from the latest S3 snapshot to create a new database
3. **Fast & Reliable**: Uses CockroachDB's optimized backup/restore (much faster than row-by-row copying)
4. **S3 Storage**: Snapshots stored in `s3://movie-club-crdb-dev-exports`

## For Developers

### Creating Database Snapshots

Before developers can spawn new databases, you need to create a snapshot:

```bash
npm run db:snapshot              # Snapshot 'dev' database (default)
npm run db:snapshot prod         # Snapshot 'prod' database
```

This creates a backup in S3 that can be used to quickly spawn new databases.

**Note:** You should create new snapshots periodically (e.g., weekly or when significant data changes occur) to keep spawned databases up-to-date.

### Creating a Personal Development Database

Spawn a new database from the latest snapshot to work on features with migrations in isolation:

```bash
npm run db:spawn my-feature-name
```

This:

1. Finds the latest snapshot in S3
2. Restores it to `dev_{your_username}_my-feature-name`
3. Optionally updates your `.env` file

**Much faster than the old fork approach!** Typically completes in seconds rather than minutes.

### Listing All Databases

See all databases and their metadata:

```bash
npm run db:list
```

**Note:** CockroachDB Serverless doesn't expose individual database sizes, so size information is not displayed.

Output shows:

- Database names grouped by type (Production, Development, PR Previews, Personal, Other)
- Creation dates and owners
- PR numbers for preview databases

### Cleaning Up Your Database

When done with your feature:

```bash
npm run db:cleanup my-feature-name
```

This will:

1. Show what will be deleted
2. Ask for confirmation
3. Drop the database
4. Offer to restore `.env` to use dev database

**Other cleanup options:**

```bash
# Delete specific database by full name
npm run db:cleanup dev_cole_my-feature

# Delete all databases older than 7 days (with confirmation)
npm run db:cleanup --older-than 7

# Delete databases matching a pattern
npm run db:cleanup --pattern "^dev_cole_"

# Dry run to see what would be deleted
npm run db:cleanup --older-than 7 --dry-run

# Restore .env to use dev database
npm run db:cleanup --restore-env
```

### Development Workflow

**Option 1: Use shared dev database (no migrations)**

```bash
# Just work normally
npm run dev
```

**Option 2: Use personal database (with migrations)**

```bash
# 1. Spawn a database from latest snapshot
npm run db:spawn my-feature

# 2. Update .env when prompted (or manually)

# 3. Run migrations
npm run migrate:dev

# 4. Develop normally
npm run dev

# 5. When done, clean up
npm run db:cleanup my-feature
```

**Option 3: Update the snapshot (for maintainers)**

```bash
# When dev database has significant changes, create a new snapshot
npm run db:snapshot

# Developers can now spawn from this updated snapshot
```

## For Deploy Previews (Automated)

### How It Works

When you open a PR that changes schema migration files:

1. **Netlify build plugin detects migrations** via git diff
2. **Finds latest snapshot** in S3
3. **Restores snapshot** to create preview database `pr_{number}`
4. **Runs migrations** against preview database
5. **Deploy uses isolated database** - no conflicts!
6. **Auto-cleanup** when PR closes/merges

**No PostgreSQL tools installation needed!** Uses CockroachDB's native BACKUP/RESTORE.

### PR Without Migrations

If your PR doesn't touch `migrations/schema/`, it uses the shared `dev` database (no fork needed).

### Manual Trigger

Add `preview-db` label to your PR to force preview database creation even without detected migrations.

## Cleanup Mechanisms

### 1. PR Close Webhook

- **When**: PR is closed or merged
- **What**: Drops `pr_{number}` database immediately
- **Where**: `netlify/functions/cleanup-preview-db.ts`

To set up the webhook in Netlify:

1. Go to Site Settings → Build & Deploy → Deploy notifications
2. Add notification: "Outgoing webhook"
3. Event: "Deploy succeeded" and "Deploy locked"
4. URL: `https://your-site.netlify.app/.netlify/functions/cleanup-preview-db`

### 2. Scheduled Cleanup (GitHub Actions)

- **When**: Daily at 2 AM UTC
- **What**: Drops databases older than 7 days
- **Where**: `.github/workflows/cleanup-stale-dbs.yml`

Catches orphaned databases from:

- Failed builds
- Webhook failures
- Manually created databases

### 3. Manual Cleanup

Developers can clean up databases anytime:

```bash
npm run db:cleanup --older-than 7
npm run db:cleanup --pattern "^dev_"
```

### 4. S3 Snapshot Cleanup

S3 snapshots are **not** automatically deleted. You should manually clean up old snapshots when you have more than 5.

The `db:snapshot` script will warn you when you exceed 5 snapshots. To clean up:

1. Go to S3 bucket: `movie-club-crdb-dev-exports`
2. Delete old snapshot directories (keep the 5 most recent)

## Protected Databases

These databases **cannot** be deleted:

- `dev` - Main development database
- `prod` - Production database
- `defaultdb` - PostgreSQL default
- `postgres` - PostgreSQL system
- `system` - CockroachDB system

## Database Naming Convention

- `dev` - Main shared development database
- `pr_{number}` - Preview database for PR #{number}
- `dev_{username}_{feature}` - Personal dev database
- Lowercase, alphanumeric, underscores, and hyphens only
- Max 63 characters

## Metadata Tracking

Databases store metadata as comments:

```json
{
  "created_at": "2026-01-30T12:00:00Z",
  "created_by": "cole",
  "pr_number": 123,
  "branch": "feature-branch"
}
```

Used for:

- Tracking database age
- Identifying owner
- Linking to PRs
- Automated cleanup decisions

## Architecture Details

### Core Scripts

- **`scripts/db-snapshot.ts`**: Creates S3 backups
  - Uses CockroachDB's `BACKUP` command
  - Stores in `s3://movie-club-crdb-dev-exports`
  - Warns when > 5 snapshots exist
  - Supports any database (dev, prod, etc.)

- **`scripts/db-spawn.ts`**: Creates database from snapshot
  - Uses CockroachDB's `RESTORE` command
  - Finds latest snapshot in S3
  - Much faster than old row-by-row copying
  - Sets metadata comment
  - Returns new connection string

- **`scripts/db-list.ts`**: Lists databases
  - Queries PostgreSQL system tables
  - Parses metadata from comments
  - Groups by type (dev, PR, personal)
  - Formats output nicely

- **`scripts/db-cleanup.ts`**: Cleanup databases
  - Multiple filter options (name, pattern, age)
  - Safety checks (protected databases)
  - Requires confirmation
  - Can restore `.env`

### Netlify Build Plugin

Location: `netlify/plugins/preview-database/`

Hooks:

- **onPreBuild**: Detect migrations, spawn database from snapshot
- **onSuccess**: Log database info
- **onError**: Optional cleanup on failure

Detection: `git diff --name-only origin/main...HEAD | grep "^migrations/schema/"`

### Environment Variables

Required for all scripts and builds:

- `DATABASE_URL`: PostgreSQL connection string
- `AWS_ACCESS_KEY_COCKROACH_BACKUP`: AWS access key for S3 backups
- `AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP`: AWS secret key for S3 backups

GitHub Actions also needs:

- `DATABASE_URL`: Set as repository secret
- AWS credentials: Set as repository secrets

## Cost Considerations

### CockroachDB Serverless

- **Storage**: Per GB-month (~$0.50/GB)
- **Compute**: Per Request Unit

Creating preview databases increases storage usage. Mitigation:

- Only creates DBs for PRs with migrations (not every PR)
- Aggressive cleanup (PR close + 7-day threshold)
- Protected databases prevent accidents

Example: Dev DB = 500MB, 3 active PRs = ~2GB total = ~$1/month

### S3 Storage

- **Storage**: ~$0.023/GB-month (S3 Standard)
- **Requests**: Minimal cost for BACKUP/RESTORE operations

S3 snapshots add minimal cost. Mitigation:

- Keep only last 5 snapshots (~2.5GB if dev is 500MB)
- Manual cleanup of old snapshots
- S3 lifecycle rules (optional)

Example: 5 snapshots × 500MB = 2.5GB × $0.023 = ~$0.06/month

## Troubleshooting

### "No snapshots found"

**Problem:** Trying to spawn a database but no snapshot exists.

**Solution:** Create a snapshot first:

```bash
npm run db:snapshot
```

### "Database already exists"

Another PR or developer is using that name. For PRs, close and reopen. For dev:

```bash
npm run db:cleanup old-feature-name
npm run db:spawn new-feature-name
```

### "AWS credentials not set"

**Problem:** Missing S3 credentials in environment.

**Solution:** Add to `.env` file:

```bash
AWS_ACCESS_KEY_COCKROACH_BACKUP=your_access_key
AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP=your_secret_key
```

### "Cannot connect to database"

Check `DATABASE_URL` in `.env`:

```bash
# Should point to your target database
cat .env | grep DATABASE_URL
```

### Preview database not created

1. Check build logs for migration detection
2. Ensure migrations are in `migrations/schema/`
3. Check git diff includes migration files
4. Try adding `preview-db` label to PR
5. Verify AWS credentials are set in Netlify

### Cleanup webhook not working

1. Verify webhook URL in Netlify settings
2. Check function logs in Netlify dashboard
3. Test manually: `npm run db:cleanup pr_123 --force`

### Restore is slow

**Problem:** S3 restore taking longer than expected.

**Possible causes:**

- Large database snapshot
- Network latency to S3
- CockroachDB cluster performance

**Solutions:**

- Check snapshot size in S3
- Consider creating smaller snapshots if possible
- Still much faster than old row-by-row copying!

## FAQ

**Q: How often should I create snapshots?**
A: Weekly or when dev database has significant data changes. Spawned databases will reflect the snapshot state.

**Q: Can I snapshot production?**
A: Yes! `npm run db:snapshot prod` - useful for testing with production-like data.

**Q: Can I force a preview database for testing?**
A: Yes, add the `preview-db` label to your PR.

**Q: What happens if I delete the dev database?**
A: It's protected - scripts will refuse. If you bypass protection, recreate it and run migrations.

**Q: Can I share my personal database with another developer?**
A: Yes, share your `DATABASE_URL`. Or they can spawn their own from the same snapshot.

**Q: How do I spawn from a specific (not latest) snapshot?**
A: Currently not supported via CLI. Modify `db-spawn.ts` to specify a snapshot path, or manually use CockroachDB's `RESTORE` command.

**Q: Do snapshots include all data?**
A: Yes, except tables with `exclude_data_from_backup` parameter set.

**Q: Can I automate snapshot creation?**
A: Yes, add a scheduled job (cron, GitHub Actions, etc.) to run `npm run db:snapshot`.

## Next Steps

1. **Ensure AWS credentials are set**:
   - Local: Add to `.env` file
   - Netlify: Add to environment variables
   - GitHub Actions: Add as repository secrets

2. **Create initial snapshot**:

   ```bash
   npm run db:snapshot
   ```

3. **Test the system**:

   ```bash
   # Spawn a test database
   npm run db:spawn test-feature

   # List it
   npm run db:list

   # Clean it up
   npm run db:cleanup test-feature
   ```

4. **Set up Netlify webhook** for auto-cleanup on PR close

5. **Create a PR with migrations** to test preview database creation

6. **Monitor usage**:
   - CockroachDB: Database storage and compute
   - S3: Snapshot storage (keep last 5)

## Support

Questions? Check:

- This documentation
- Script help: Run scripts without arguments for usage info
- Build logs in Netlify dashboard
- Database list: `npm run db:list`
