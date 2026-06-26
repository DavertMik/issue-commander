// Shared domain types used by both the server (route handlers / data-access) and
// the client (panes, hooks). The whole app is scoped to a single org (GITHUB_ORG),
// so a PaneSource never carries an owner — the server injects it via getOrg().

export type IssueState = "open" | "closed";

export interface Label {
  name: string;
  color: string; // 6-hex, no leading '#'
}

export interface Assignee {
  login: string;
  avatarUrl: string;
}

export interface RepoRef {
  owner: string;
  name: string;
}

export interface MilestoneRef {
  number: number | null; // null when only a title is known (project rows)
  title: string;
}

/** A Projects V2 single-select "Status" field value for an issue's project item. */
export interface ProjectStatus {
  projectId: string;
  projectNumber: number;
  projectTitle: string;
  itemId: string; // ProjectV2Item id
  status: string | null; // current Status option name (null if unset)
  optionId: string | null; // current Status option id
  multiple?: boolean; // issue belongs to more than one project (we show the first)
}

/** The single row type every source maps into. */
export interface IssueRow {
  number: number;
  title: string;
  state: IssueState;
  assignees: Assignee[];
  labels: Label[];
  milestone: MilestoneRef | null;
  repo: RepoRef;
  htmlUrl: string;
  nodeId: string; // Issue GraphQL global id (I_...), used for transfer/project ops
  type?: string | null; // org-level Issue Type name (Bug / Feature / Task …), if set
  projectItemId?: string; // ProjectV2Item id (PVTI_...), present only for project sources
  projectStatus?: ProjectStatus | null; // the issue's project Status (first project), if any
}

/**
 * What a pane is currently showing. owner is always GITHUB_ORG.
 * A milestone is org-wide by title (GitHub milestones are repo-scoped, but the
 * same title is reused across repos — we aggregate via the Search API).
 */
export type PaneSource =
  | { kind: "repo"; repo: string; state?: IssueState }
  | { kind: "milestone"; title: string }
  | { kind: "project"; projectNumber: number; projectId?: string; projectTitle?: string }
  | { kind: "recent" }; // org issues you're involved in, most-recently-updated first

export type SourceKind = PaneSource["kind"];

/** User defaults (persisted to localStorage) used to pre-fill new-issue creation. */
export interface AppConfig {
  defaultRepository: string | null; // repo name
  defaultMilestone: string | null; // org-wide milestone title
  defaultProject: number | null; // project number
}

/** repo source -> "milestone"; milestone/project source -> "repo". */
export type LastColumn = "milestone" | "repo";

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface PaneListResult {
  rows: IssueRow[];
  lastColumn: LastColumn;
  source: PaneSource;
  pageInfo?: PageInfo;
  skippedDrafts?: number;
}

/** A project's Status single-select field + options (for the F7 editor). */
export interface StatusFieldData {
  fieldId: string;
  options: Array<{ id: string; name: string }>;
}

/** Assignable users, labels, and open milestones for a repo (F7 quick-edit options). */
export interface RepoOptions {
  assignees: Assignee[];
  labels: Label[];
  milestones: Array<{ number: number; title: string }>;
}

// ---- Source selector option shapes ----

export interface RepoOption {
  owner: string;
  name: string;
  private: boolean;
}

/** Org-wide milestone: a distinct title aggregated across all repos. */
export interface MilestoneOption {
  title: string;
  repoCount: number;
  openIssues: number;
  closedIssues: number;
}

export interface ProjectOption {
  id: string;
  number: number;
  title: string;
}

// ---- Issue preview (F3) ----

export interface IssueComment {
  author: string;
  authorAvatarUrl: string;
  body: string;
  createdAt: string;
}

/** A parent or sub-issue reference (sub-issues feature). */
export interface RelatedIssue {
  number: number;
  title: string;
  state: IssueState;
  url: string;
  repo: string; // owner/name
}

/** A linked PR or cross-referenced issue. */
export interface LinkedRef {
  number: number;
  title: string;
  url: string;
  repo: string; // owner/name
  state: "open" | "closed" | "merged";
  isPR: boolean;
}

export interface IssueDetail {
  number: number;
  title: string;
  state: IssueState;
  body: string;
  htmlUrl: string;
  author: string;
  authorAvatarUrl: string;
  createdAt: string;
  comments: IssueComment[];
  parent: RelatedIssue | null;
  children: RelatedIssue[];
  linked: LinkedRef[];
}

// ---- Mutation results ----

export interface MoveResult {
  mode: "repo" | "milestone" | "project";
  renumbered?: boolean;
  newNumber?: number;
  newUrl?: string;
  newNodeId?: string;
  newProjectItemId?: string;
  warning?: string;
}

export interface CopyResult {
  projectItemId: string;
  alreadyPresent?: boolean;
}

// ---- API error envelope ----

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    [k: string]: unknown;
  };
}
