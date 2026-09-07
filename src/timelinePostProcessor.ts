// Reading-view post-processor: for timeline documents (frontmatter has
// `timelineId`), replaces the rendered markdown event table with a visual
// timeline. The stored markdown stays a clean, natively-rendered table; only
// the reading-view presentation is enhanced.

import { Plugin, MarkdownPostProcessorContext } from "obsidian";
import { Timeline, TimelineEvent, generateId } from "./types";
import { renderTimeline } from "./timelineRender";

export function registerTimelinePostProcessor(plugin: Plugin): void {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    enhanceTimelineTable(el, ctx).catch(() => {
      /* swallow: reading view must never throw */
    });
  });
}

async function enhanceTimelineTable(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): Promise<void> {
  const frontmatter = (ctx as unknown as { frontmatter?: Record<string, unknown> }).frontmatter;
  const sourcePath = ctx.sourcePath;
  if (!frontmatter || !frontmatter.timelineId) return;

  const table = el.querySelector("table");
  if (!table) return;

  // Only act on tables whose header looks like a timeline table.
  const headerCells = Array.from(table.querySelectorAll("thead th, thead td, tr:first-child th"))
    .map((c) => (c.textContent || "").trim().toLowerCase());
  if (!headerCells.some((h) => h.includes("时间")) || !headerCells.some((h) => h.includes("事件"))) {
    return;
  }

  const rows = Array.from(table.querySelectorAll("tbody tr"));
  if (rows.length === 0) return;

  const events: TimelineEvent[] = rows
    .map((row) => parseRenderedRow(row))
    .filter((e): e is TimelineEvent => e !== null);
  if (events.length === 0) return;

  // frontmatter is an object map; pull known fields directly.
  const title = String(frontmatter.title ?? sourcePath?.split("/").pop()?.replace(/\.md$/, "") ?? "时间线");
  const now = new Date().toISOString();

  const timeline: Timeline = {
    version: 1,
    id: String(frontmatter.timelineId),
    title,
    description: undefined,
    events,
    createdAt: String(frontmatter.createdAt ?? now),
    updatedAt: String(frontmatter.updatedAt ?? now),
  };

  const host = document.createElement("div");
  host.addClass("timeline-render-host");
  renderTimeline(host, timeline, { showHeader: false, isDark: el.closest(".theme-dark, .dark") !== null });
  table.replaceWith(host);
}

/** Parse a rendered <tr> (tbody) into a TimelineEvent. */
function parseRenderedRow(row: Element): TimelineEvent | null {
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 2) return null;
  const date = (cells[0]?.textContent ?? "").trim();
  const title = (cells[1]?.textContent ?? "").trim();
  const description = (cells[2]?.textContent ?? "").trim();
  if (!date && !title && !description) return null;
  return {
    id: generateId(),
    date: date || new Date().toISOString().slice(0, 10),
    title: title || "未命名事件",
    description: description || undefined,
  };
}
