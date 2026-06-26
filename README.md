# Issue Commander

**A [Total Commander](https://www.ghisler.com/)–style two-pane manager for GitHub issues.**
Point each pane at a **repository**, an **org-wide milestone**, or a **GitHub Project (V2)**, and
triage with function keys (F3–F8) — like moving files in a file manager, but for issues. Everything
is scoped to a single GitHub **organization**.

```bash
GITHUB_ORG=your-org npx issue-commander
# → http://localhost:3000
```

---

## Why

GitHub's issue UI is one issue, one repo, one tab at a time. Triage across many repos / a milestone /
a project board means endless clicking. Issue Commander gives you **two panes side by side** and
keyboard-driven bulk operations, so you move and reorganize issues as fast as you move files in a
two-pane file manager.

## Requirements

- **Node 20+**
- **[GitHub CLI](https://cli.github.com/) authenticated** — the token comes from `gh auth token`
  (falls back to `GITHUB_TOKEN` / `GH_TOKEN`). Run `gh auth login` once.
  The token needs `repo`, `read:org`, and `project` scopes.
- **`GITHUB_ORG`** — the organization to manage (there is no in-app org switch).

```bash
gh auth login
GITHUB_ORG=acme npx issue-commander             # default port 3000
PORT=3002 GITHUB_ORG=acme npx issue-commander   # custom port
```

## How the two panes work

Each pane independently points at a **source** and shows its issues in a dense, resizable table.
You operate **from** the active pane **onto** the other pane (e.g. F6 moves the highlighted issue to
whatever the opposite pane is showing).

### A pane can point at any of these sources

| Source         | What it lists                                                        | Last column |
| -------------- | -------------------------------------------------------------------- | ----------- |
| **Repository** | Open/closed issues in one repo (REST)                                | Milestone   |
| **Milestone**  | Issues with that milestone **title across all repos** (Search API)   | Repo        |
| **Project**    | Items on a Projects V2 board, with their **Status** column (GraphQL) | Repo        |
| **Recent**     | Issues you're involved in, most-recently-updated first (Search API)  | Repo        |

### Each row shows the same normalized columns

| Column               | Notes                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| **#**                | Issue number + open/closed icon · click any header to **sort**                |
| **Title**            | Double-click opens the issue on GitHub                                        |
| **Assignee**         | Overlapping avatar stack (`+N` overflow)                                       |
| **Labels**           | GitHub colors, `+N` overflow                                                   |
| **Status**           | The issue's **Project Status** (Todo / In Progress / Done …) — see note below |
| **Repo / Milestone** | Contextual last column, depending on the source                               |

> **Status across all panes.** Project panes get Status from the board. Repository / milestone / recent
> panes are *enriched* with a batched GraphQL lookup, so you see each issue's Project Status even when
> the pane isn't a project. Which board it reads is the **default project** you set in Settings (⚙).

## Use cases

### 🏁 Move issues between milestones
Left pane = `milestone: 42`, right pane = `milestone: 43`. Highlight an issue, **F6** → it's reassigned
to milestone 43 and disappears from the left pane. Milestones are matched **org-wide by title**, so
this works across every repo.

### 📋 Copy / move between Projects
Right pane = a Projects V2 board. **F5** copies the highlighted issue onto that board (an issue can
belong to many projects); **F6** moves it between boards (added to the target first, removed from the
source — membership is never lost). Cross-repo moves use a real `transferIssue` (new number, old URL
redirects) behind a confirm dialog.

### ✅ Mass actions
**Ins** marks rows (yellow highlight) and advances the cursor, so `Ins Ins Ins` selects a run.
Then **F5 / F6 / F8** (copy / move / close) or **F7** (bulk-edit state, assignee, labels, milestone,
status, type) act on the whole selection — concurrency-limited, optimistic, with per-row spinners and
per-failure rollback.

### ⚡ Quick create & preview
**Alt+Enter** opens a new-issue form **in the sibling pane**, pre-filled from the active pane's
source/filters and your saved defaults (repo, milestone, project). **F3** previews the highlighted
issue (body + comments + linked PRs/sub-issues, rendered Markdown with images) in the opposite pane,
following the cursor. **Ctrl+U** pops an inline assignee picker right on the row.

### 🌀 Lazy loading
Lists page in on demand and **background-preload** the next page every few seconds until fully loaded,
with `keepPreviousData` so panes never flash empty. The preview prefetches the cursor's issue so it
opens instantly. Option lists (assignees, labels, projects) are cached in `localStorage`.

## Keyboard

| Key                 | Action                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `Tab`               | Switch active pane                                                 |
| `↑ ↓` · `PgUp/PgDn` | Move cursor (±1 / ±10)                                              |
| `Enter`             | Open the issue on GitHub                                           |
| `Ins`               | Select row (+advance)                                              |
| `F1` / `F2`         | Choose source for the left / right pane                           |
| `F3`                | Preview (in the other pane)                                        |
| `F4`                | Edit description inline (in the other pane)                        |
| `F5`                | Copy → the other pane's Project                                    |
| `F6`                | Move → the other pane's source                                    |
| `F7` / `Space`      | Edit fields (state · assignee · labels · milestone · status · type) |
| `F8`                | Close issue(s)                                                     |
| `Ctrl+U`            | Quick-assign on the highlighted row                               |
| `Alt+Enter`         | New issue (in the sibling pane)                                    |
| `Esc`               | Close preview / dialog                                            |

Every write is **optimistic**: the UI updates instantly and rolls back with a toast on failure.

## Settings

The ⚙ button stores **default repository / milestone / project** in `localStorage`. These pre-fill new
issues and select which board's **Status** is shown/edited across non-project panes.

## Development

```bash
git clone … && cd issue-commander
pnpm install
echo "GITHUB_ORG=your-org" > .env.local
pnpm dev          # webpack dev server on :3002
pnpm build && pnpm start
pnpm lint
pnpm exec tsc --noEmit
```

> Dev uses `next dev --webpack` **on purpose** — Next 16's Turbopack dev hot-reloader leaks an
> async-hooks map and crashes under heavy octokit churn. Production (`build` / `start`) is unaffected.

Built with Next.js 16 (App Router), React Query, Zustand, Tailwind v4, shadcn/ui, Base UI, and octokit
(REST + GraphQL). See [`CLAUDE.md`](./CLAUDE.md) for the full architecture.

## License

MIT
