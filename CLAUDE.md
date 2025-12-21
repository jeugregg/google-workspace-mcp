# CLAUDE.md - @presto-ai/google-workspace-mcp

## Project Overview

**This is a minimal npm distribution wrapper** for the upstream [gemini-cli-extensions/workspace](https://github.com/gemini-cli-extensions/workspace) Google Workspace MCP server.

**Purpose**: Enable easy installation via `npx @presto-ai/google-workspace-mcp` for employees to access Google Workspace services (Gmail, Calendar, Drive, Docs, Sheets, Chat) from Claude Desktop/Code.

**Philosophy**: This project is a glorified shim and CI/CD pipeline. We do NOT maintain custom code - we simply package upstream for npm distribution.

## What This Project Does

1. **Syncs source from upstream** - All code in `src/` comes directly from `gemini-cli-extensions/workspace`
2. **Customizes paths.ts only** - Changes token storage to `~/.config/google-workspace-mcp/` instead of project root
3. **Publishes to npm** - Makes it installable via `npx`

## What This Project Does NOT Do

- No custom tests (upstream handles testing)
- No custom linting infrastructure
- No custom features or modifications
- No divergence from upstream behavior

## Essential Commands

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript → dist/
npm link             # Test locally
google-workspace-mcp --auth  # Authenticate
```

## Project Structure

```
google-workspace-mcp/
├── .github/workflows/
│   ├── publish.yml           # Publishes to npm on GitHub release
│   └── sync-and-publish.yml  # Daily sync from upstream
├── bin/
│   └── cli.js                # Entry point (shebang script)
├── src/                      # SYNCED FROM upstream (do not modify)
│   └── utils/
│       └── paths.ts          # ONLY file we customize
├── dist/                     # Built output (gitignored)
├── esbuild.config.js         # From upstream
├── package.json              # Our npm config
└── README.md
```

## The One Customization: paths.ts

We override `src/utils/paths.ts` to store tokens in a persistent user config directory:

- **macOS/Linux**: `~/.config/google-workspace-mcp/`
- **Windows**: `%APPDATA%/google-workspace-mcp/`
- **Override**: `GOOGLE_WORKSPACE_MCP_HOME` environment variable

This is necessary because `npx` runs from ephemeral cache directories.

## CI/CD Workflows

### 1. Upstream Sync (`.github/workflows/sync-and-publish.yml`)

- **Runs**: Daily at 6 AM UTC + manual trigger
- **Does**:
  1. Checks for new commits in upstream
  2. Copies source files from `upstream/main:workspace-server/src/`
  3. Applies our custom `paths.ts`
  4. Bumps patch version
  5. Creates GitHub release (triggers publish)

### 2. npm Publish (`.github/workflows/publish.yml`)

- **Runs**: On GitHub release creation
- **Does**: `npm ci && npm run build && npm publish`
- **Auth**: Uses OIDC trusted publishing (no npm tokens stored)

## Upstream Sync Details

The sync workflow tracks the last synced commit in `.last-upstream-sync`. When upstream has new commits:

1. Deletes current `src/` directory
2. Copies fresh files via `git show upstream/main:workspace-server/src/...`
3. Writes our custom `paths.ts` (hardcoded in workflow)
4. Commits with version bump
5. Creates release to trigger npm publish

## Local Development

```bash
# Clone and setup
git clone https://github.com/jrenaldi79/google-workspace-mcp.git
cd google-workspace-mcp
npm install

# Build and test
npm run build
npm link
google-workspace-mcp --auth   # Opens browser for OAuth
google-workspace-mcp          # Runs MCP server

# Cleanup
npm unlink -g @presto-ai/google-workspace-mcp
```

## Manual Upstream Sync

If you need to sync manually:

```bash
git fetch upstream
git show upstream/main:workspace-server/src/index.ts > src/index.ts
# ... (repeat for other files)
# Keep our custom paths.ts
npm run build
npm link
# Test, then commit and push
```

## Publishing

Publishing happens automatically when:
1. Sync workflow detects upstream changes → creates release
2. Release creation triggers publish workflow

Manual publish (rare):
```bash
npm run build
npm publish --access public
```

## Response Constraints for Claude

When working on this project:

- **DO NOT add tests** - upstream handles testing
- **DO NOT add linting** - keep it minimal
- **DO NOT modify src/ files** - they're synced from upstream
- **ONLY modify paths.ts** if token storage behavior needs to change
- **Keep CI/CD simple** - just sync and publish

## Maintenance

This file should be updated when:
- [ ] Changing the sync workflow
- [ ] Changing the publish workflow
- [ ] Changing the paths.ts customization
- [ ] Adding new workflows
