"use client";

import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiOption {
  value: string;
  label: string;
  color?: string;
}

/** Compact multi-select dropdown (Popover + checkbox list, no search). */
export function MultiSelect({
  placeholder,
  options,
  selected,
  onChange,
  className,
}: {
  placeholder: string;
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const set = new Set(selected);
  const chosen = options.filter((o) => set.has(o.value));
  const toggle = (value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  const summary =
    chosen.length === 0 ? placeholder : chosen.length === 1 ? chosen[0].label : `${chosen.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 items-center gap-1.5 rounded border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <span className={cn("truncate", chosen.length === 0 && "text-muted-foreground")}>{summary}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-y-auto p-1">
        {options.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">None available</p>}
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            {o.color !== undefined && (
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `#${o.color}` }} />
            )}
            <span className="truncate">{o.label}</span>
            {set.has(o.value) && <Check className="ml-auto size-4 shrink-0 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
