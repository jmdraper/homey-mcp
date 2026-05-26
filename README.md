# Homey MCP Server for Claude Desktop

Gives Claude Desktop direct access to your Homey advanced flows, devices, and zones.

## Setup

### 1. Install the server

Copy this folder somewhere permanent on your Mac, e.g.:
```
~/homey-mcp/
```

Then install dependencies (only needed once):
```bash
cd ~/homey-mcp
npm install
```

### 2. Configure Claude Desktop

Open (or create) this file:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add the following — replace `YOUR_API_KEY` with your Homey API key:

```json
{
  "mcpServers": {
    "homey": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/homey-mcp/index.js"],
      "env": {
        "HOMEY_HOST": "homey.myserver.me.uk",
        "HOMEY_TOKEN": "YOUR_API_KEY"
      }
    }
  }
}
```

Replace `/Users/YOUR_USERNAME/homey-mcp/index.js` with the actual path where you put this folder.
You can find your username by running `whoami` in Terminal.

If you already have other MCP servers in that config file, just add the `"homey": { ... }` block
inside the existing `"mcpServers"` object.

### 3. Restart Claude Desktop

Quit and reopen Claude Desktop. You should see a hammer/tools icon in the chat interface
indicating the Homey MCP tools are available.

## Available tools

| Tool | Description |
|------|-------------|
| `list_advanced_flows` | List all Advanced Flows with name, status, card counts |
| `get_advanced_flow` | Get full detail of one Advanced Flow by ID |
| `get_all_advanced_flows` | Get full detail of every Advanced Flow |
| `list_flows` | List all standard (basic) Flows |
| `list_devices` | List all devices with zone and capabilities |
| `list_zones` | List all zones/rooms |

## Troubleshooting

- **Tools not appearing:** Check Claude Desktop was fully restarted; check the config JSON is valid
- **API errors:** Verify your API key has `flows` scope enabled in Homey settings
- **Connection errors:** Make sure your Tailscale connection is active when using Claude Desktop
