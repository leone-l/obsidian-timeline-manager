// Timeline data model. An event is intentionally minimal: a time, a short
// event name, and an optional short description. The visual color is derived
// from the event's position (index) using the Google chart palette, so the
// stored markdown stays a clean three-column table.

/** A single event on a timeline. */
export interface TimelineEvent {
  id: string;
  /** 时间: ISO date "YYYY-MM-DD" or "YYYY-MM-DD HH:mm". */
  date: string;
  /** 事件: short event name. */
  title: string;
  /** 描述: optional short description. */
  description?: string;
}

/** A full timeline document (one markdown file per timeline). */
export interface Timeline {
  /** Schema version of the stored payload. */
  version: number;
  /** Stable id, mirrored in frontmatter `timelineId`. */
  id: string;
  title: string;
  description?: string;
  events: TimelineEvent[];
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

export const TIMELINE_SCHEMA_VERSION = 1;

/** Chart palette used to color events by index (Google data-visualization colors). */
export const CHART_PALETTE_LIGHT = ["#4285f4", "#ea4335", "#fbbc05", "#0043ad", "#34a853"];
export const CHART_PALETTE_DARK = ["#2dccd3", "#f1204a", "#edbbe8", "#fbeb35", "#baf6f0"];

/** Derive an event's color from its position in the timeline. */
export function colorForIndex(index: number, isDark: boolean): string {
  const palette = isDark ? CHART_PALETTE_DARK : CHART_PALETTE_LIGHT;
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/** Generate a reasonably unique id without external deps. */
export function generateId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** Validate that a string looks like a sortable ISO date. */
export function isValidEventDate(date: string | undefined): date is string {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}(.+:.+)?$/.test(date);
}

/**
 * Sort events chronologically (ascending). Used by the optional "sort by date"
 * action; the default display order is the user's dragged order.
 */
export function sortEventsAscending(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const aValid = isValidEventDate(a.date);
    const bValid = isValidEventDate(b.date);
    if (aValid && bValid) return a.date.localeCompare(b.date);
    if (aValid) return -1;
    if (bValid) return 1;
    return a.title.localeCompare(b.title);
  });
}
