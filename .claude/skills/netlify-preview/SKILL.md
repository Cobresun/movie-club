---
name: netlify-preview
description: Get the Netlify deploy preview URL for the current git branch. Use when the user asks for "preview link", "deploy preview URL", "Netlify preview", "preview site", "what's the deploy URL", "check the deploy", or needs to access the deployed version of their current branch. Also use when testing changes in a browser or sharing a preview with others.
---

# Netlify Deploy Preview

Get the deploy preview URL for the current git branch.

## Workflow

Execute the following command chain to retrieve the deploy preview URL:

```bash
SITE_ID=$(netlify status | grep "Project Id:" | awk '{print $NF}') && \
BRANCH=$(git branch --show-current) && \
DEPLOY_URL=$(netlify api listSiteDeploys --data "{\"site_id\": \"$SITE_ID\"}" | \
  jq -r "[.[] | select(.branch == \"$BRANCH\" and .context == \"deploy-preview\")] | .[0] | .deploy_ssl_url") && \
if [ "$DEPLOY_URL" = "null" ] || [ -z "$DEPLOY_URL" ]; then \
  echo "No deploy preview found for branch '$BRANCH'. Deploy previews are created when you open a pull request."; \
else \
  echo "Deploy preview: $DEPLOY_URL"; \
fi
```

## Interpreting Results

**Success:** URL returned in format `https://deploy-preview-{PR_NUMBER}--{SITE_NAME}.netlify.app`
- Present as clickable link
- Include branch name for context

**No deploy found:** Message indicates no preview exists
- Common when PR hasn't been created yet
- Suggest opening a PR on GitHub

**Main/master branch:** These deploy to production, not previews
- Use `netlify status` to get production URL instead
- Explain that previews are for feature branches

## Error Handling

If the command fails:

1. **Check Netlify linking:** Run `netlify status` to verify project is linked
2. **Verify git repository:** Ensure working in a git repository with `git status`
3. **Check permissions:** Ensure Netlify CLI is authenticated with `netlify status`

## Output Format

Present results clearly:

```
Deploy preview for branch `{branch-name}`:
🔗 {deploy-url}

State: {ready|building|error}
Created: {timestamp}
```

For branches without previews:

```
No deploy preview found for branch `{branch-name}`.

Deploy previews are created automatically when you open a pull request on GitHub.
To create a PR: `gh pr create`
```

## Additional Information

- Deploy previews are automatically created by Netlify when PRs are opened
- The most recent deploy for a branch is returned
- URLs use HTTPS by default (`deploy_ssl_url`)
- Context "deploy-preview" distinguishes from production and branch deploys
