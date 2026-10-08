/**
 * savepoint-check — Pearl's layer discipline.
 *
 * Watches tool dispatches to Bubble (the `bubble_api` REST wire and any
 * Bubble MCP server) and enforces the doctrine: no destructive change
 * without a confirm, no substantial edit without a savepoint recorded this
 * session. Reads and inspects pass freely — the gate only cares about
 * writes.
 *
 * MCP tool names aren't known until the server connects, so matching is by
 * verb shape: savepoint-ish names arm the shield, mutating verbs check it,
 * and destructive verbs always ask. /pearl shows the session's layer ledger.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SAVEPOINT_RE = /savepoint|snapshot|checkpoint|version|backup|restore[_-]?point/i;
const DESTRUCTIVE_RE = /delete|remove|destroy|drop|purge|reset|wipe/i;
const MUTATING_RE = /create|update|edit|modify|add|set|rename|move|duplicate|delete|remove|change|write|apply|publish|workflow/i;

export default function (pi: ExtensionAPI) {
  let savepointSeen = false;
  let mutations = 0;
  let blocked = 0;

  pi.on("tool_call", async (event, ctx) => {
    // bubble_api — the app's own REST wire. The data API has no savepoints;
    // the meaningful gate is environment: live mutations and deletes always
    // ask, dev writes pass and get counted.
    if (event.toolName === "bubble_api") {
      const action: string = event.input?.action ?? "";
      const env: string = event.input?.env ?? "dev";
      const mutating = /create|update|delete|workflow/i.test(action);
      if (!mutating) return;
      if (env === "live" || action === "delete") {
        const ok = await ctx.ui.confirm(
          "Pearl — live shell",
          `bubble_api ${action}${action === "delete" ? "" : " on LIVE"}: this writes to production data.\n\nProceed?`,
        );
        if (ok) { mutations++; return; }
        blocked++;
        return { block: true, reason: `Blocked by savepoint-check: ${action} on ${env} needs explicit consent` };
      }
      mutations++;
      return;
    }

    if (event.toolName !== "mcp_call") return;
    const server: string = event.input?.server ?? "";
    const tool: string = event.input?.tool ?? "";
    if (!/bubble/i.test(server) && !/bubble/i.test(tool)) return;

    if (SAVEPOINT_RE.test(tool)) {
      savepointSeen = true;
      return;
    }
    if (!MUTATING_RE.test(tool)) return; // reads and inspects pass free

    if (DESTRUCTIVE_RE.test(tool)) {
      const ok = await ctx.ui.confirm(
        "Pearl — destructive layer",
        `Bubble call: ${tool}\n\nThis removes something from the shell. It cannot be un-laid.\n\nProceed?`,
      );
      if (ok) { mutations++; return; }
      blocked++;
      return { block: true, reason: `Blocked by savepoint-check: destructive call '${tool}' needs explicit consent` };
    }

    if (!savepointSeen) {
      const ok = await ctx.ui.confirm(
        "Pearl savepoint-check",
        `Bubble call: ${tool}\n\nNo savepoint recorded this session. The doctrine says savepoint before substantial edits.\n\nWrite anyway?`,
      );
      if (ok) { mutations++; return; }
      blocked++;
      return { block: true, reason: "Blocked by savepoint-check: create a savepoint before mutating the shell" };
    }
    mutations++;
  });

  pi.registerCommand("pearl", {
    description: "Pearl's layer ledger — savepoint state, mutations written, gates held",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `Savepoint this session: ${savepointSeen ? "recorded" : "none"}\n` +
        `Mutations written: ${mutations}\n` +
        `Calls gated: ${blocked}`,
        savepointSeen ? "info" : "warning",
      );
    },
  });
}
