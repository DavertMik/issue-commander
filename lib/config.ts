import type { AppConfig } from "@/lib/types";

/**
 * Server-side default repository / milestone / project, read from CLI flags (normalized
 * into `IC_DEFAULT_*` env vars by bin/issue-commander.js) or set directly in the environment.
 * These seed the client config on first run; the in-app Settings dialog overrides them.
 * Returns null when nothing is configured, so the client keeps its own saved settings.
 */
export function envDefaults(): AppConfig | null {
  const defaultRepository = process.env.IC_DEFAULT_REPO?.trim() || null;
  const defaultMilestone = process.env.IC_DEFAULT_MILESTONE?.trim() || null;
  const projectRaw = process.env.IC_DEFAULT_PROJECT?.trim();
  const defaultProject = projectRaw && /^\d+$/.test(projectRaw) ? Number(projectRaw) : null;

  if (!defaultRepository && !defaultMilestone && defaultProject == null) return null;
  return { defaultRepository, defaultMilestone, defaultProject };
}
