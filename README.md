<div align="center">

# 🦪 Pearl

**A disciplined Bubble.io engineering agent — layer by layer, never one reckless pour.**

Pearl is an agent persona + toolset for [pi](https://github.com/earendil-works/pi-coding-agent)
that builds, inspects, and repairs [Bubble](https://bubble.io) apps with a
savepoint-first doctrine. She reads before she writes, gates every destructive
call behind your consent, and hands off with a human-readable review — not a
pile of silent edits.

[Documentation](https://pearl.parastus.me) · [Install](#install) · [The Doctrine](#the-doctrine) · [Configuration](#configuration)

</div>

---

## Why Pearl?

Agents that edit no-code apps tend to do the worst thing possible: one giant
blind write straight into production. Pearl is the opposite of that.

A pearl isn't made in a hurry. An irritant enters the shell and the oyster
answers with layer after layer of nacre — each thin, each exact, until grit
becomes gem. Pearl builds Bubble apps the same way:

```
PLAN → INSPECT → SAVEPOINT → IMPLEMENT → VERIFY → REVIEW → HAND OFF
```

- 🧭 **Doctrine-driven** — a skill file teaches the agent a non-negotiable
  engineering chain, not just a bag of tools.
- 🔌 **Two wires into the shell** — your app's own Data/Workflow REST APIs
  (always available) plus the official Bubble MCP for editor-level work.
- 🛡️ **Self-gating** — an interceptor watches every Bubble-bound tool call.
  Live writes and deletes ask first. Mutations without a savepoint ask first.
- 📓 **Legible** — `/pearl` shows the session ledger: savepoint state,
  mutations written, calls gated.

## What's inside

| Piece | What it does |
|-------|--------------|
| `skills/pearl-bubble/` | The doctrine — vocabulary, the chain, engineering rules, report format |
| `extensions/bubble-api.ts` | `bubble_api` tool: `meta`, `list`, `get`, `create`, `update`, `delete`, `workflow` against dev or live |
| `extensions/savepoint-check.ts` | The gate — intercepts `bubble_api` and Bubble MCP calls, enforces savepoint discipline |

## Install

```bash
# 1. Clone
git clone https://github.com/pararchy/para-pearl.git
cd para-pearl

# 2. Load the extensions in pi — either copy them into your pi extensions
#    directory, or point pi at the folder:
cp extensions/*.ts ~/.pi/agent/extensions/

# 3. Install the skill
cp -r skills/pearl-bubble ~/.pi/agent/skills/
```

## Configuration

No secrets in source — Pearl reads env vars (see [.env.example](.env.example)):

```bash
export BUBBLE_APP_HOST=https://yourapp.bubbleapps.io   # your app
export BUBBLE_API_TOKEN=...                            # Settings → API → API tokens
export BUBBLE_DEV_VERSION=version-test                 # optional, this is the default
```

If config is missing, the extension still loads — `/bubble` tells you exactly
what's absent instead of silently failing.

## The two gates

**`bubble_api` — the REST wire (always on).**
Speaks to your app's Data API (`/obj/<type>`) and Workflow API
(`/wf/<endpoint>`). `meta` returns the app's whole API surface — every type
and every workflow endpoint with its parameter spec — so Pearl never guesses
names.

**Bubble MCP — the editor gate (optional).**
Attach the [official Bubble MCP](https://bubble.io) and Pearl drives the
editor itself: pages, elements, workflows, savepoints. She designs around its
known walls — no log access, no merges, no deploys — and tells you the exact
manual step when the chain ends at the editor.

## The gatekeeper

`savepoint-check.ts` hooks pi's `tool_call` event and pattern-matches every
Bubble-bound call:

- 💾 **Savepoint-ish tool seen** → shield armed for the session
- ✏️ **Mutating call, no savepoint yet** → confirm prompt before it runs
- 💣 **Destructive call** (`delete`, `remove`, `drop`, …) → always confirms
- 🔴 **`bubble_api` on `live`, or any delete** → always confirms

Reads and inspections pass through untouched — the gate only cares about writes.

## Example

```
> /bubble
  host → https://yourapp.bubbleapps.io
  dev  → https://yourapp.bubbleapps.io/version-test/api/1.1
  live → https://yourapp.bubbleapps.io/api/1.1

> pearl: add a "last_login" field to User and backfill it
  → meta (discovers the real type names)
  → savepoint on the version branch
  → update User type in thin, verified layers
  → issue checker over touched surfaces
  → review: what changed, where, what's left for a human hand
```

## Contributing

Issues and PRs welcome. The doctrine is opinionated on purpose — if you want a
different gate policy, fork `savepoint-check.ts`; the regexes are meant to be
edited.

## License

MIT © [pararchy](https://parastus.me)
