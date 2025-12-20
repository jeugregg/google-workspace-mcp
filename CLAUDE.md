# CLAUDE.md - @presto-ai/google-workspace-mcp

This file provides project-specific guidance for the Google Workspace MCP server package.

## Project Overview

**@presto-ai/google-workspace-mcp** is an NPM-distributable Model Context Protocol (MCP) server that enables Claude Desktop, Claude Code CLI, and Chatwise to access Google Workspace services (Gmail, Calendar, Drive, Docs, Sheets, Chat).

**Key Design Goal**: Solve the token persistence problem when running MCP servers via `npx` by storing credentials in OS-standard persistent directories instead of ephemeral npm cache locations.

**Architecture**: Dual-mode CLI with interactive authentication (`--auth`) and silent server mode (default).

## Essential Commands

### Development
```bash
npm install              # Install dependencies
npm run build            # Build TypeScript → dist/
npm run dev              # Development mode (if available)
```

### Testing
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Testing the Package Locally
```bash
npm link                 # Create global symlink
google-workspace-mcp --auth        # Test auth mode
google-workspace-mcp               # Test server mode
npm unlink -g @presto-ai/google-workspace-mcp  # Clean up
```

### Publishing
```bash
npm run build            # Ensure clean build
npm publish              # Publish to npm registry
```

## Architecture & Code Structure

### Dual-Mode CLI Design

**Auth Mode** (`--auth` flag):
- Entry: `bin/cli.js` detects `--auth` flag
- Calls: `src/auth-flow.ts` → `AuthManager.authenticate(force=true)`
- Behavior: Interactive OAuth flow in terminal
- Output: Saves tokens to persistent storage
- Exit: `process.exit(0)` after success/failure

**Server Mode** (default):
- Entry: `bin/cli.js` without `--auth` flag
- Checks: `AuthManager.hasValidCredentials()`
- If valid: Starts MCP server normally
- If missing: Prints helpful error, exits with code 1

### Key Files

```
src/
├── index.ts                        # Main MCP server entry point
├── auth-flow.ts                    # Auth mode implementation
├── utils/
│   └── paths.ts                    # OS-standard credential paths
└── auth/
    ├── AuthManager.ts              # Added: hasValidCredentials()
    └── token-storage/              # Modified for persistent paths
        ├── file-token-storage.ts
        └── keychain-token-storage.ts

bin/
└── cli.js                          # CLI entry point (shebang script)

dist/                              # Compiled output
├── index.js
├── auth-flow.js
├── utils/
│   └── paths.js
└── ...
```

### Persistent Storage Paths

Tokens are stored in OS-standard locations:
- **macOS/Linux**: `~/.config/google-workspace-mcp/`
- **Windows**: `%APPDATA%/google-workspace-mcp/`
- **Override**: `GOOGLE_WORKSPACE_MCP_HOME` environment variable

Files stored:
- `token.json` - Encrypted OAuth token (encrypted by keytar/file storage)
- `.master-key` - Encryption master key (for file storage fallback)

## Google Auth Integration

### Credentials Flow

1. **Upstream uses**: `google-auth-library` + `@google-cloud/local-auth`
2. **OAuth endpoints**: Google's standard OAuth 2.0 flow
3. **Token storage**: HybridTokenStorage (keytar → file fallback)
4. **Refresh**: Automatic refresh with 5-minute buffer

### Authentication Methods

- **Local Development**: OAuth browser redirect
- **Production**: Stored/refreshed tokens from persistent storage
- **Keytar**: OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Fallback**: Encrypted file storage if keytar unavailable

## Vendored Upstream Code

This package vendors code from `gemini-cli-extensions/workspace`:
- **Original**: GitHub: https://github.com/gemini-cli-extensions/workspace
- **Purpose**: Direct MCP service implementations (Gmail, Calendar, Drive, etc.)
- **Modifications**: Path resolution only; logic unchanged

**Maintenance**: GitHub Action monitors upstream for updates (weekly check).

## Testing Strategy

### Unit Tests
- **Focus**: Auth flow (hasValidCredentials, token persistence)
- **Location**: `__tests__/unit/`
- **Patterns**: Mock file system, keytar, OAuth flow

### Integration Tests
- **Focus**: CLI modes (--auth and server)
- **Location**: `__tests__/integration/`
- **Patterns**: Temporary directories, real file I/O, process spawning

### Testing Auth Mode
```typescript
// Example: Test hasValidCredentials detection
describe('AuthManager.hasValidCredentials', () => {
  it('should return false when no credentials exist', async () => {
    const authManager = new AuthManager();
    const result = await authManager.hasValidCredentials();
    expect(result).toBe(false);
  });

  it('should return true when valid credentials exist', async () => {
    // Setup: Create mock token.json in temp storage path
    const authManager = new AuthManager();
    const result = await authManager.hasValidCredentials();
    expect(result).toBe(true);
  });
});
```

### Testing Server Mode
```typescript
// Example: Test server startup without credentials
describe('MCP Server startup', () => {
  it('should fail gracefully when no credentials found', async () => {
    // Spawn: google-workspace-mcp (no --auth)
    // Expect: Exit code 1, error message about --auth
  });
});
```

## Environment Variables

### Runtime
- `GOOGLE_WORKSPACE_MCP_HOME` - Override credential storage location (optional)
- `NODE_ENV` - Development/production mode

### Development
- (None required for local testing)

## MCP Server Implementation

### Services Available
The upstream MCP server exposes tools for:
- **Gmail**: Search, read, send, draft management
- **Calendar**: Create, read, update, delete events
- **Drive**: File search, download, metadata
- **Docs**: Read, create, edit documents
- **Sheets**: Read ranges, append data
- **Chat**: Send messages, read threads, create spaces

### MCP Protocol
- **Version**: MCP v1
- **Transport**: stdio (stdin/stdout)
- **Tools**: Exposed via `tools` handler
- **Resources**: File-based for Drive documents

## Package Configuration

### package.json Key Fields
```json
{
  "name": "@presto-ai/google-workspace-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "google-workspace-mcp": "./bin/cli.js"
  },
  "files": [
    "dist/",
    "bin/",
    "README.md"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

### npm Link Testing
Before publishing, test with `npm link`:
```bash
npm run build
npm link                  # Global symlink
npx @presto-ai/google-workspace-mcp --auth
npm unlink -g @presto-ai/google-workspace-mcp
```

## NPM Publishing

### Pre-publish Checklist
- [ ] `npm run build` succeeds without errors
- [ ] `npm link` creates working symlink
- [ ] Auth mode: Opens browser, saves tokens correctly
- [ ] Server mode: Starts without --auth if tokens exist
- [ ] Server mode: Exits gracefully if --auth required

### Publishing Steps
```bash
# 1. Ensure logged in
npm login

# 2. Build
npm run build

# 3. Test locally
npm link
# ... test ...
npm unlink -g @presto-ai/google-workspace-mcp

# 4. Publish
npm publish --access public

# 5. Verify
npm view @presto-ai/google-workspace-mcp
npx @presto-ai/google-workspace-mcp --auth
```

### Version Management
Follow semantic versioning:
- `1.0.0` - Initial release
- `1.0.x` - Bug fixes and token storage improvements
- `1.x.0` - New MCP services, upstream features
- `x.0.0` - Breaking changes (CLI changes, auth flow changes)

## Upstream Synchronization

### GitHub Action
Automated check runs weekly (Monday 00:00 UTC):
- Fetches latest commit from upstream
- Creates issue if new commits detected
- No automatic merge (manual review required)

### Manual Sync Workflow
1. Check upstream: `https://github.com/gemini-cli-extensions/workspace`
2. Review changes
3. Copy modified files to `src/`
4. Re-apply patches (paths.ts changes)
5. Test locally with `npm link`
6. Publish new version

## Common Issues & Solutions

### Development
- **Build fails**: Ensure TypeScript is strict mode compatible
- **Auth mode doesn't open browser**: Check `@google-cloud/local-auth` is installed
- **Tokens not persisting**: Verify storage path permissions (fs.mkdirSync)
- **Keytar errors on Linux**: Install system dependencies (libsecret-1-dev)

### Testing
- **Temp directory cleanup**: Use jest cleanup hooks
- **File system mocking**: Mock fs module or use temp directories
- **Process spawning**: Use child_process.spawn for CLI testing

### Publishing
- **403 Forbidden**: Verify npm login and organization access
- **Version already published**: Increment version number
- **Missing files**: Check .npmignore and package.json files array

## Response Constraints
- Do not remove existing code unless necessary
- Do not remove comments or commented-out code unless necessary
- Do not change code formatting unless important for new functionality
- Maintain existing logging patterns and structured log format

## Maintenance Guidelines

Update this file when:
- [ ] Adding new MCP services
- [ ] Changing authentication flow
- [ ] Modifying storage paths or structure
- [ ] Updating publishing procedures
- [ ] Discovering new patterns or best practices
