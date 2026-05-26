# Homey MCP Server

## Project overview
Node.js MCP (Model Context Protocol) server that connects Claude to a Homey Pro home automation hub. Exposes Homey's flows, devices, zones, folders, and variables as tools that Claude can call.

## Key files
- `index.js` — the entire server (single file)
- `package.json` — dependencies (node-fetch, @modelcontextprotocol/sdk)

## Environment variables (set externally, not in code)
- `HOMEY_HOST` — public hostname of the Homey hub (e.g. your-homey.example.com)
- `HOMEY_TOKEN` — Homey API bearer token

## How to restart the server
The server runs as an MCP server registered in Claude Desktop's config. To pick up code changes, restart Claude Desktop (quit and reopen). No separate process to manage.

## API patterns
- All Homey API calls go through the `homeyFetch(path)` helper — never call fetch directly
- Homey endpoints return either an object keyed by ID or an array — always use `toArray(data)` or `toMap(data)` helpers to normalise
- All tools return `{ content: [{ type: "text", text: JSON.stringify(...) }] }`
- Errors are caught and returned as `{ content: [...], isError: true }` — never throw out of the switch

## Available tools (current)
- `list_advanced_flows` — lists all advanced flows with id, name, folder, enabled, broken
- `get_advanced_flow` — gets one flow by ID including all cards and connections
- `get_flows_by_ids` — gets multiple flows by ID array in one call (preferred over repeated single fetches)
- `get_all_advanced_flows` — full dump of all flows (large, avoid unless necessary)
- `list_flows` — standard (basic) flows
- `list_devices` — all devices with name, zone, class, capabilities
- `list_zones` — zone hierarchy
- `list_folders` — advanced flow folder names and IDs
- `list_variables` — all logic variables with name, type, current value

## Coding conventions
- ES modules throughout (`import`/`export`) — do not use `require()`
- No TypeScript — plain JS only
- Keep all tools in the single `index.js` file
- Tool descriptions should be written as if explaining to an AI what the tool is for and when to use it
- Version bump `package.json` and the server `version` field in the `Server` constructor whenever tools are added or changed