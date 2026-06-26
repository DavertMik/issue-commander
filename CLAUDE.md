@AGENTS.md

# Issue Commander

A **Total Commander–style two-pane manager for GitHub issues**. Each pane points at a
**repository**, an **org-wide milestone**, or a **GitHub Project (V2)**, and you triage with
function keys (F3–F8) like moving files in a file manager. The whole app is scoped to **one
GitHub organization**.

## Run it

```bash
pnpm dev          # webpack dev server — see the Turbopack note below
pnpm build        # production build
pnpm start        # production server
pnpm lint         # eslint
pnpm exec tsc --noEmit   # typecheck
```

- **Dev runs on `:3002`** — port 3000 is taken by another app on this machine (Next picks 3002).
- Requires **`GITHUB_ORG`** in `.env.local` (e.g. `GITHUB_ORG=testomatio`). No in-app org switch.
- Auth: the server gets a token from **`gh auth token`** (falls back to `GITHUB_TOKEN`/`GH_TOKEN`).

### ⚠️ Critical gotchas

- **`dev` uses `next dev --webpack` ON PURPOSE — do NOT switch it back to Turbopack.** Next 16's
  Turbopack dev hot-reloader leaks a global async-hooks Map and crashes with
  `RangeError: Map maximum size exceeded` under heavy octokit/promise churn (and was ~4× slower).
  `pnpm dev:turbo` exists only if ever needed. Production (`build`/`start`) is unaffected.
- **Every API route must run on the Node runtime** (`export const runtime = "nodejs"`) because the
  token comes from `gh` via `node:child_process`. They're also `dynamic = "force-dynamic"`.
- This is **Next.js 16** — dynamic route `params` are async (`await ctx.params`); read
  `node_modules/next/dist/docs/` before assuming older API shapes (per AGENTS.md).

## Architecture

```
app/
  page.tsx, layout.tsx, providers.tsx   # shell: React Query + Tooltip providers, dark theme
  api/
    issues/route.ts                       # GET list (kind=repo|milestone|project, cursor)
    issues/[owner]/[repo]/[number]/route.ts  # GET detail · PATCH edit/close/state/milestone/assignees/labels · POST comment
    sources/{repos,milestones,projects}/route.ts
    actions/{move,copy,set-status}/route.ts
    project-status/route.ts               # GET a project's Status field + options
    repo-options/route.ts                 # GET assignees + labels + open milestones for a repo
    img/route.ts                          # auth proxy for GitHub attachment images
lib/
  github/{token,client,org,errors,cache,queries,graphql}.ts   # octokit (REST+GraphQL), gh token, org, GraphQL ops
  domain/{types,mappers}.ts             # REST/Search/GraphQL → normalized IssueRow
  sources/{listIssues,listSources,getIssueDetail,mutations}.ts
  validation/schemas.ts                 # zod for every route
  http/respond.ts                       # ok()/fail() JSON helpers
  types.ts                              # shared client+server types (IssueRow, PaneSource, …)
  source.ts · transfer.ts · filters.ts · hotkeys.ts · option-cache.ts · utils.ts
hooks/
  use-app-store.ts        # Zustand: active pane, per-pane source/selection/mode/filter, dialogs, flash, dates
  use-issues.ts           # useInfiniteQuery per source (keepPreviousData)
  use-comments.ts         # issue detail (body+comments+parent/children), keepPreviousData
  use-sources.ts · use-repo-options.ts · use-status.ts   # selector + F7 option lists (localStorage-cached)
  use-issue-mutations.ts  # ALL mutations (optimistic) + use-hotkeys.ts (global keydown)
components/
  total-commander.tsx     # orchestrator: 2 panes + footer, hotkey dispatch, dialogs, prefetch, persistence
  pane/*                  # pane, pane-header, pane-filter-bar, issue-table, issue-preview, inline-editor, pane-empty
  edit-dialog.tsx · source-selector.tsx · confirm-dialog.tsx · multi-select.tsx · footer.tsx · labels.tsx · assignees.tsx
```

## Key concepts

- **Single source of truth for data shape:** every source maps to one `IssueRow` (`lib/types.ts`).
  Repo/milestone come from REST/Search; project items from GraphQL.
- **Projects V2 are GraphQL-only.** Listing items, membership (add/remove), and the **Status**
  single-select field all go through `lib/github/graphql.ts`.
- **Milestones are org-wide by title.** GitHub milestones are repo-scoped, but the app aggregates
  distinct titles across all repos and lists issues via the **Search API**
  (`org:ORG is:issue milestone:"…"`). The Search index is **eventually consistent** — see below.
- **Project Status column on all panes:** project panes get it from the items query; repo/milestone
  panes are **enriched** with a batched GraphQL call (`enrichProjectStatus`) on the page's issue node ids.
- **Cross-repo move = `transferIssue`** (renumbers the issue; old URL redirects) — confirmed via dialog.
- **Image proxy:** GitHub `user-attachments` are auth/hotlink-protected, so `<img>` from the browser
  is blocked. `/api/img?u=…` fetches them server-side with the token and streams them back
  (allowlisted to `github.com` / `*.githubusercontent.com`). The F3 preview rewrites those `src`s.

## OPTIMISTIC INTERACTIONS — the rule

**Every mutation in this app is optimistic.** The pattern (in `hooks/use-issue-mutations.ts`):

1. Snapshot the affected React Query caches (`getQueriesData`).
2. Apply the change to the cache **synchronously** (`setQueriesData` / `setQueryData`) so the UI
   updates instantly.
3. Fire the API call **without blocking the UI** (dialogs close immediately, lists update at once).
4. On error, **roll back** to the snapshot and show a toast.
5. **Reconcile** with a background `invalidateQueries`.

When adding any new write, follow this — **do not** await the network before reflecting the change.

Current optimistic mutations:
- **bulk close / copy / move** (F8/F5/F6, selection-aware) — concurrency-limited, per-failure rollback.
- **applyIssueEdit** (F7 quick-edit: state, assignee, labels, milestone, project status) — one PATCH +
  status mutation, fired on Save while the dialog closes immediately.
- **edit body** (F4 inline editor) — optimistic on the issue detail.
- **add comment** (F3 composer) — appended to the detail immediately, reconciled after.

**Reconcile caveat:** repo/project lists are strongly consistent → invalidate immediately.
**Milestone lists are Search-API-backed → reconcile is DEFERRED ~10s** (otherwise a stale index would
visibly revert the optimistic change). See `isMilestoneQuery` / `reconcile()` in `use-issue-mutations.ts`.

## Keyboard (Total Commander style)

`Tab` switch pane · `↑/↓` move · `PageUp/PageDown` ±10 · `Enter` open in new tab ·
`Ins` select (outer ring) + advance · `F1/F2` source selector for left/right pane ·
`F3` preview (follows the cursor; the other pane) · `F4` inline edit body ·
`F5` copy → project · `F6` move · `F7`/`Space` quick-edit modal · `F8` close.
The global handler (`use-hotkeys.ts`) bails while an input/select/textarea is focused or a dialog is open.

## UI notes

- **shadcn/ui** (radix-nova preset), **Tailwind v4**, dark "Norton Commander" blue theme, Geist fonts.
- Table columns are **resizable** (drag a column's left-edge divider; widths via a CSS variable so rows
  don't re-render) with uniform 36px rows.
- F3 preview **follows the cursor** with `keepPreviousData` (stale ticket stays, dimmed to 50%, until the
  new one loads — no skeleton); the cursor's ticket is **prefetched** (debounced) so it's instant.
- Markdown via `react-markdown` + `remark-gfm` + `rehype-raw` (raw `<img>` renders; trusted org content).
- Dates use the current locale; clicking any date globally toggles absolute ↔ relative.
- **localStorage:** pane sources (`total-issues:sources`), filters (`total-issues:filters`), and option
  lists (`total-issues:opt:*`). Sources restore before filters (changing a source resets its filter).

## Conventions

- **`pnpm exec tsc --noEmit` and `pnpm lint` must both pass** before considering a change done.
- Keep client/server types in `lib/types.ts`; never import server-only modules (octokit, `lib/github/*`,
  `lib/sources/*`) into client components — go through `lib/api.ts` (typed fetch wrappers).
- Validate every route with the zod schemas in `lib/validation/schemas.ts`; return errors via `fail()`.
- Memoized `IssueTable` rows depend on stable callbacks/props — keep navigation cheap (don't pass new
  object/function identities per render into rows).
