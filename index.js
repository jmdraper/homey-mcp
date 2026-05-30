#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

const HOMEY_HOST = process.env.HOMEY_HOST;
const HOMEY_TOKEN = process.env.HOMEY_TOKEN;

if (!HOMEY_HOST || !HOMEY_TOKEN) {
  process.stderr.write("Error: HOMEY_HOST and HOMEY_TOKEN environment variables are required\n");
  process.exit(1);
}

async function homeyFetch(path) {
  const url = `https://${HOMEY_HOST}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${HOMEY_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Homey API error: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

// Normalise Homey API responses — some endpoints return an object keyed by ID,
// others return an array. This always gives back an array.
function toArray(data) {
  return Array.isArray(data) ? data : Object.values(data);
}

// Normalise to an object keyed by ID, for fast ID-based lookup.
function toMap(data) {
  if (!Array.isArray(data)) return data; // already keyed by ID
  return Object.fromEntries(data.map((item) => [item.id, item]));
}

async function companionFetch(path, query = {}, method = "GET") {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null))
  );
  const qs = params.toString() ? `?${params}` : "";
  const url = `https://${HOMEY_HOST}/api/app/com.draper.homey-docs${path}${qs}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${HOMEY_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Companion app error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

const server = new Server(
  { name: "homey-mcp", version: "1.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_advanced_flows",
      description: "List all Advanced Flows from Homey, including their names and IDs",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_advanced_flow",
      description: "Get the full detail of a specific Advanced Flow by ID, including all cards and connections",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The flow ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_flows_by_ids",
      description: "Get the full detail of multiple Advanced Flows by their IDs in a single call. More efficient than calling get_advanced_flow repeatedly. Ideal for fetching 3–6 related flows at once.",
      inputSchema: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of flow IDs to fetch",
          },
        },
        required: ["ids"],
      },
    },
    {
      name: "get_all_advanced_flows",
      description: "Get the full detail of ALL Advanced Flows — use this when you need a complete picture",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_flows",
      description: "List all standard (basic) Flows from Homey. To get full card detail (trigger, conditions, actions) for any flow returned here, call get_basic_flows_by_ids.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_basic_flows_by_ids",
      description: "Get full detail of one or more basic (simple If/Then/Else) flows by ID — trigger, conditions, and actions including all args. Use this when list_flows returns a flow you need to understand. Note: basic flows use a flat structure, not a card graph like advanced flows. Conditions have an 'inverted' field and a 'group' field. Actions have a 'group' field of 'then' or 'else'.",
      inputSchema: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of basic flow IDs to fetch",
          },
        },
        required: ["ids"],
      },
    },
    {
      name: "list_devices",
      description: "List all devices connected to Homey, with their names, zones, and capabilities",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_zones",
      description: "List all zones (rooms/areas) configured in Homey",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_folders",
      description: "List all Advanced Flow folders from Homey, with their names and IDs. Flows include a folder ID — use this to map folder IDs to names and identify which flows belong to a topic area.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_variables",
      description: "List all Homey logic variables with their names, types, and current values. Essential for understanding flow behaviour — variables are used as state flags, counters, and configuration values across flows.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_changelog",
      description: "Get recent Homey changes tracked by the companion app — flow creates/renames/modifications/deletions, device changes, variable changes. Use this to see what has changed since a given date without fetching the full snapshot.",
      inputSchema: {
        type: "object",
        properties: {
          since: {
            type: "string",
            description: "ISO 8601 date-time string. Only return entries after this timestamp. Omit to get all entries.",
          },
          types: {
            type: "array",
            items: { type: "string" },
            description: "Filter by change type(s). Valid values: flow_created, flow_modified, flow_renamed, flow_deleted, flow_enabled, flow_disabled, device_created, device_modified, device_deleted, variable_created, variable_modified, variable_deleted. Omit to get all types.",
          },
        },
      },
    },
    {
      name: "list_flows_metadata",
      description: "List all flows (basic and advanced) with lightweight metadata — name, enabled, broken, card count, hash, folder. Faster than get_all_advanced_flows when you only need an overview rather than full card details.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "clear_changelog",
      description: "Clear all entries from the companion app changelog. Use after the sync skill has processed and documented all pending changes.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_logs",
      description: "Fetch log entries from the Simple (Sys) Log app. Returns entries newest-first. Each entry has: id, timestamp (ISO 8601), severity (integer), app (group name), message.",
      inputSchema: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Case-insensitive substring filter applied to the message field.",
          },
          since: {
            type: "string",
            description: "ISO 8601 datetime — only return entries at or after this timestamp.",
          },
          limit: {
            type: "integer",
            description: "Maximum number of entries to return. Default 100, max 1000.",
          },
        },
      },
    },
    {
      name: "get_app_actions",
      description: "Returns human-readable titles for all triggers, conditions, and actions exposed by each installed Homey app, keyed by their full card ID strings (e.g. homey:app:com.basmilius.flowbits:flag_is). Use this to translate opaque app card IDs in flow diffs into readable labels.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "trigger_sync_complete",
      description: "Trigger the Homey 'sync completed' flow card, firing any flows that use it as a WHEN trigger. Call this at the end of a successful sync.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "poll_now",
      description: "Force the companion app to poll Homey immediately for changes, rather than waiting for the next 5-minute interval. Call this at the start of the sync process to ensure the changelog is up to date.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_cross_references",
      description: "Get a cross-reference index showing which flows use each variable, FlowBits event, label, set, timer, and programmatic flow trigger. Computed from the in-memory snapshot — no additional Homey calls needed. Use to answer 'which flows use variable X?' or 'what fires FlowBits event Y?'.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["variables", "flowbits_events", "flowbits_labels", "flowbits_sets", "timers", "flow_triggers"],
            description: "Filter to a single reference type. Omit to return all types. Use this when you only need one category to reduce response size.",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_advanced_flows": {
        const data = await homeyFetch("/api/manager/flow/advancedflow");
        const flows = toArray(data).map((f) => ({
          id: f.id,
          name: f.name,
          folder: f.folder ?? null,
          enabled: f.enabled,
          broken: f.broken,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(flows, null, 2) }],
        };
      }

      case "get_advanced_flow": {
        const data = await homeyFetch("/api/manager/flow/advancedflow");
        const flowMap = toMap(data);
        const flow = flowMap[args.id];
        if (!flow) throw new Error(`Flow with ID ${args.id} not found`);
        return {
          content: [{ type: "text", text: JSON.stringify(flow, null, 2) }],
        };
      }

      case "get_flows_by_ids": {
        const ids = args.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
          throw new Error("ids must be a non-empty array of flow ID strings");
        }
        // Fetch all flows once, then extract just the requested ones.
        // This avoids multiple round trips while keeping the response well under the 1MB limit.
        const data = await homeyFetch("/api/manager/flow/advancedflow");
        const flowMap = toMap(data);
        const results = ids.map((id) => {
          const flow = flowMap[id];
          if (!flow) return { id, error: `Flow not found` };
          return flow;
        });
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "get_all_advanced_flows": {
        const data = await homeyFetch("/api/manager/flow/advancedflow");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "list_flows": {
        const data = await homeyFetch("/api/manager/flow/flow");
        const flows = toArray(data).map((f) => ({
          id: f.id,
          name: f.name,
          enabled: f.enabled,
          broken: f.broken,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(flows, null, 2) }],
        };
      }

      case "get_basic_flows_by_ids": {
        const ids = args.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
          throw new Error("ids must be a non-empty array of flow ID strings");
        }
        const data = await homeyFetch("/api/manager/flow/flow");
        const flowMap = toMap(data);
        const results = ids.map((id) => {
          const flow = flowMap[id];
          if (!flow) return { id, error: "Flow not found" };
          return flow;
        });
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "list_devices": {
        const data = await homeyFetch("/api/manager/devices/device");
        const devices = toArray(data).map((d) => ({
          id: d.id,
          name: d.name,
          zone: d.zoneName,
          class: d.class,
          capabilities: d.capabilities,
          available: d.available,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(devices, null, 2) }],
        };
      }

      case "list_zones": {
        const data = await homeyFetch("/api/manager/zones/zone");
        const zones = toArray(data).map((z) => ({
          id: z.id,
          name: z.name,
          parent: z.parent,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(zones, null, 2) }],
        };
      }

      case "list_folders": {
        const data = await homeyFetch("/api/manager/flow/folder");
        const folders = toArray(data).map((f) => ({
          id: f.id,
          name: f.name,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(folders, null, 2) }],
        };
      }

      case "list_variables": {
        const data = await homeyFetch("/api/manager/logic/variable");
        const variables = toArray(data).map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          value: v.value,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(variables, null, 2) }],
        };
      }

      case "get_changelog": {
        const query = {};
        if (args.since) query.since = args.since;
        if (Array.isArray(args.types) && args.types.length > 0) query.types = args.types.join(",");
        const data = await companionFetch("/changelog", query);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "list_flows_metadata": {
        const data = await companionFetch("/flows_metadata");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "clear_changelog": {
        const data = await companionFetch("/clear_changelog", {}, "DELETE");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_logs": {
        const data = await homeyFetch("/api/app/nl.nielsdeklerk.log/");
        let logs = data.logs || [];

        if (args.since) {
          const since = new Date(args.since);
          logs = logs.filter(e => new Date(e.timestamp) >= since);
        }
        if (args.search) {
          const needle = args.search.toLowerCase();
          logs = logs.filter(e => e.message.toLowerCase().includes(needle));
        }
        const limit = Math.min(args.limit ?? 100, 1000);
        logs = logs.slice(0, limit);

        return {
          content: [{ type: "text", text: JSON.stringify({ count: logs.length, logs }, null, 2) }],
        };
      }

      case "get_app_actions": {
        const data = await companionFetch("/app_actions");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "trigger_sync_complete": {
        const data = await companionFetch("/sync_complete", {}, "POST");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "poll_now": {
        const data = await companionFetch("/poll", {}, "POST");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_cross_references": {
        const xref = await companionFetch("/cross_references");
        const result = args.type ? { [args.type]: xref[args.type] } : xref;
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("Homey MCP server running\n");