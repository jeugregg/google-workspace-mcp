# @presto-ai/google-workspace-mcp

NPM-distributable Google Workspace MCP server for Claude Desktop, Claude Code CLI, and Chatwise.

## Quick Start

### 1. Authenticate

```bash
npx @presto-ai/google-workspace-mcp --auth
```

This opens your browser to authorize Google Workspace access. Your credentials will be saved securely.

### 2. Configure Your MCP Client

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["-y", "@presto-ai/google-workspace-mcp"]
    }
  }
}
```

#### Claude Code CLI

Edit `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["-y", "@presto-ai/google-workspace-mcp"]
    }
  }
}
```

#### Chatwise

Configure server command in settings:
```
npx -y @presto-ai/google-workspace-mcp
```

### 3. Restart Your MCP Client

Your credentials are stored securely in:
- **macOS/Linux**: `~/.config/google-workspace-mcp/`
- **Windows**: `%APPDATA%/google-workspace-mcp/`

## Features

- **Gmail**: Search, read, send, draft management
- **Google Calendar**: Create, read, update, delete events
- **Google Drive**: File search, download, metadata
- **Google Docs**: Read, create, edit documents
- **Google Sheets**: Read ranges, append data
- **Google Chat**: Send messages, read threads, create spaces

## Troubleshooting

### "No valid credentials found"

Run authentication again:
```bash
npx @presto-ai/google-workspace-mcp --auth
```

### Token refresh errors

Delete the credentials and re-authenticate:
```bash
rm -rf ~/.config/google-workspace-mcp  # macOS/Linux
rmdir %APPDATA%\google-workspace-mcp   # Windows

npx @presto-ai/google-workspace-mcp --auth
```

### Server won't start

1. Ensure you've run `--auth` first
2. Check that credentials file exists in your config directory
3. Verify file permissions (should be readable by your user)

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines and architecture details.

## License

MIT - See [LICENSE](./LICENSE)

## Credits

Based on [gemini-cli-extensions/workspace](https://github.com/gemini-cli-extensions/workspace)
