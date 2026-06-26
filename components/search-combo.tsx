"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  color?: string;
}

// Reui look (classes mirror components/reui/autocomplete.tsx) on Base UI's Combobox primitive —
// unlike Autocomplete, Combobox is value-bound and supports multiple selection (labels/repos).
// The wrapper carries sizing (default h-9 w-full; callers override via className, e.g. "h-7 w-40")
// so the clear button can sit absolutely next to the trigger.
const wrapperCls = "relative flex h-9 w-full";
const triggerCls =
  "flex h-full w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30";

const popupCls =
  "z-50 flex max-h-[min(var(--available-height),22rem)] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover py-0.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[scale,opacity] data-starting-style:scale-98 data-starting-style:opacity-0";

const itemCls =
  "relative flex cursor-default select-none items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

const searchInputCls =
  "h-8 w-full rounded-md bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground";

function Dot({ color }: { color?: string }) {
  if (color === undefined) return null;
  return <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `#${color}` }} />;
}

// Sits over the trigger's right edge; clears the selection without opening the popup.
function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      title="Clear"
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <X className="size-4" />
    </button>
  );
}

function ComboPopup({
  searchPlaceholder,
  container,
  children,
}: {
  searchPlaceholder: string;
  // When inside a Radix Dialog, portal into the dialog's DOM so clicks/scroll on the popup
  // aren't treated as "outside" (which would dismiss the modal) and stay within its focus trap.
  container?: React.RefObject<HTMLElement | null>;
  children: (item: ComboOption, index: number) => React.ReactNode;
}) {
  return (
    <Combobox.Portal container={container}>
      <Combobox.Positioner align="start" sideOffset={4} className="z-50 outline-none">
        <Combobox.Popup className={popupCls}>
          <div className="border-b border-border px-1 py-1">
            <Combobox.Input placeholder={searchPlaceholder} className={searchInputCls} />
          </div>
          <Combobox.Empty className="px-2 py-2 text-center text-sm text-muted-foreground">No matches.</Combobox.Empty>
          <Combobox.List className="max-h-72 overflow-y-auto p-1">{children}</Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

function renderItem(o: ComboOption) {
  return (
    <Combobox.Item key={o.value} value={o} className={itemCls}>
      <Dot color={o.color} />
      <span className="truncate">{o.label}</span>
      <Combobox.ItemIndicator className="ml-auto flex">
        <Check className="size-4 shrink-0 text-primary" />
      </Combobox.ItemIndicator>
    </Combobox.Item>
  );
}

// Null-safe: Base UI calls these with `null` when the single combobox has no selection (unassigned).
const eq = (a: ComboOption | null, b: ComboOption | null) => a?.value === b?.value;
const toLabel = (o: ComboOption | null) => o?.label ?? "";

/** Single-select combobox with type-to-search (for unbounded lists like users). */
export function SingleSearchCombo({
  placeholder,
  searchPlaceholder = "Search…",
  options,
  value,
  onChange,
  className,
  container,
}: {
  placeholder: string;
  searchPlaceholder?: string;
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  container?: React.RefObject<HTMLElement | null>;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  const hasValue = value != null && value !== "";
  // Show the raw value while the option list is still loading (label resolves once it arrives).
  const labelText = selected ? selected.label : value;
  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(v: ComboOption | null) => onChange(v ? v.value : null)}
      isItemEqualToValue={eq}
      itemToStringLabel={toLabel}
    >
      <div className={cn(wrapperCls, className)}>
        <Combobox.Trigger className={cn(triggerCls, hasValue && "pr-8")}>
          <span className={cn("flex items-center gap-1.5 truncate", !hasValue && "text-muted-foreground")}>
            <Dot color={selected?.color} />
            <span className="truncate">{hasValue ? labelText : placeholder}</span>
          </span>
          {!hasValue && <ChevronsUpDown className="size-4 shrink-0 opacity-50" />}
        </Combobox.Trigger>
        {hasValue && <ClearButton onClear={() => onChange(null)} />}
      </div>
      <ComboPopup searchPlaceholder={searchPlaceholder} container={container}>
        {renderItem}
      </ComboPopup>
    </Combobox.Root>
  );
}

/** Multi-select combobox with type-to-search; click toggles (select/deselect). */
export function MultiSearchCombo({
  placeholder,
  searchPlaceholder = "Search…",
  options,
  selected,
  onChange,
  className,
  chips = false,
  container,
}: {
  placeholder: string;
  searchPlaceholder?: string;
  options: ComboOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** Show each selection as a removable chip (instead of a "N selected" summary). */
  chips?: boolean;
  container?: React.RefObject<HTMLElement | null>;
}) {
  const set = new Set(selected);
  const chosen = options.filter((o) => set.has(o.value));
  const summary =
    chosen.length === 0
      ? placeholder
      : chosen.length <= 2
        ? chosen.map((o) => o.label).join(", ")
        : `${chosen.length} selected`;
  return (
    <Combobox.Root
      multiple
      items={options}
      value={chosen}
      onValueChange={(vals: ComboOption[]) => onChange(vals.map((o) => o.value))}
      isItemEqualToValue={eq}
      itemToStringLabel={toLabel}
    >
      {chips ? (
        // Chips above a full-width trigger (the trigger stays the popup anchor → popup matches width).
        <div
          className={cn(
            "w-full rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
            className,
          )}
        >
          {chosen.length > 0 && (
            <div className="flex flex-wrap gap-1 px-1.5 pt-1.5">
              {chosen.map((o) => (
                <span key={o.value} className="flex items-center gap-1 rounded-md bg-muted py-0.5 pl-1.5 pr-1 text-xs">
                  <Dot color={o.color} />
                  <span className="max-w-[12rem] truncate">{o.label}</span>
                  <button
                    type="button"
                    title={`Remove ${o.label}`}
                    onClick={() => onChange(selected.filter((v) => v !== o.value))}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Combobox.Trigger className="flex h-8 w-full items-center justify-between gap-2 px-2.5 text-sm outline-none">
            <span className={cn("truncate", chosen.length === 0 && "text-muted-foreground")}>
              {chosen.length === 0 ? placeholder : "Add more…"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Combobox.Trigger>
        </div>
      ) : (
        <div className={cn(wrapperCls, className)}>
          <Combobox.Trigger className={cn(triggerCls, chosen.length > 0 && "pr-8")}>
            <span className={cn("truncate", chosen.length === 0 && "text-muted-foreground")}>{summary}</span>
            {chosen.length === 0 && <ChevronsUpDown className="size-4 shrink-0 opacity-50" />}
          </Combobox.Trigger>
          {chosen.length > 0 && <ClearButton onClear={() => onChange([])} />}
        </div>
      )}
      <ComboPopup searchPlaceholder={searchPlaceholder} container={container}>
        {renderItem}
      </ComboPopup>
    </Combobox.Root>
  );
}
