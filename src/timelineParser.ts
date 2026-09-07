// Parse and serialize timelines to/from markdown documents.
//
// Storage format (one file per timeline):
//   - YAML frontmatter holds metadata (timelineId, title, createdAt, updatedAt).
//   - A GFM markdown table with headers 时间 | 事件 | 描述 holds the events.
//
// The table is the canonical, human-readable store: it renders natively in both
// source and reading view, and the plugin transforms it into a visual timeline
// in reading view via a post-processor. Event ids are not stored (they would
// pollute the table); they are generated per load and are ephemeral.

import {
  Timeline,
  TimelineEvent,
  TIMELINE_SCHEMA_VERSION,
  generateId,
} from "./types";

const HEADER_KEYS = ["时间", "事件"];

export interface ExtractResult {
  timeline: Timeline | null;
  /** Character span of the matched table block (for surgical replace). */
  startIndex: number;
  endIndex: number;
}

/** Extract the timeline (frontmatter + first timeline table) from markdown. */
export function extractTimeline(content: string): ExtractResult {
  const empty: ExtractResult = { timeline: null, startIndex: 0, endIndex: 0 };
  if (!content) return empty;

  const table = findTimelineTable(content);
  if (!table) return empty;

  const events = table.rows.map((row) => parseEventRow(row)).filter(Boolean) as TimelineEvent[];
  const fm = parseFrontmatter(content);
  const now = new Date().toISOString();

  const timeline: Timeline = {
    version: TIMELINE_SCHEMA_VERSION,
    id: fm.timelineId || generateId(),
    title: fm.title || table.title || "Untitled timeline",
    description: fm.description,
    events,
    createdAt: fm.createdAt || now,
    updatedAt: fm.updatedAt || now,
  };

  return { timeline, startIndex: table.startIndex, endIndex: table.endIndex };
}

interface FoundTable {
  startIndex: number;
  endIndex: number;
  rows: string[][];
  title: string;
}

/** Find the first GFM table whose header contains 时间 and 事件. */
function findTimelineTable(content: string): FoundTable | null {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      // Potential table start. Read contiguous table lines.
      const startLine = i;
      const block: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      if (block.length >= 2) {
        const header = splitRow(block[0]).map((c) => c.trim().toLowerCase());
        const isTimeline = HEADER_KEYS.every((k) => header.some((h) => h.includes(k.toLowerCase())));
        if (isTimeline) {
          // block[1] is the separator; data rows start at block[2].
          const dataRows = block.slice(2).map(splitRow);
          const startChar = lineOffset(lines, startLine);
          const endChar = lineOffset(lines, i); // i is one past the last table line
          const title = inferTitleFromDoc(content);
          return { startIndex: startChar, endIndex: endChar, rows: dataRows, title };
        }
      }
      continue;
    }
    i++;
  }
  return null;
}

/** Convert a line offset to a character offset in the original content. */
function lineOffset(lines: string[], lineIndex: number): number {
  if (lineIndex <= 0) return 0;
  let offset = 0;
  for (let k = 0; k < lineIndex && k < lines.length; k++) {
    offset += lines[k].length + 1; // +1 for the "\n"
  }
  return offset;
}

/** Split a GFM table row into cells, un-escaping \| and \\ correctly. */
function splitRow(row: string): string[] {
  const trimmed = row.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
  // Mask escaped sequences before splitting: escaped backslash first, then
  // escaped pipe, so only real column-separating pipes remain.
  const BACKSLASH = "\u0001";
  const PIPE = "\u0002";
  const masked = trimmed
    .replace(/\\\\/g, BACKSLASH) // escaped backslash
    .replace(/\\\|/g, PIPE);     // escaped pipe
  return masked
    .split("|")
    .map((cell) => cell.replace(new RegExp(PIPE, "g"), "|").replace(new RegExp(BACKSLASH, "g"), "\\").trim());
}

/** Parse a table data row into a TimelineEvent. */
function parseEventRow(row: string[]): TimelineEvent | null {
  const date = (row[0] ?? "").trim();
  const title = (row[1] ?? "").trim();
  const description = (row[2] ?? "").trim();
  if (!date && !title && !description) return null;
  return {
    id: generateId(),
    date: date || new Date().toISOString().slice(0, 10),
    title: title || "Untitled event",
    description: description || undefined,
  };
}

/** Serialize a single event into a table data row. */
function eventToRow(event: TimelineEvent): string {
  const date = escapeCell(event.date);
  const title = escapeCell(event.title);
  const desc = escapeCell(event.description ?? "");
  return `| ${date} | ${title} | ${desc} |`;
}

/** Escape a cell value so it stays on one row. */
function escapeCell(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/** Build the markdown table for a timeline. */
export function buildTimelineTable(timeline: Timeline): string {
  const header = "| 时间 | 事件 | 描述 |";
  const separator = "| --- | --- | --- |";
  const rows = timeline.events.map(eventToRow);
  return [header, separator, ...rows].join("\n");
}

/** Replace the timeline table in `content`, or append a new one if absent.
 *  Also syncs the title/updatedAt in frontmatter and the first heading. */
export function replaceTimelineTable(content: string, timeline: Timeline): string {
  const table = buildTimelineTable(timeline);
  const { startIndex, endIndex, timeline: existing } = extractTimeline(content);
  if (!existing) {
    return buildTimelineMarkdown(timeline);
  }
  let next = content.slice(0, startIndex) + table + content.slice(endIndex);
  next = syncFrontmatter(next, timeline);
  next = syncHeading(next, timeline.title);
  return next;
}

/** Update title / updatedAt / timelineId in the frontmatter (if present). */
function syncFrontmatter(content: string, timeline: Timeline): string {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) return content;
  let body = fmMatch[1];
  const set = (key: string, value: string) => {
    const re = new RegExp(`^${key}:.*$`, "m");
    if (re.test(body)) {
      body = body.replace(re, `${key}: ${value}`);
    } else {
      body = `${body}\n${key}: ${value}`;
    }
  };
  set("timelineId", timeline.id);
  set("title", yamlScalar(timeline.title));
  set("updatedAt", timeline.updatedAt);
  return content.slice(0, fmMatch.index) + "---\n" + body + "\n---" + content.slice((fmMatch.index ?? 0) + fmMatch[0].length);
}

/** Replace the first markdown heading with `# title` (if a heading exists). */
function syncHeading(content: string, title: string): string {
  const headingMatch = content.match(/^(#{1,6})\s+.+\s*$/m);
  if (!headingMatch) return content;
  const hashes = headingMatch[1];
  return content.slice(0, headingMatch.index) +
    `${hashes} ${title}` +
    content.slice((headingMatch.index ?? 0) + headingMatch[0].length);
}

/** Generate a full markdown document for a timeline (used for new files). */
export function buildTimelineMarkdown(timeline: Timeline): string {
  const parts: string[] = [];
  parts.push("---");
  parts.push(`timelineId: ${timeline.id}`);
  parts.push(`title: ${yamlScalar(timeline.title)}`);
  parts.push(`createdAt: ${timeline.createdAt}`);
  parts.push(`updatedAt: ${timeline.updatedAt}`);
  parts.push("---");
  parts.push("");
  parts.push(`# ${timeline.title}`);
  parts.push("");
  if (timeline.description) {
    parts.push(timeline.description);
    parts.push("");
  }
  parts.push(buildTimelineTable(timeline));
  parts.push("");
  return parts.join("\n");
}

/** Parse a small YAML frontmatter block into a flat string map. */
export function parseFrontmatter(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) return out;
  const lines = fmMatch[1].split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Best-effort title from a heading, falling back to a default. */
function inferTitleFromDoc(content: string): string {
  const heading = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  if (heading) return heading[1].trim();
  return "Untitled timeline";
}

/** Quote a string for YAML scalar usage. */
function yamlScalar(value: string): string {
  const cleaned = (value ?? "").replace(/["\\]/g, " ").trim();
  return `"${cleaned}"`;
}
