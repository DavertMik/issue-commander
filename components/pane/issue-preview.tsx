"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LabelBadges } from "@/components/labels";
import { AssigneeAvatars } from "@/components/assignees";
import { MentionTextarea } from "@/components/pane/mention-textarea";
import { PaneMessage } from "@/components/pane/pane-empty";
import { useIssueDetail } from "@/hooks/use-comments";
import { useRepoOptions } from "@/hooks/use-repo-options";
import { useAppStore } from "@/hooks/use-app-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { IssueComment, IssueDetail, IssueRow, LinkedRef, ProjectStatus, RelatedIssue, RepoRef } from "@/lib/types";

/** Route GitHub-hosted (auth/hotlink-protected) image URLs through our proxy. */
function proxyImage(src?: string): string | undefined {
  if (!src) return src;
  try {
    const u = new URL(src);
    if (u.protocol === "https:" && (u.hostname === "github.com" || u.hostname.endsWith(".githubusercontent.com"))) {
      return `/api/img?u=${encodeURIComponent(u.toString())}`;
    }
  } catch {
    // relative or invalid URL — leave as-is
  }
  return src;
}

const md: Components = {
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children, ...props }) => (
    <code {...props} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre {...props} className="my-2 overflow-x-auto rounded bg-muted p-2 text-[11px] [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  ul: ({ children, ...props }) => <ul {...props} className="my-1 list-disc pl-5">{children}</ul>,
  ol: ({ children, ...props }) => <ol {...props} className="my-1 list-decimal pl-5">{children}</ol>,
  li: ({ children, ...props }) => <li {...props} className="my-0.5">{children}</li>,
  h1: ({ children, ...props }) => <h1 {...props} className="mb-1 mt-3 text-base font-semibold">{children}</h1>,
  h2: ({ children, ...props }) => <h2 {...props} className="mb-1 mt-3 text-sm font-semibold">{children}</h2>,
  h3: ({ children, ...props }) => <h3 {...props} className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
  p: ({ children, ...props }) => <p {...props} className="my-1.5 leading-relaxed">{children}</p>,
  blockquote: ({ children, ...props }) => (
    <blockquote {...props} className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children, ...props }) => <table {...props} className="my-2 w-full border-collapse text-[11px]">{children}</table>,
  th: ({ children, ...props }) => <th {...props} className="border border-border px-2 py-1 text-left">{children}</th>,
  td: ({ children, ...props }) => <td {...props} className="border border-border px-2 py-1 align-top">{children}</td>,
  // GitHub stores pasted screenshots as raw <img> HTML with huge width/height attrs;
  // h-auto + max-w-full override those so the image scales to fit the pane. GitHub
  // attachment URLs are proxied through /api/img (they're auth/hotlink-protected).
  img: ({ src, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={proxyImage(typeof src === "string" ? src : undefined)}
      alt={props.alt ?? ""}
      loading="lazy"
      className="my-2 h-auto max-w-full rounded border border-border"
    />
  ),
  hr: (props) => <hr {...props} className="my-3 border-border" />,
};

function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={md}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/** Localized "3 days ago" / "in 2 months". */
function relativeTime(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diffSec) >= secs || unit === "second") {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return "";
}

/** Date in the current locale; clicking toggles the GLOBAL absolute/relative mode. */
function TimeLabel({ iso }: { iso: string }) {
  const relative = useAppStore((s) => s.relativeDates);
  const toggle = useAppStore((s) => s.toggleRelativeDates);
  const absolute = new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const rel = relativeTime(iso);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      title={relative ? absolute : rel}
      className="cursor-pointer hover:text-foreground hover:underline"
    >
      {relative ? rel : absolute}
    </button>
  );
}

/** Copy a ticket URL to the clipboard, with a visible copy icon + brief confirm. */
function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy link to ticket"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Couldn't copy link");
        }
      }}
      className={cn("shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground", className)}
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function RelatedItem({ rel, currentRepo }: { rel: RelatedIssue; currentRepo: string }) {
  const relRepoName = rel.repo.split("/")[1] ?? rel.repo;
  const label = relRepoName !== currentRepo ? `${relRepoName}#${rel.number}` : `#${rel.number}`;
  return (
    <div className="flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-muted">
      <button
        type="button"
        onClick={() => window.open(rel.url, "_blank", "noopener,noreferrer")}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        <span className={cn("size-2 shrink-0 rounded-full", rel.state === "closed" ? "bg-violet-400" : "bg-emerald-400")} />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
        <span className="truncate">{rel.title}</span>
      </button>
      <CopyLinkButton url={rel.url} />
    </div>
  );
}

function RelatedSection({
  heading,
  items,
  currentRepo,
}: {
  heading: string;
  items: RelatedIssue[];
  currentRepo: string;
}) {
  return (
    <div className="mt-2 rounded border border-border p-2">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{heading}</div>
      {items.map((r) => (
        <RelatedItem key={`${r.repo}#${r.number}`} rel={r} currentRepo={currentRepo} />
      ))}
    </div>
  );
}

const LINK_DOT: Record<LinkedRef["state"], string> = {
  open: "bg-emerald-400",
  closed: "bg-violet-400",
  merged: "bg-purple-500",
};

function LinkedSection({ items, currentRepo }: { items: LinkedRef[]; currentRepo: string }) {
  return (
    <div className="mt-2 rounded border border-border p-2">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Linked PRs &amp; issues
      </div>
      {items.map((l) => {
        const relRepoName = l.repo.split("/")[1] ?? l.repo;
        const label = relRepoName !== currentRepo ? `${relRepoName}#${l.number}` : `#${l.number}`;
        return (
          <div key={l.url} className="flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-muted">
            <button
              type="button"
              onClick={() => window.open(l.url, "_blank", "noopener,noreferrer")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            >
              <span className={cn("size-2 shrink-0 rounded-full", LINK_DOT[l.state])} />
              <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] uppercase text-muted-foreground">
                {l.isPR ? "PR" : "issue"}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
              <span className="truncate">{l.title}</span>
            </button>
            <CopyLinkButton url={l.url} />
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ ps }: { ps?: ProjectStatus | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs">
      <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
      <span className={cn(ps?.status ? "text-foreground/80" : "italic text-muted-foreground")}>
        {ps?.status ?? "no status"}
      </span>
    </span>
  );
}

// Status · labels · assignees under the title; click to open the F7 quick-edit modal for this issue.
function MetaBar({ row }: { row: IssueRow }) {
  const openEdit = useAppStore((s) => s.openEdit);
  return (
    <div
      role="button"
      tabIndex={0}
      title="Edit status · labels · assignees (F7)"
      onClick={() => openEdit([row])}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEdit([row]);
        }
      }}
      className="group flex shrink-0 cursor-pointer items-center justify-end gap-2 rounded px-2 py-1 hover:bg-muted"
    >
      <StatusPill ps={row.projectStatus} />
      <span className="max-w-[22rem] overflow-hidden">
        <LabelBadges labels={row.labels} max={4} />
      </span>
      <AssigneeAvatars assignees={row.assignees} max={3} />
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

function AuthorLine({ login, avatarUrl, when }: { login: string; avatarUrl: string; when: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="size-5">
        <AvatarImage src={avatarUrl} alt={login} />
        <AvatarFallback className="text-[9px]">{login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground/80">{login}</span>
      <span>·</span>
      <TimeLabel iso={when} />
    </div>
  );
}

function CommentComposer({ repo, number }: { repo: RepoRef; number: number }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const repoOpts = useRepoOptions(repo.name);
  const users = useMemo(() => (repoOpts.data?.assignees ?? []).map((a) => a.login), [repoOpts.data]);

  async function submit() {
    const body = text.trim();
    if (!body || posting) return;
    const key = ["issueDetail", repo.owner, repo.name, number] as const;
    const prev = qc.getQueryData<IssueDetail>(key);
    // Optimistic: show the comment immediately and clear the box; reconcile/rollback after.
    const optimistic: IssueComment = { author: "you", authorAvatarUrl: "", body, createdAt: new Date().toISOString() };
    if (prev) qc.setQueryData<IssueDetail>(key, { ...prev, comments: [...prev.comments, optimistic] });
    setText("");
    setPosting(true);
    try {
      await api.addComment(repo.owner, repo.name, number, body);
      qc.invalidateQueries({ queryKey: key }); // reconcile to the canonical author/avatar
    } catch (e) {
      if (prev) qc.setQueryData(key, prev);
      setText(body);
      toast.error(`Comment failed: ${(e as Error)?.message ?? "error"}`);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="shrink-0 space-y-2 border-t border-border bg-muted/20 p-2">
      <MentionTextarea
        value={text}
        onChange={setText}
        users={users}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Add a comment… (@ to mention · ⌘/Ctrl+Enter to send)"
        className="max-h-32 min-h-16 resize-none text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void submit()} disabled={posting || text.trim().length === 0}>
          {posting ? "Sending…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

export function IssuePreview({
  repo,
  number,
  title,
  row,
}: {
  repo: RepoRef;
  number: number;
  title: string;
  row?: IssueRow;
}) {
  // keepPreviousData keeps the last-loaded ticket visible until the new one arrives — no skeleton.
  // While that stale ticket shows (isPlaceholderData), dim it so it reads as "not the cursor's ticket".
  const { data, isError, error, isPlaceholderData } = useIssueDetail(repo, number);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <span>
                {repo.name} · #{number}
              </span>
              <CopyLinkButton url={`https://github.com/${repo.owner}/${repo.name}/issues/${number}`} />
              <span className="opacity-70">· preview (F3 / Esc)</span>
            </div>
            <div className="truncate text-base font-semibold" title={title}>
              {title}
            </div>
          </div>
          {row && <MetaBar row={row} />}
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-3 py-3 transition-opacity",
          isPlaceholderData && "opacity-50",
        )}
      >
        {data ? (
          <>
            {data.parent && <RelatedSection heading="Parent" items={[data.parent]} currentRepo={repo.name} />}
            <div className="mt-2 rounded border border-border p-2">
              <AuthorLine login={data.author} avatarUrl={data.authorAvatarUrl} when={data.createdAt} />
              <Markdown>{data.body || "_No description provided._"}</Markdown>
            </div>
            {data.children.length > 0 && (
              <RelatedSection
                heading={`Sub-issues · ${data.children.filter((c) => c.state === "closed").length}/${data.children.length} done`}
                items={data.children}
                currentRepo={repo.name}
              />
            )}
            {data.linked.length > 0 && <LinkedSection items={data.linked} currentRepo={repo.name} />}
            {data.comments.map((c, i) => (
              <div key={i} className="mt-2 rounded border border-border p-2">
                <AuthorLine login={c.author} avatarUrl={c.authorAvatarUrl} when={c.createdAt} />
                <Markdown>{c.body || ""}</Markdown>
              </div>
            ))}
            {data.comments.length === 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">No comments</p>
            )}
          </>
        ) : isError ? (
          <PaneMessage title="Failed to load issue" hint={(error as Error)?.message} />
        ) : null}
      </div>
      {data && <CommentComposer key={`${repo.name}#${number}`} repo={repo} number={number} />}
    </div>
  );
}
