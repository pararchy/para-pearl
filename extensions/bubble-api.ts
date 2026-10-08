/**
 * bubble-api — Pearl's wire into any Bubble app's REST gates.
 *
 * `bubble_api` speaks to Bubble's Data API (/obj) and Workflow API (/wf)
 * directly — no MCP server needed. Two environments:
 *   dev  → /<dev-version>/api/1.1/...   (your workbench)
 *   live → /api/1.1/...                 (production — mutating calls here are
 *                                        gated by savepoint-check before this
 *                                        tool even runs)
 *
 * Configuration — no secrets in source. Set env vars (see .env.example):
 *   BUBBLE_APP_HOST    e.g. https://yourapp.bubbleapps.io or your custom domain
 *   BUBBLE_API_TOKEN   your app's API token (Bubble editor → Settings → API)
 *   BUBBLE_DEV_VERSION optional — version slug for dev (default "version-test")
 *   BUBBLE_ALT_TOKEN   optional second token — try key:'alt' if a call 401s
 *
 * Actions:
 *   meta     → GET /meta — the app's whole API surface (types + workflow
 *              endpoints with parameter specs). Cheap schema discovery.
 *   list     → GET /obj/<type> — paginated things (limit/cursor/constraints)
 *   get      → GET /obj/<type>/<id> — one thing
 *   create   → POST /obj/<type> — new thing (body = fields)
 *   update   → PATCH /obj/<type>/<id> — mutate fields (body = fields)
 *   delete   → DELETE /obj/<type>/<id> — gone for good
 *   workflow → POST /wf/<endpoint> — run an API workflow (body = params)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const APP_HOST = process.env.BUBBLE_APP_HOST?.replace(/\/+$/, "") ?? "";
const DEV_VERSION = process.env.BUBBLE_DEV_VERSION || "version-test";
const API_TOKEN = process.env.BUBBLE_API_TOKEN ?? "";
const ALT_TOKEN = process.env.BUBBLE_ALT_TOKEN ?? "";

const ENVS: Record<string, string> = {
  dev: `${APP_HOST}/${DEV_VERSION}/api/1.1`,
  live: `${APP_HOST}/api/1.1`,
};

const MAX_OUT = 12000;

async function call(base: string, method: string, path: string, token: string, body?: any) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* html error page — keep raw */ }
  return { status: res.status, body: parsed };
}

function fmt(result: { status: number; body: any }): string {
  let out = typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2);
  // Bubble HTML error pages aren't useful — keep just the status.
  if (out.startsWith("<")) out = "(html error page)";
  if (out.length > MAX_OUT) out = out.slice(0, MAX_OUT) + `\n… truncated (${out.length} chars)`;
  return `[${result.status}] ${out}`;
}

export default function (pi: ExtensionAPI) {
  if (!APP_HOST || !API_TOKEN) {
    // Extension loads but the tool refuses — missing config is reported
    // loudly rather than silently failing on a fetch to "undefined".
    pi.registerCommand("bubble", {
      description: "Pearl's gate status — shows what config is missing",
      handler: async (_args, ctx) => {
        ctx.ui.notify(
          "bubble_api is not configured.\n" +
            `BUBBLE_APP_HOST: ${APP_HOST || "missing"}\n` +
            `BUBBLE_API_TOKEN: ${API_TOKEN ? "set" : "missing"}\n\n` +
            "Set them in your environment — see .env.example.",
          "warning",
        );
      },
    });
    return;
  }

  pi.registerTool({
    name: "bubble_api",
    label: "Bubble API",
    description:
      `Call the Bubble Data/Workflow APIs of ${APP_HOST}. env defaults to 'dev'; 'live' hits production. ` +
      "Actions: meta (full API surface — data types + workflow endpoints with params), list/get/create/update/delete on obj types, " +
      "workflow to POST a /wf endpoint. Start with meta to learn type and endpoint names before guessing.",
    parameters: Type.Object({
      action: Type.Union(
        ["meta", "list", "get", "create", "update", "delete", "workflow"].map((s) => Type.Literal(s)),
        { description: "What to do" },
      ),
      env: Type.Optional(Type.Union([Type.Literal("dev"), Type.Literal("live")], { description: "dev (default) or live" })),
      type: Type.Optional(Type.String({ description: "Data type name (list/get/create/update/delete)" })),
      id: Type.Optional(Type.String({ description: "Thing _id (get/update/delete)" })),
      endpoint: Type.Optional(Type.String({ description: "Workflow endpoint name (workflow action)" })),
      body: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Fields/params for create/update/workflow" })),
      limit: Type.Optional(Type.Number({ description: "Page size for list (default 20, max 100)" })),
      cursor: Type.Optional(Type.Number({ description: "Pagination cursor for list" })),
      sort_field: Type.Optional(Type.String({ description: "Sort field for list" })),
      descending: Type.Optional(Type.Boolean({ description: "Sort direction for list" })),
      constraints: Type.Optional(Type.Array(Type.Unknown(), { description: "Bubble constraint objects for list filtering" })),
      key: Type.Optional(Type.Union([Type.Literal("app"), Type.Literal("alt")], { description: "Which credential (default app)" })),
    }),
    async execute(_id, params) {
      const base = ENVS[params.env || "dev"];
      const token = params.key === "alt" && ALT_TOKEN ? ALT_TOKEN : API_TOKEN;
      try {
        switch (params.action) {
          case "meta":
            return { content: [{ type: "text", text: fmt(await call(base, "GET", "/meta", token)) }], details: {} };

          case "list": {
            if (!params.type) return err("list needs `type` — run action:'meta' to see type names");
            const q = new URLSearchParams();
            q.set("limit", String(Math.min(params.limit ?? 20, 100)));
            if (params.cursor) q.set("cursor", String(params.cursor));
            if (params.sort_field) q.set("sort_field", params.sort_field);
            if (params.descending) q.set("descending", "true");
            if (params.constraints) q.set("constraints", JSON.stringify(params.constraints));
            return { content: [{ type: "text", text: fmt(await call(base, "GET", `/obj/${params.type}?${q}`, token)) }], details: {} };
          }

          case "get":
            if (!params.type || !params.id) return err("get needs `type` and `id`");
            return { content: [{ type: "text", text: fmt(await call(base, "GET", `/obj/${params.type}/${params.id}`, token)) }], details: {} };

          case "create":
            if (!params.type || !params.body) return err("create needs `type` and `body`");
            return { content: [{ type: "text", text: fmt(await call(base, "POST", `/obj/${params.type}`, token, params.body)) }], details: {} };

          case "update":
            if (!params.type || !params.id || !params.body) return err("update needs `type`, `id`, and `body`");
            return { content: [{ type: "text", text: fmt(await call(base, "PATCH", `/obj/${params.type}/${params.id}`, token, params.body)) }], details: {} };

          case "delete":
            if (!params.type || !params.id) return err("delete needs `type` and `id`");
            return { content: [{ type: "text", text: fmt(await call(base, "DELETE", `/obj/${params.type}/${params.id}`, token)) }], details: {} };

          case "workflow":
            if (!params.endpoint) return err("workflow needs `endpoint` — run action:'meta' to see endpoint names + params");
            return { content: [{ type: "text", text: fmt(await call(base, "POST", `/wf/${params.endpoint}`, token, params.body ?? {})) }], details: {} };

          default:
            return err(`unknown action '${params.action}'`);
        }
      } catch (e: any) {
        return err(`bubble_api failed: ${e.message}`);
      }
    },
  });

  pi.registerCommand("bubble", {
    description: "Pearl's gate status — which environments and key the wire carries",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `host → ${APP_HOST}\ndev  → ${ENVS.dev}\nlive → ${ENVS.live}\n` +
          `token: app (…${API_TOKEN.slice(-6)})${ALT_TOKEN ? " + alt key on file" : ""}`,
        "info",
      );
    },
  });
}

function err(msg: string) {
  return { content: [{ type: "text", text: `bubble_api: ${msg}` }], details: {} };
}
