// Smoke test: round-trip a Timeline through buildMarkdown -> extractTimeline,
// using the new markdown-table storage format. Bundled & run via esbuild.

import { buildTimelineMarkdown, extractTimeline, replaceTimelineTable, buildTimelineTable } from "../src/timelineParser";
import { Timeline } from "../src/types";

const sample: Timeline = {
  version: 1,
  id: "abc-123",
  title: "产品发布计划",
  description: "Q3 发布的跨团队里程碑。",
  createdAt: "2024-03-15T10:00:00.000Z",
  updatedAt: "2024-03-15T10:00:00.000Z",
  events: [
    { id: "e1", date: "2024-03-20", title: "启动会", description: "全员启动" },
    { id: "e2", date: "2024-04-01", title: "设计冻结" },
    { id: "e3", date: "2024-04-15 14:30", title: "Beta 发布", description: "含管道符 | 与\\反斜杠" },
  ],
};

const md = buildTimelineMarkdown(sample);
console.log("--- generated markdown ---");
console.log(md);

console.log("\n--- extracted ---");
const { timeline } = extractTimeline(md);
if (!timeline) throw new Error("extractTimeline returned null");
console.log("id:", timeline.id, "| title:", timeline.title, "| events:", timeline.events.length);

// Compare the three user-facing fields (ids are ephemeral, generated per load).
const fieldsEqual = timeline.events.every((e, i) => {
  const o = sample.events[i];
  return e.date === o.date && e.title === o.title && (e.description ?? "") === (o.description ?? "");
});
console.log("event fields round-trip equal:", fieldsEqual);
if (!fieldsEqual) throw new Error("events did not round-trip cleanly");

// Pipe/backslash escaping must survive.
const e3 = timeline.events[2];
console.log("special chars preserved:", e3.description === "含管道符 | 与\\反斜杠");
if (e3.description !== "含管道符 | 与\\反斜杠") throw new Error("escaping broke on round-trip");

// Replace preserves surrounding prose and syncs title/updatedAt. In a valid
// Obsidian doc the frontmatter sits at the very top, so we build the fixture
// by inserting prose *inside* the generated doc rather than prepending it.
const withProse = md
  .replace(/(#[^\n]+\n\n)/, `$1用户写的正文。\n\n`)
  + "正文结尾。\n";
const renamedTl = { ...sample, title: "重命名后的时间线", updatedAt: "2025-01-01T00:00:00.000Z" };
const replaced = replaceTimelineTable(withProse, renamedTl);
console.log("\nprose preserved above:", replaced.includes("用户写的正文。"));
console.log("prose preserved below:", replaced.includes("正文结尾。"));
console.log("renamed in heading:", replaced.includes("# 重命名后的时间线"));
console.log("renamed in frontmatter:", replaced.includes('title: "重命名后的时间线"'));
console.log("updatedAt synced:", replaced.includes("updatedAt: 2025-01-01T00:00:00.000Z"));
console.log("old updatedAt gone:", replaced.includes(`updatedAt: ${sample.updatedAt}`) === false);
if (!replaced.includes("用户写的正文。") || !replaced.includes("正文结尾。")) {
  throw new Error("surrounding prose was lost on replace");
}
if (!replaced.includes('title: "重命名后的时间线"')) {
  throw new Error("frontmatter title was not synced on rename");
}
if (!replaced.includes("# 重命名后的时间线")) {
  throw new Error("heading was not synced on rename");
}

// Empty events.
const emptyTl = { ...sample, events: [] };
const emptyMd = buildTimelineMarkdown(emptyTl);
const { timeline: emptyOut } = extractTimeline(emptyMd);
console.log("\nempty events round-trip count:", emptyOut?.events.length);

// buildTimelineTable standalone.
const table = buildTimelineTable(sample);
console.log("table starts with header:", table.startsWith("| 时间 | 事件 | 描述 |"));
console.log("table has separator:", table.includes("| --- | --- | --- |"));

console.log("\nALL SMOKE TESTS PASSED");
