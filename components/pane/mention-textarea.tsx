"use client";

import { useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// '@' at the start or after whitespace/punctuation (not inside an email), capturing the partial login.
const MENTION_RE = /(?:^|[^\w@])@([\w-]*)$/;
const MENU_WIDTH = 208; // w-52

interface MentionQuery {
  start: number; // index of the '@'
  end: number; // caret position (end of the partial)
  text: string; // partial login typed after '@'
}

// Mirror-div technique (textarea-caret-position) → pixel coords of the caret within the textarea.
const CARET_PROPS = [
  "box-sizing", "width", "height", "overflow-x", "overflow-y",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-style",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "font-style", "font-variant", "font-weight", "font-stretch", "font-size", "line-height", "font-family",
  "text-align", "text-transform", "text-indent", "letter-spacing", "word-spacing", "tab-size",
];

function caretCoords(el: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } {
  const computed = window.getComputedStyle(el);
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  for (const p of CARET_PROPS) div.style.setProperty(p, computed.getPropertyValue(p));
  document.body.appendChild(div);
  div.textContent = el.value.slice(0, position);
  const span = document.createElement("span");
  span.textContent = el.value.slice(position) || "."; // ensure non-empty so it has a box
  div.appendChild(span);
  const lineHeight = parseInt(computed.lineHeight) || Math.round(parseInt(computed.fontSize) * 1.2);
  const coords = {
    top: span.offsetTop + parseInt(computed.borderTopWidth) - el.scrollTop,
    left: span.offsetLeft + parseInt(computed.borderLeftWidth) - el.scrollLeft,
    height: lineHeight,
  };
  document.body.removeChild(div);
  return coords;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  users: string[];
  placeholder?: string;
  className?: string;
}

/** Textarea with GitHub-style `@username` autocomplete. */
export function MentionTextarea({ value, onChange, onKeyDown, users, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  // `bottom` is measured from the wrapper's bottom edge so the menu opens UPWARD
  // (the composer is pinned to the bottom of the pane, where a downward menu would overflow).
  const [coords, setCoords] = useState({ bottom: 0, left: 0 });

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return users
      .filter((u) => u.toLowerCase().includes(q))
      .sort((a, b) => {
        const aw = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bw = b.toLowerCase().startsWith(q) ? 0 : 1;
        return aw - bw || a.localeCompare(b);
      })
      .slice(0, 8);
  }, [query, users]);

  const open = !!query && matches.length > 0;

  function detect(el: HTMLTextAreaElement) {
    const caret = el.selectionStart;
    const m = MENTION_RE.exec(el.value.slice(0, caret));
    if (!m) {
      setQuery(null);
      return;
    }
    const text = m[1];
    const c = caretCoords(el, caret - text.length - 1);
    const maxLeft = Math.max(0, el.clientWidth - MENU_WIDTH);
    // Place the menu's bottom edge just above the caret line so it grows upward.
    setCoords({ bottom: el.offsetHeight - c.top + 2, left: Math.min(c.left, maxLeft) });
    setActive(0);
    setQuery({ start: caret - text.length - 1, end: caret, text });
  }

  function choose(user: string) {
    const el = ref.current;
    if (!el || !query) return;
    const v = el.value;
    const next = `${v.slice(0, query.start)}@${user} ${v.slice(query.end)}`;
    onChange(next);
    setQuery(null);
    const pos = query.start + user.length + 2; // after "@user "
    requestAnimationFrame(() => {
      const e2 = ref.current;
      if (e2) {
        e2.focus();
        e2.setSelectionRange(pos, pos);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(matches[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          detect(e.currentTarget);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          // re-detect when the caret moves across an @token via arrows/home/end
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) detect(e.currentTarget);
        }}
        onClick={(e) => detect(e.currentTarget)}
        onBlur={() => setQuery(null)}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <ul
          role="listbox"
          style={{ bottom: coords.bottom, left: coords.left, width: MENU_WIDTH }}
          className="absolute z-50 max-h-44 overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
        >
          {matches.map((u, i) => (
            <li key={u}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep textarea focus; avoid blur closing first
                  choose(u);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-1.5 px-2 py-1 text-left",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span className="text-muted-foreground">@</span>
                <span className="truncate">{u}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
