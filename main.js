"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TimelineManagerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  defaultFolder: "Timelines",
  openAfterCreate: false,
  showEventCounts: true,
  autoSave: true,
  autoSaveDelay: 1200
};
var TimelineSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin, onChange) {
    super(app, plugin);
    this.plugin = plugin;
    this.onChange = onChange;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("\u9ED8\u8BA4\u6587\u4EF6\u5939").setDesc("\u65B0\u5EFA\u7684\u65F6\u95F4\u7EBF\u6587\u6863\u5C06\u521B\u5EFA\u5728\u8BE5\u4ED3\u5E93\u6587\u4EF6\u5939\u4E0B\u3002").addText((text) => {
      text.setValue(this.plugin.settings.defaultFolder).onChange(async (value) => {
        this.plugin.settings.defaultFolder = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u521B\u5EFA\u540E\u6253\u5F00\u6587\u6863").setDesc("\u521B\u5EFA\u65F6\u95F4\u7EBF\u540E\uFF0C\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00\u5BF9\u5E94\u7684 markdown \u6587\u4EF6\u3002").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.openAfterCreate).onChange(async (value) => {
        this.plugin.settings.openAfterCreate = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u663E\u793A\u4E8B\u4EF6\u6570\u91CF").setDesc("\u5728\u4FA7\u680F\u7684\u6BCF\u4E2A\u65F6\u95F4\u7EBF\u65C1\u663E\u793A\u5176\u4E8B\u4EF6\u6570\u91CF\u3002").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.showEventCounts).onChange(async (value) => {
        this.plugin.settings.showEventCounts = value;
        await this.plugin.saveSettings();
        this.onChange();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u4FDD\u5B58").setDesc("\u7F16\u8F91\u65F6\u95F4\u7EBF\u540E\u81EA\u52A8\u4FDD\u5B58\u5230\u5BF9\u5E94\u7684 markdown \u6587\u6863\uFF0C\u65E0\u9700\u624B\u52A8\u70B9\u51FB\u4FDD\u5B58\u3002").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoSave).onChange(async (value) => {
        this.plugin.settings.autoSave = value;
        await this.plugin.saveSettings();
      });
    });
  }
};

// src/timelineRepository.ts
var import_obsidian2 = require("obsidian");

// src/types.ts
var TIMELINE_SCHEMA_VERSION = 1;
var CHART_PALETTE_LIGHT = ["#4285f4", "#ea4335", "#fbbc05", "#0043ad", "#34a853"];
var CHART_PALETTE_DARK = ["#2dccd3", "#f1204a", "#edbbe8", "#fbeb35", "#baf6f0"];
function colorForIndex(index, isDark) {
  const palette = isDark ? CHART_PALETTE_DARK : CHART_PALETTE_LIGHT;
  return palette[(index % palette.length + palette.length) % palette.length];
}
function generateId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
function isValidEventDate(date) {
  if (!date)
    return false;
  return /^\d{4}-\d{2}-\d{2}(.+:.+)?$/.test(date);
}
function sortEventsAscending(events) {
  return [...events].sort((a, b) => {
    const aValid = isValidEventDate(a.date);
    const bValid = isValidEventDate(b.date);
    if (aValid && bValid)
      return a.date.localeCompare(b.date);
    if (aValid)
      return -1;
    if (bValid)
      return 1;
    return a.title.localeCompare(b.title);
  });
}

// src/timelineParser.ts
var HEADER_KEYS = ["\u65F6\u95F4", "\u4E8B\u4EF6"];
function extractTimeline(content) {
  const empty = { timeline: null, startIndex: 0, endIndex: 0 };
  if (!content)
    return empty;
  const table = findTimelineTable(content);
  if (!table)
    return empty;
  const events = table.rows.map((row) => parseEventRow(row)).filter(Boolean);
  const fm = parseFrontmatter(content);
  const now = new Date().toISOString();
  const timeline = {
    version: TIMELINE_SCHEMA_VERSION,
    id: fm.timelineId || generateId(),
    title: fm.title || table.title || "Untitled timeline",
    description: fm.description,
    events,
    createdAt: fm.createdAt || now,
    updatedAt: fm.updatedAt || now
  };
  return { timeline, startIndex: table.startIndex, endIndex: table.endIndex };
}
function findTimelineTable(content) {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      const startLine = i;
      const block = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      if (block.length >= 2) {
        const header = splitRow(block[0]).map((c) => c.trim().toLowerCase());
        const isTimeline = HEADER_KEYS.every((k) => header.some((h) => h.includes(k.toLowerCase())));
        if (isTimeline) {
          const dataRows = block.slice(2).map(splitRow);
          const startChar = lineOffset(lines, startLine);
          const endChar = lineOffset(lines, i);
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
function lineOffset(lines, lineIndex) {
  if (lineIndex <= 0)
    return 0;
  let offset = 0;
  for (let k = 0; k < lineIndex && k < lines.length; k++) {
    offset += lines[k].length + 1;
  }
  return offset;
}
function splitRow(row) {
  const trimmed = row.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
  const BACKSLASH = "";
  const PIPE = "";
  const masked = trimmed.replace(/\\\\/g, BACKSLASH).replace(/\\\|/g, PIPE);
  return masked.split("|").map((cell) => cell.replace(new RegExp(PIPE, "g"), "|").replace(new RegExp(BACKSLASH, "g"), "\\").trim());
}
function parseEventRow(row) {
  var _a, _b, _c;
  const date = ((_a = row[0]) != null ? _a : "").trim();
  const title = ((_b = row[1]) != null ? _b : "").trim();
  const description = ((_c = row[2]) != null ? _c : "").trim();
  if (!date && !title && !description)
    return null;
  return {
    id: generateId(),
    date: date || new Date().toISOString().slice(0, 10),
    title: title || "Untitled event",
    description: description || void 0
  };
}
function eventToRow(event) {
  var _a;
  const date = escapeCell(event.date);
  const title = escapeCell(event.title);
  const desc = escapeCell((_a = event.description) != null ? _a : "");
  return `| ${date} | ${title} | ${desc} |`;
}
function escapeCell(value) {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
function buildTimelineTable(timeline) {
  const header = "| \u65F6\u95F4 | \u4E8B\u4EF6 | \u63CF\u8FF0 |";
  const separator = "| --- | --- | --- |";
  const rows = timeline.events.map(eventToRow);
  return [header, separator, ...rows].join("\n");
}
function replaceTimelineTable(content, timeline) {
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
function syncFrontmatter(content, timeline) {
  var _a;
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch)
    return content;
  let body = fmMatch[1];
  const set = (key, value) => {
    const re = new RegExp(`^${key}:.*$`, "m");
    if (re.test(body)) {
      body = body.replace(re, `${key}: ${value}`);
    } else {
      body = `${body}
${key}: ${value}`;
    }
  };
  set("timelineId", timeline.id);
  set("title", yamlScalar(timeline.title));
  set("updatedAt", timeline.updatedAt);
  return content.slice(0, fmMatch.index) + "---\n" + body + "\n---" + content.slice(((_a = fmMatch.index) != null ? _a : 0) + fmMatch[0].length);
}
function syncHeading(content, title) {
  var _a;
  const headingMatch = content.match(/^(#{1,6})\s+.+\s*$/m);
  if (!headingMatch)
    return content;
  const hashes = headingMatch[1];
  return content.slice(0, headingMatch.index) + `${hashes} ${title}` + content.slice(((_a = headingMatch.index) != null ? _a : 0) + headingMatch[0].length);
}
function buildTimelineMarkdown(timeline) {
  const parts = [];
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
function parseFrontmatter(content) {
  const out = {};
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch)
    return out;
  const lines = fmMatch[1].split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1)
      continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (key)
      out[key] = value;
  }
  return out;
}
function inferTitleFromDoc(content) {
  const heading = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  if (heading)
    return heading[1].trim();
  return "Untitled timeline";
}
function yamlScalar(value) {
  const cleaned = (value != null ? value : "").replace(/["\\]/g, " ").trim();
  return `"${cleaned}"`;
}

// src/timelineRepository.ts
var TimelineRepository = class {
  constructor(app) {
    this.app = app;
  }
  /** Scan the vault for files containing a timeline code block. */
  async findAll() {
    const files = this.app.vault.getMarkdownFiles();
    const out = [];
    for (const file of files) {
      const doc = await this.toTimelineDoc(file);
      if (doc)
        out.push(doc);
    }
    out.sort((a, b) => {
      const au = a.updatedAt || "";
      const bu = b.updatedAt || "";
      return bu.localeCompare(au);
    });
    return out;
  }
  /** Load a single timeline by file path. */
  async load(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian2.TFile))
      return null;
    const doc = await this.toTimelineDoc(file);
    return doc ? doc.timeline : null;
  }
  /** Persist a (possibly new) timeline to disk and return its path. */
  async save(timeline, targetPath) {
    const normalized = (0, import_obsidian2.normalizePath)(targetPath);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof import_obsidian2.TFile) {
      const content = await this.app.vault.read(existing);
      const next = replaceTimelineTable(content, timeline);
      await this.app.vault.modify(existing, next);
      return existing.path;
    }
    await this.ensureFolder(normalized);
    const body = buildTimelineMarkdown(timeline);
    const created = await this.app.vault.create(normalized, body);
    return created.path;
  }
  /** Delete a timeline document from the vault. */
  async delete(path) {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path));
    if (file instanceof import_obsidian2.TFile) {
      await this.app.vault.trash(file, true);
    }
  }
  /** Open the underlying markdown file in a new leaf. */
  async openFile(path, newLeaf = false) {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path));
    if (file instanceof import_obsidian2.TFile) {
      await this.app.workspace.getLeaf(newLeaf).openFile(file);
    }
  }
  /** Build a vault-relative file path for a new timeline. */
  buildPath(folder, title) {
    const safe = (title || "untimeline").trim().replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "untimeline";
    const folderPart = folder ? folder.replace(/\/+$/, "") : "";
    const name = `${safe}.md`;
    return (0, import_obsidian2.normalizePath)(folderPart ? `${folderPart}/${name}` : name);
  }
  /** Avoid clobbering an existing file when creating a new timeline. */
  async uniquePath(base) {
    let candidate = base;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(candidate) instanceof import_obsidian2.TFile) {
      const dot = base.lastIndexOf(".");
      candidate = dot > 0 ? `${base.slice(0, dot)} ${counter}${base.slice(dot)}` : `${base} ${counter}`;
      counter++;
    }
    return candidate;
  }
  async toTimelineDoc(file) {
    var _a;
    if (file.extension !== "md")
      return null;
    const content = await this.app.vault.cachedRead(file);
    const { timeline } = extractTimeline(content);
    if (!timeline)
      return null;
    return {
      path: file.path,
      name: file.basename,
      timeline,
      eventCount: timeline.events.length,
      updatedAt: timeline.updatedAt || ((_a = file.stat.mtime) == null ? void 0 : _a.toString()) || ""
    };
  }
  async ensureFolder(filePath) {
    const slash = filePath.lastIndexOf("/");
    if (slash <= 0)
      return;
    const folderPath = filePath.slice(0, slash);
    if (this.app.vault.getAbstractFileByPath(folderPath) instanceof import_obsidian2.TFolder)
      return;
    try {
      await this.app.vault.createFolder(folderPath);
    } catch (e) {
    }
  }
};

// src/timelineView.ts
var import_obsidian4 = require("obsidian");

// src/timelineEditor.ts
var import_obsidian3 = require("obsidian");

// src/icons.ts
var SVG_ATTRS = `xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
var ICON_PATHS = {
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  "refresh-cw": `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  plus: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  trash: `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  "file-text": `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  "external-link": `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`,
  pencil: `<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
  x: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  check: `<polyline points="20 6 9 17 4 12"/>`,
  "chevron-right": `<polyline points="9 18 15 12 9 6"/>`,
  folder: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
  search: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`
};
function setSvgIcon(el, name) {
  const inner = ICON_PATHS[name];
  if (!inner) {
    el.empty();
    return;
  }
  el.innerHTML = `<svg ${SVG_ATTRS}>${inner}</svg>`;
}

// src/timelineRender.ts
function renderTimeline(container, timeline, options = {}) {
  var _a, _b, _c, _d;
  container.empty();
  container.addClass("timeline-render");
  const isDark = (_a = options.isDark) != null ? _a : container.closest(".theme-dark, .dark") !== null;
  if (options.showHeader !== false) {
    const header = container.createDiv({ cls: "timeline-render__header" });
    header.createEl("h3", {
      cls: "timeline-render__title",
      text: timeline.title || "Untitled timeline"
    });
    if (timeline.description) {
      header.createEl("p", {
        cls: "timeline-render__description",
        text: timeline.description
      });
    }
    const events = (_b = timeline.events) != null ? _b : [];
    const ordered2 = options.sortByDate ? sortEventsAscending(events) : events;
    const meta = header.createDiv({ cls: "timeline-render__meta" });
    const countPill = meta.createEl("span", {
      cls: "timeline-render__pill",
      text: `${events.length} \u4E2A\u4E8B\u4EF6`
    });
    countPill.createEl("span", {
      cls: "timeline-render__pill-dot",
      attr: { "aria-hidden": "true" }
    });
    if (ordered2.length) {
      const first = formatDate(ordered2[0].date);
      const last = formatDate(ordered2[ordered2.length - 1].date);
      meta.createEl("span", {
        cls: "timeline-render__range",
        text: `${first} \u2192 ${last}`
      });
    }
  }
  const list = container.createDiv({ cls: "timeline-render__list" });
  const ordered = options.sortByDate ? sortEventsAscending((_c = timeline.events) != null ? _c : []) : (_d = timeline.events) != null ? _d : [];
  if (ordered.length === 0) {
    list.createDiv({
      cls: "timeline-render__empty",
      text: "\u8FD8\u6CA1\u6709\u4E8B\u4EF6\u3002\u5728\u7BA1\u7406\u9875\u9762\u4E2D\u6DFB\u52A0\u6216\u62D6\u62FD\u6765\u7EC4\u7EC7\u65F6\u95F4\u7EBF\u3002"
    });
    return;
  }
  ordered.forEach((event, index) => {
    const color = colorForIndex(index, isDark);
    const row = list.createDiv({
      cls: "timeline-event" + (options.draggable ? " is-draggable" : "") + (options.onEventClick ? " is-interactive" : ""),
      attr: {
        "data-event-id": event.id,
        "data-event-index": String(index)
      }
    });
    row.style.setProperty("--event-color", color);
    if (options.draggable) {
      const handle = row.createDiv({
        cls: "timeline-event__grip",
        attr: { "aria-hidden": "true", "data-drag-handle": "true", draggable: "true" }
      });
      handle.setText("\u283F");
    }
    const marker = row.createDiv({ cls: "timeline-event__marker" });
    marker.createEl("span", {
      cls: "timeline-event__dot",
      attr: { "aria-hidden": "true" }
    });
    const body = row.createDiv({ cls: "timeline-event__body" });
    body.createEl("time", {
      cls: "timeline-event__date",
      text: formatDate(event.date),
      attr: { datetime: event.date }
    });
    body.createEl("h4", {
      cls: "timeline-event__title",
      text: event.title
    });
    if (event.description) {
      body.createEl("p", {
        cls: "timeline-event__description",
        text: event.description
      });
    }
    if (options.onEventClick) {
      row.setAttr("role", "button");
      row.setAttr("tabindex", "0");
      const handler = (ev) => {
        var _a2;
        const target = ev.target;
        if (target.closest(".timeline-event__grip"))
          return;
        ev.preventDefault();
        (_a2 = options.onEventClick) == null ? void 0 : _a2.call(options, event, index);
      };
      row.onclick = handler;
      row.onkeydown = (ev) => {
        var _a2;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          (_a2 = options.onEventClick) == null ? void 0 : _a2.call(options, event, index);
        }
      };
    }
  });
  if (options.draggable && options.onReorder) {
    attachDragReorder(list, options.onReorder);
  }
}
function attachDragReorder(list, onReorder) {
  let dragId = null;
  list.addEventListener("dragstart", (ev) => {
    const grip = ev.target.closest("[data-drag-handle]");
    if (!grip)
      return;
    const row = grip.closest(".timeline-event");
    if (!row)
      return;
    dragId = row.getAttribute("data-event-id");
    row.addClass("is-dragging");
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", dragId != null ? dragId : "");
    }
  });
  list.addEventListener("dragend", () => {
    list.querySelectorAll(".timeline-event").forEach(
      (el) => el.removeClass("is-dragging", "is-drop-target")
    );
    dragId = null;
  });
  list.addEventListener("dragover", (ev) => {
    const row = ev.target.closest(".timeline-event");
    if (!row || row.getAttribute("data-event-id") === dragId)
      return;
    ev.preventDefault();
    if (ev.dataTransfer)
      ev.dataTransfer.dropEffect = "move";
    list.querySelectorAll(".is-drop-target").forEach(
      (el) => el.removeClass("is-drop-target")
    );
    row.addClass("is-drop-target");
  });
  list.addEventListener("dragleave", (ev) => {
    const row = ev.target.closest(".timeline-event");
    row == null ? void 0 : row.removeClass("is-drop-target");
  });
  list.addEventListener("drop", (ev) => {
    const row = ev.target.closest(".timeline-event");
    if (!row || !dragId)
      return;
    ev.preventDefault();
    const targetId = row.getAttribute("data-event-id");
    if (targetId && targetId !== dragId) {
      onReorder(dragId, targetId);
    }
    row.removeClass("is-drop-target");
    dragId = null;
  });
}
function formatDate(raw) {
  const trimmed = raw == null ? void 0 : raw.trim();
  if (!trimmed)
    return "\u672A\u6CE8\u660E";
  const dateOnly = trimmed.slice(0, 10);
  const date = new Date(dateOnly + "T00:00:00");
  if (isNaN(date.getTime()))
    return trimmed;
  const months = [
    "1\u6708",
    "2\u6708",
    "3\u6708",
    "4\u6708",
    "5\u6708",
    "6\u6708",
    "7\u6708",
    "8\u6708",
    "9\u6708",
    "10\u6708",
    "11\u6708",
    "12\u6708"
  ];
  const timePart = trimmed.length > 10 ? trimmed.slice(11, 16) : "";
  const label = `${date.getFullYear()} ${months[date.getMonth()]}${date.getDate()}\u65E5`;
  return timePart ? `${label} ${timePart}` : label;
}

// src/timelineEditor.ts
var TimelineEditor = class {
  constructor(app, container, repo, settings, callbacks = {}) {
    this.app = app;
    this.container = container;
    this.repo = repo;
    this.settings = settings;
    this.callbacks = callbacks;
    this.timeline = null;
    this.path = null;
    this.dirty = false;
    this.formMode = { kind: "closed" };
    this.sortByDate = false;
    /** Pending auto-save timer id (from setTimeout). Null when none scheduled. */
    this.autoSaveTimer = null;
    /** True while an auto-save is in flight, to avoid concurrent writes. */
    this.saving = false;
    this.container.empty();
    this.container.addClass("tl-editor");
  }
  async load(timeline, path) {
    var _a, _b;
    await this.flushSave();
    this.timeline = JSON.parse(JSON.stringify(timeline));
    this.path = path;
    this.dirty = false;
    this.formMode = { kind: "closed" };
    this.sortByDate = false;
    this.clearAutoSaveTimer();
    (_b = (_a = this.callbacks).onDirtyChange) == null ? void 0 : _b.call(_a, false);
    this.render();
  }
  async close() {
    try {
      await this.flushSave();
    } catch (e) {
    }
    this.timeline = null;
    this.path = null;
    this.dirty = false;
    this.formMode = { kind: "closed" };
    this.sortByDate = false;
    this.clearAutoSaveTimer();
    this.render();
  }
  /** Immediately persist any unsaved changes (called on timeline switch / close). */
  async flushSave() {
    if (!this.timeline || !this.path || !this.dirty || this.saving)
      return;
    this.clearAutoSaveTimer();
    await this.save();
  }
  getContainer() {
    return this.container;
  }
  hasTimeline() {
    return this.timeline !== null;
  }
  // ---- Rendering -----------------------------------------------------------
  render() {
    this.container.empty();
    if (!this.timeline) {
      this.renderEmpty();
      return;
    }
    this.renderHeader();
    this.renderToolbar();
    this.renderBody();
  }
  renderEmpty() {
    const empty = this.container.createDiv({ cls: "tl-editor__empty" });
    empty.createEl("p", { cls: "tl-editor__empty-title", text: "\u672A\u6253\u5F00\u65F6\u95F4\u7EBF" });
    empty.createEl("p", {
      cls: "tl-editor__empty-copy",
      text: "\u4ECE\u5DE6\u4FA7\u9009\u62E9\u4E00\u4E2A\u65F6\u95F4\u7EBF\uFF0C\u6216\u65B0\u5EFA\u4E00\u4E2A\u65F6\u95F4\u7EBF\u5F00\u59CB\u53EF\u89C6\u5316\u5730\u7EC4\u7EC7\u4E8B\u4EF6\u3002"
    });
  }
  renderHeader() {
    var _a;
    const tl = this.timeline;
    const header = this.container.createDiv({ cls: "tl-editor__header" });
    const titleRow = header.createDiv({ cls: "tl-editor__title-row" });
    const titleInput = titleRow.createEl("input", {
      cls: "tl-editor__title-input",
      attr: { type: "text", placeholder: "\u65F6\u95F4\u7EBF\u6807\u9898", value: tl.title }
    });
    titleInput.oninput = () => {
      tl.title = titleInput.value;
      this.markDirty();
    };
    const actions = titleRow.createDiv({ cls: "tl-editor__header-actions" });
    new import_obsidian3.ButtonComponent(actions).setButtonText("\u6253\u5F00\u6587\u6863").setClass("tl-btn").setClass("tl-btn--ghost").onClick(() => this.path && this.repo.openFile(this.path, true));
    new import_obsidian3.ButtonComponent(actions).setButtonText(this.dirty ? "\u4FDD\u5B58" : "\u5DF2\u4FDD\u5B58").setClass("tl-btn").setClass("tl-btn--primary").setDisabled(!this.dirty).onClick(() => this.save());
    const descRow = header.createDiv({ cls: "tl-editor__desc-row" });
    const desc = descRow.createEl("textarea", {
      cls: "tl-editor__desc-input",
      attr: { placeholder: "\u7B80\u77ED\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09", rows: "2" }
    });
    desc.value = (_a = tl.description) != null ? _a : "";
    desc.oninput = () => {
      tl.description = desc.value.trim() ? desc.value : void 0;
      this.markDirty();
    };
  }
  renderToolbar() {
    const tl = this.timeline;
    const toolbar = this.container.createDiv({ cls: "tl-editor__toolbar" });
    const info = toolbar.createDiv({ cls: "tl-editor__toolbar-info" });
    info.createEl("span", {
      cls: "tl-editor__count",
      text: `${tl.events.length} \u4E2A\u4E8B\u4EF6`
    });
    info.createEl("span", {
      cls: "tl-editor__hint-inline",
      text: "\u62D6\u62FD \u283F \u91CD\u6392"
    });
    const actions = toolbar.createDiv({ cls: "tl-editor__toolbar-actions" });
    new import_obsidian3.ButtonComponent(actions).setButtonText(this.sortByDate ? "\u6309\u65E5\u671F\u6392\u5E8F\uFF1A\u5F00" : "\u6309\u65E5\u671F\u6392\u5E8F\uFF1A\u5173").setClass("tl-btn").setClass("tl-btn--ghost").setClass("tl-btn--sm").onClick(() => {
      this.sortByDate = !this.sortByDate;
      this.render();
    });
    new import_obsidian3.ButtonComponent(actions).setButtonText("\u6DFB\u52A0\u4E8B\u4EF6").setClass("tl-btn").setClass("tl-btn--primary").onClick(() => {
      var _a;
      this.formMode = { kind: "new" };
      this.render();
      (_a = this.container.querySelector(".tl-event-form__title")) == null ? void 0 : _a.focus();
    });
    const addBtn = actions.querySelector(".tl-btn--primary");
    if (addBtn) {
      const iconSpan = createEl("span", { cls: "tl-btn__icon" });
      setSvgIcon(iconSpan, "plus");
      addBtn.prepend(iconSpan);
    }
  }
  renderBody() {
    const body = this.container.createDiv({ cls: "tl-editor__body" });
    const previewWrap = body.createDiv({ cls: "tl-editor__preview" });
    const previewInner = previewWrap.createDiv({ cls: "tl-editor__preview-inner" });
    renderTimeline(
      previewInner,
      this.timeline,
      {
        draggable: !this.sortByDate,
        sortByDate: this.sortByDate,
        showHeader: false,
        onEventClick: (event) => this.openEventForm(event),
        onReorder: (fromId, toId) => this.reorderEvents(fromId, toId)
      }
    );
    if (this.formMode.kind !== "closed") {
      const formWrap = body.createDiv({ cls: "tl-editor__form", attr: { "data-event-form": "" } });
      this.renderEventForm(formWrap);
      requestAnimationFrame(() => {
        formWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } else {
      const hint = body.createDiv({ cls: "tl-editor__hint" });
      hint.createEl("p", { text: "\u70B9\u51FB\u4E8B\u4EF6\u5361\u7247\u8FDB\u884C\u7F16\u8F91\uFF0C\u62D6\u62FD \u283F \u624B\u67C4\u91CD\u65B0\u6392\u5E8F\uFF0C\u6216\u4F7F\u7528\u300C\u6DFB\u52A0\u4E8B\u4EF6\u300D\u65B0\u5EFA\u3002" });
    }
  }
  renderEventForm(host) {
    var _a;
    host.empty();
    const isNew = this.formMode.kind === "new";
    const seed = this.formMode.kind === "edit" ? { ...this.formMode.event } : {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      title: ""
    };
    const form = host.createDiv({ cls: "tl-event-form" });
    form.createEl("h4", {
      cls: "tl-event-form__heading",
      text: isNew ? "\u65B0\u5EFA\u4E8B\u4EF6" : "\u7F16\u8F91\u4E8B\u4EF6"
    });
    const dateField = this.field(form, "\u65F6\u95F4");
    const dateInput = dateField.createEl("input", {
      cls: "tl-input",
      attr: { type: "date", value: seed.date.slice(0, 10) }
    });
    const timeInput = dateField.createEl("input", {
      cls: "tl-input tl-event-form__time",
      attr: { type: "time", value: this.timePart(seed.date) }
    });
    const titleField = this.field(form, "\u4E8B\u4EF6");
    const titleInput = titleField.createEl("input", {
      cls: "tl-input tl-event-form__title",
      attr: { type: "text", placeholder: "\u53D1\u751F\u4E86\u4EC0\u4E48\uFF1F", value: seed.title }
    });
    const descField = this.field(form, "\u63CF\u8FF0");
    const descInput = descField.createEl("textarea", {
      cls: "tl-input tl-event-form__desc",
      attr: { rows: "3", placeholder: "\u7B80\u77ED\u63CF\u8FF0", value: (_a = seed.description) != null ? _a : "" }
    });
    const actions = form.createDiv({ cls: "tl-event-form__actions" });
    if (!isNew) {
      new import_obsidian3.ButtonComponent(actions).setButtonText("\u5220\u9664").setClass("tl-btn").setClass("tl-btn--danger").setWarning().onClick(() => this.deleteEvent(seed.id));
    }
    actions.createDiv({ cls: "tl-event-form__spacer" });
    new import_obsidian3.ButtonComponent(actions).setButtonText("\u53D6\u6D88").setClass("tl-btn").setClass("tl-btn--ghost").onClick(() => {
      this.formMode = { kind: "closed" };
      this.render();
    });
    new import_obsidian3.ButtonComponent(actions).setButtonText(isNew ? "\u6DFB\u52A0\u4E8B\u4EF6" : "\u66F4\u65B0\u4E8B\u4EF6").setClass("tl-btn").setClass("tl-btn--primary").onClick(() => {
      const event = {
        id: seed.id,
        date: this.composeDate(dateInput.value, timeInput.value),
        title: titleInput.value.trim() || "\u672A\u547D\u540D\u4E8B\u4EF6",
        description: descInput.value.trim() || void 0
      };
      this.commitEvent(event, isNew);
    });
  }
  field(host, label) {
    const wrap = host.createDiv({ cls: "tl-event-form__field" });
    wrap.createEl("label", { cls: "tl-event-form__label", text: label });
    return wrap;
  }
  // ---- State helpers -------------------------------------------------------
  openEventForm(event) {
    var _a;
    this.formMode = { kind: "edit", event };
    this.render();
    (_a = this.container.querySelector(".tl-event-form__title")) == null ? void 0 : _a.focus();
  }
  reorderEvents(fromId, toId) {
    const tl = this.timeline;
    const fromIdx = tl.events.findIndex((e) => e.id === fromId);
    const toIdx = tl.events.findIndex((e) => e.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx)
      return;
    const [moved] = tl.events.splice(fromIdx, 1);
    tl.events.splice(toIdx, 0, moved);
    this.formMode = { kind: "closed" };
    this.render();
    this.markDirty();
  }
  commitEvent(event, isNew) {
    const tl = this.timeline;
    if (isNew) {
      tl.events.push(event);
    } else {
      const idx = tl.events.findIndex((e) => e.id === event.id);
      if (idx >= 0)
        tl.events[idx] = event;
    }
    this.formMode = { kind: "closed" };
    this.render();
    this.markDirty();
  }
  deleteEvent(id) {
    const tl = this.timeline;
    tl.events = tl.events.filter((e) => e.id !== id);
    this.formMode = { kind: "closed" };
    this.render();
    this.markDirty();
  }
  markDirty() {
    var _a, _b;
    this.dirty = true;
    (_b = (_a = this.callbacks).onDirtyChange) == null ? void 0 : _b.call(_a, true);
    const saveBtn = this.container.querySelector(
      ".tl-editor__header-actions .tl-btn--primary"
    );
    if (saveBtn) {
      saveBtn.setText(this.settings.autoSave ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58");
      saveBtn.disabled = false;
    }
    this.scheduleAutoSave();
  }
  /** Debounced auto-save: fires `autoSaveDelay` ms after the last edit. */
  scheduleAutoSave() {
    if (!this.settings.autoSave)
      return;
    this.clearAutoSaveTimer();
    const delay = Math.max(300, this.settings.autoSaveDelay || 1200);
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      void this.save();
    }, delay);
  }
  clearAutoSaveTimer() {
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  timePart(date) {
    if (date.length > 10)
      return date.slice(11, 16);
    return "";
  }
  composeDate(date, time) {
    var _a, _b;
    if (!isValidEventDate(date)) {
      return (_b = (_a = this.timeline.events[0]) == null ? void 0 : _a.date) != null ? _b : new Date().toISOString().slice(0, 10);
    }
    return time ? `${date} ${time}` : date;
  }
  async save() {
    var _a, _b, _c, _d;
    if (!this.timeline || !this.path || this.saving)
      return;
    this.saving = true;
    this.timeline.updatedAt = new Date().toISOString();
    try {
      const savedPath = await this.repo.save(this.timeline, this.path);
      this.path = savedPath;
      this.dirty = false;
      this.clearAutoSaveTimer();
      (_b = (_a = this.callbacks).onDirtyChange) == null ? void 0 : _b.call(_a, false);
      (_d = (_c = this.callbacks).onSaved) == null ? void 0 : _d.call(_c, this.timeline, savedPath);
      const saveBtn = this.container.querySelector(
        ".tl-editor__header-actions .tl-btn--primary"
      );
      if (saveBtn) {
        saveBtn.setText("\u5DF2\u4FDD\u5B58");
        saveBtn.disabled = true;
      }
    } catch (err) {
      this.showError("\u65E0\u6CD5\u4FDD\u5B58\u65F6\u95F4\u7EBF", err);
    } finally {
      this.saving = false;
    }
  }
  showError(message, err) {
    const modal = new import_obsidian3.Modal(this.app);
    modal.titleEl.setText("\u65F6\u95F4\u7EBF\u7BA1\u7406\u5668");
    modal.contentEl.createEl("p", { text: message });
    modal.contentEl.createEl("pre", {
      text: err instanceof Error ? err.message : String(err)
    });
    new import_obsidian3.ButtonComponent(modal.contentEl).setButtonText("\u5173\u95ED").setClass("tl-btn").setClass("tl-btn--primary").onClick(() => modal.close());
    modal.open();
  }
};

// src/timelineView.ts
var TIMELINE_VIEW_TYPE = "timeline-manager";
var TimelineManagerView = class extends import_obsidian4.ItemView {
  constructor(leaf, repo, settings) {
    super(leaf);
    this.docs = [];
    this.selectedPath = null;
    this.searchQuery = "";
    this.dirty = false;
    this.refreshInFlight = false;
    this.repo = repo;
    this.settings = settings;
    this.editor = new TimelineEditor(this.app, createEl("div"), repo, settings, {
      onSaved: (timeline, path) => this.handleSaved(timeline, path),
      onDirtyChange: (dirty) => this.setDirty(dirty)
    });
  }
  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u65F6\u95F4\u7EBF\u7BA1\u7406\u5668";
  }
  getIcon() {
    return "calendar";
  }
  async onOpen() {
    this.renderShell();
    await this.refresh();
  }
  async onClose() {
    await this.editor.close();
  }
  // ---- Shell ---------------------------------------------------------------
  renderShell() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("timeline-view-host");
    const root = contentEl.createDiv({ cls: "timeline-view" });
    const sidebar = root.createDiv({ cls: "timeline-view__sidebar" });
    const head = sidebar.createDiv({ cls: "timeline-view__sidebar-head" });
    const titleWrap = head.createDiv({ cls: "timeline-view__sidebar-title-wrap" });
    const titleIcon = titleWrap.createEl("span", { cls: "timeline-view__sidebar-title-icon" });
    setSvgIcon(titleIcon, "calendar");
    head.createEl("span", { cls: "timeline-view__sidebar-title", text: "\u65F6\u95F4\u7EBF" });
    const headActions = head.createDiv({ cls: "timeline-view__sidebar-actions" });
    const refreshBtn = headActions.createEl("button", {
      cls: "tl-icon-btn",
      attr: { "aria-label": "\u5237\u65B0", title: "\u5237\u65B0" }
    });
    setSvgIcon(refreshBtn, "refresh-cw");
    refreshBtn.onclick = () => this.refresh();
    const newBtn = headActions.createEl("button", {
      cls: "tl-btn tl-btn--primary tl-btn--sm",
      attr: { "aria-label": "\u65B0\u5EFA\u65F6\u95F4\u7EBF", title: "\u65B0\u5EFA\u65F6\u95F4\u7EBF" }
    });
    setSvgIcon(newBtn, "plus");
    newBtn.createEl("span", { text: "\u65B0\u5EFA" });
    newBtn.onclick = () => this.openCreateModal();
    const searchWrap = sidebar.createDiv({ cls: "timeline-view__search" });
    const search = searchWrap.createEl("input", {
      cls: "tl-input timeline-view__search-input",
      attr: { type: "search", placeholder: "\u641C\u7D22\u65F6\u95F4\u7EBF" }
    });
    search.oninput = () => {
      this.searchQuery = search.value.trim().toLowerCase();
      this.renderSidebarList();
    };
    sidebar.createDiv({ cls: "timeline-view__list", attr: { "data-list": "" } });
    const main = root.createDiv({ cls: "timeline-view__main" });
    const toolbar = main.createDiv({ cls: "timeline-view__main-toolbar" });
    const pathIcon = toolbar.createEl("span", { cls: "timeline-view__path-icon" });
    setSvgIcon(pathIcon, "file-text");
    toolbar.createEl("span", {
      cls: "timeline-view__path",
      attr: { "data-path": "" },
      text: "\u9009\u62E9\u4E00\u4E2A\u65F6\u95F4\u7EBF"
    });
    const openFileBtn = toolbar.createEl("button", {
      cls: "tl-btn tl-btn--ghost tl-btn--sm timeline-view__open-file",
      attr: { "data-open-file": "", title: "\u6253\u5F00\u5BF9\u5E94\u6587\u6863" }
    });
    setSvgIcon(openFileBtn, "external-link");
    openFileBtn.createEl("span", { text: "\u6253\u5F00\u6587\u6863" });
    openFileBtn.onclick = () => this.selectedPath && this.repo.openFile(this.selectedPath, true);
    openFileBtn.style.display = "none";
    toolbar.createEl("span", {
      cls: "timeline-view__dirty",
      attr: { "data-dirty": "", "aria-hidden": "true" },
      text: "\u672A\u4FDD\u5B58"
    });
    const editorHost = main.createDiv({ cls: "timeline-view__editor-host" });
    editorHost.appendChild(this.editor.getContainer());
    this.editor.close();
    this.renderSidebarList();
  }
  get openFileButton() {
    return this.contentEl.querySelector('[data-open-file=""]');
  }
  get sidebarList() {
    return this.contentEl.querySelector('[data-list=""]');
  }
  get pathLabel() {
    return this.contentEl.querySelector('[data-path=""]');
  }
  get dirtyBadge() {
    return this.contentEl.querySelector('[data-dirty=""]');
  }
  // ---- Sidebar -------------------------------------------------------------
  renderSidebarList() {
    const list = this.sidebarList;
    list.empty();
    const filtered = this.filteredDocs();
    if (filtered.length === 0) {
      list.createDiv({
        cls: "timeline-view__list-empty",
        text: this.docs.length === 0 ? "\u8FD8\u6CA1\u6709\u65F6\u95F4\u7EBF" : "\u6CA1\u6709\u5339\u914D\u9879"
      });
      return;
    }
    filtered.forEach((doc) => {
      const item = list.createDiv({
        cls: "tl-list-item" + (doc.path === this.selectedPath ? " is-selected" : ""),
        attr: { role: "button", tabindex: "0", "data-path": doc.path }
      });
      const dot = item.createDiv({ cls: "tl-list-item__dot" });
      dot.style.setProperty("--event-color", this.categoryColor(doc.timeline));
      const text = item.createDiv({ cls: "tl-list-item__text" });
      text.createEl("span", { cls: "tl-list-item__title", text: doc.timeline.title || doc.name });
      const meta = text.createEl("span", { cls: "tl-list-item__meta" });
      if (this.settings.showEventCounts) {
        meta.append(`${doc.eventCount} \u4E2A\u4E8B\u4EF6`);
      }
      const del = item.createEl("button", {
        cls: "tl-list-item__delete",
        attr: { "aria-label": "\u5220\u9664\u65F6\u95F4\u7EBF", title: "\u5220\u9664" }
      });
      setSvgIcon(del, "trash");
      del.onclick = (ev) => {
        ev.stopPropagation();
        this.confirmDelete(doc);
      };
      const activate = () => this.selectTimeline(doc.path);
      item.onclick = activate;
      item.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          activate();
        }
      };
    });
  }
  filteredDocs() {
    if (!this.searchQuery)
      return this.docs;
    return this.docs.filter((d) => {
      var _a;
      const hay = `${d.timeline.title} ${d.name} ${(_a = d.timeline.description) != null ? _a : ""}`.toLowerCase();
      return hay.includes(this.searchQuery);
    });
  }
  categoryColor(timeline) {
    if (!timeline.events.length)
      return "#4285f4";
    return colorForIndex(0, false);
  }
  // ---- Selection & main ----------------------------------------------------
  async selectTimeline(path) {
    this.selectedPath = path;
    this.renderSidebarList();
    const timeline = await this.repo.load(path);
    const doc = this.docs.find((d) => d.path === path);
    this.pathLabel.textContent = (doc == null ? void 0 : doc.timeline.title) || path || "\u9009\u62E9\u4E00\u4E2A\u65F6\u95F4\u7EBF";
    this.openFileButton.style.display = this.selectedPath ? "" : "none";
    if (timeline) {
      await this.editor.load(timeline, path);
    } else {
      this.renderEmptyMain();
    }
  }
  renderEmptyMain() {
    void this.editor.close();
    this.pathLabel.textContent = "\u9009\u62E9\u4E00\u4E2A\u65F6\u95F4\u7EBF";
    this.openFileButton.style.display = "none";
  }
  // ---- Refresh -------------------------------------------------------------
  async refresh() {
    if (this.refreshInFlight)
      return;
    this.refreshInFlight = true;
    try {
      this.docs = await this.repo.findAll();
      this.renderSidebarList();
      if (this.selectedPath && !this.docs.some((d) => d.path === this.selectedPath)) {
        this.selectedPath = null;
        this.renderEmptyMain();
      }
    } finally {
      this.refreshInFlight = false;
    }
  }
  // ---- Create / Delete -----------------------------------------------------
  /** Public entry point used by the "Create new timeline" command. */
  openCreateModal() {
    this.startCreateModal();
  }
  startCreateModal() {
    const modal = new import_obsidian4.Modal(this.app);
    modal.titleEl.setText("\u65B0\u5EFA\u65F6\u95F4\u7EBF");
    const body = modal.contentEl.createDiv({ cls: "tl-modal" });
    body.createEl("label", { cls: "tl-event-form__label", text: "\u6807\u9898" });
    const title = body.createEl("input", {
      cls: "tl-input",
      attr: { type: "text", placeholder: "\u6211\u7684\u65F6\u95F4\u7EBF" }
    });
    title.focus();
    body.createEl("label", { cls: "tl-event-form__label", text: "\u6587\u4EF6\u5939" });
    const folder = body.createEl("input", {
      cls: "tl-input",
      attr: { type: "text", value: this.settings.defaultFolder, placeholder: "Timelines" }
    });
    body.createEl("label", { cls: "tl-event-form__label", text: "\u63CF\u8FF0" });
    const desc = body.createEl("textarea", {
      cls: "tl-input",
      attr: { rows: "2", placeholder: "\u53EF\u9009" }
    });
    const actions = body.createDiv({ cls: "tl-modal__actions" });
    let created = false;
    new import_obsidian4.ButtonComponent(actions).setButtonText("\u53D6\u6D88").setClass("tl-btn").setClass("tl-btn--ghost").onClick(() => modal.close());
    new import_obsidian4.ButtonComponent(actions).setButtonText("\u521B\u5EFA\u65F6\u95F4\u7EBF").setClass("tl-btn").setClass("tl-btn--primary").setIcon("plus").onClick(async () => {
      if (created)
        return;
      created = true;
      await this.createTimeline(title.value.trim(), folder.value.trim(), desc.value.trim());
      modal.close();
    });
    title.onkeydown = (ev) => {
      var _a;
      if (ev.key === "Enter") {
        ev.preventDefault();
        (_a = actions.querySelector(".tl-btn--primary")) == null ? void 0 : _a.click();
      }
    };
    modal.open();
  }
  async createTimeline(title, folder, description) {
    const safeTitle = title || "\u672A\u547D\u540D\u65F6\u95F4\u7EBF";
    const now = new Date().toISOString();
    const timeline = {
      version: 1,
      id: generateId(),
      title: safeTitle,
      description: description || void 0,
      events: [],
      createdAt: now,
      updatedAt: now
    };
    const base = this.repo.buildPath(folder || this.settings.defaultFolder, safeTitle);
    const path = await this.repo.uniquePath(base);
    try {
      await this.repo.save(timeline, path);
      await this.refresh();
      await this.selectTimeline(path);
      if (this.settings.openAfterCreate) {
        await this.repo.openFile(path, true);
      }
      new import_obsidian4.Notice(`\u5DF2\u521B\u5EFA\u300C${safeTitle}\u300D`);
    } catch (err) {
      new import_obsidian4.Notice("\u65E0\u6CD5\u521B\u5EFA\u65F6\u95F4\u7EBF");
      console.error(err);
    }
  }
  confirmDelete(doc) {
    const modal = new import_obsidian4.Modal(this.app);
    modal.titleEl.setText("\u5220\u9664\u65F6\u95F4\u7EBF");
    modal.contentEl.createEl("p", {
      text: `\u5220\u9664\u300C${doc.timeline.title || doc.name}\u300D\uFF1F\u8FD9\u5C06\u628A\u8BE5 markdown \u6587\u4EF6\u79FB\u81F3\u56DE\u6536\u7AD9\u3002`
    });
    const actions = modal.contentEl.createDiv({ cls: "tl-modal__actions" });
    new import_obsidian4.ButtonComponent(actions).setButtonText("\u53D6\u6D88").setClass("tl-btn").setClass("tl-btn--ghost").onClick(() => modal.close());
    new import_obsidian4.ButtonComponent(actions).setButtonText("\u5220\u9664").setClass("tl-btn").setClass("tl-btn--danger").setWarning().onClick(async () => {
      await this.repo.delete(doc.path);
      if (this.selectedPath === doc.path) {
        this.selectedPath = null;
        this.renderEmptyMain();
      }
      await this.refresh();
      modal.close();
      new import_obsidian4.Notice("\u5DF2\u5220\u9664\u65F6\u95F4\u7EBF");
    });
    modal.open();
  }
  // ---- Editor callbacks ----------------------------------------------------
  async handleSaved(timeline, path) {
    this.selectedPath = path;
    await this.refresh();
    this.pathLabel.textContent = timeline.title || path;
    this.renderSidebarList();
  }
  setDirty(dirty) {
    this.dirty = dirty;
    this.dirtyBadge.style.display = dirty ? "" : "none";
  }
};

// src/timelinePostProcessor.ts
function registerTimelinePostProcessor(plugin) {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    enhanceTimelineTable(el, ctx).catch(() => {
    });
  });
}
async function enhanceTimelineTable(el, ctx) {
  var _a, _b, _c, _d, _e;
  const frontmatter = ctx.frontmatter;
  const sourcePath = ctx.sourcePath;
  if (!frontmatter || !frontmatter.timelineId)
    return;
  const table = el.querySelector("table");
  if (!table)
    return;
  const headerCells = Array.from(table.querySelectorAll("thead th, thead td, tr:first-child th")).map((c) => (c.textContent || "").trim().toLowerCase());
  if (!headerCells.some((h) => h.includes("\u65F6\u95F4")) || !headerCells.some((h) => h.includes("\u4E8B\u4EF6"))) {
    return;
  }
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  if (rows.length === 0)
    return;
  const events = rows.map((row) => parseRenderedRow(row)).filter((e) => e !== null);
  if (events.length === 0)
    return;
  const title = String((_c = (_b = frontmatter.title) != null ? _b : (_a = sourcePath == null ? void 0 : sourcePath.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/, "")) != null ? _c : "\u65F6\u95F4\u7EBF");
  const now = new Date().toISOString();
  const timeline = {
    version: 1,
    id: String(frontmatter.timelineId),
    title,
    description: void 0,
    events,
    createdAt: String((_d = frontmatter.createdAt) != null ? _d : now),
    updatedAt: String((_e = frontmatter.updatedAt) != null ? _e : now)
  };
  const host = document.createElement("div");
  host.addClass("timeline-render-host");
  renderTimeline(host, timeline, { showHeader: false, isDark: el.closest(".theme-dark, .dark") !== null });
  table.replaceWith(host);
}
function parseRenderedRow(row) {
  var _a, _b, _c, _d, _e, _f;
  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 2)
    return null;
  const date = ((_b = (_a = cells[0]) == null ? void 0 : _a.textContent) != null ? _b : "").trim();
  const title = ((_d = (_c = cells[1]) == null ? void 0 : _c.textContent) != null ? _d : "").trim();
  const description = ((_f = (_e = cells[2]) == null ? void 0 : _e.textContent) != null ? _f : "").trim();
  if (!date && !title && !description)
    return null;
  return {
    id: generateId(),
    date: date || new Date().toISOString().slice(0, 10),
    title: title || "\u672A\u547D\u540D\u4E8B\u4EF6",
    description: description || void 0
  };
}

// main.ts
var TimelineManagerPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.repo = new TimelineRepository(this.app);
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new TimelineManagerView(leaf, this.repo, this.settings)
    );
    registerTimelinePostProcessor(this);
    const ribbonEl = this.addRibbonIcon("calendar", "\u6253\u5F00\u65F6\u95F4\u7EBF\u7BA1\u7406\u5668", async () => {
      await this.activateView();
    });
    setSvgIcon(ribbonEl, "calendar");
    this.addCommand({
      id: "open-timeline-manager",
      name: "\u6253\u5F00\u65F6\u95F4\u7EBF\u7BA1\u7406\u5668",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "create-new-timeline",
      name: "\u65B0\u5EFA\u65F6\u95F4\u7EBF",
      callback: async () => {
        const view = await this.activateView();
        view.openCreateModal();
      }
    });
    this.addCommand({
      id: "insert-timeline-table",
      name: "\u5728\u5F53\u524D\u7B14\u8BB0\u4E2D\u63D2\u5165\u65F6\u95F4\u7EBF\u8868\u683C",
      editorCallback: (editor) => {
        const now = new Date().toISOString();
        const timeline = {
          version: 1,
          id: generateId(),
          title: "\u672A\u547D\u540D\u65F6\u95F4\u7EBF",
          description: "",
          events: [
            { id: generateId(), date: now.slice(0, 10), title: "\u793A\u4F8B\u4E8B\u4EF6", description: "\u5728\u6B64\u7F16\u8F91" }
          ],
          createdAt: now,
          updatedAt: now
        };
        const table = buildTimelineTable(timeline);
        editor.replaceSelection("\n" + table + "\n");
        new import_obsidian5.Notice("\u5DF2\u63D2\u5165\u65F6\u95F4\u7EBF\u8868\u683C");
      }
    });
    this.addSettingTab(
      new TimelineSettingTab(this.app, this, async () => {
        const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof TimelineManagerView) {
            await leaf.view.refresh();
          }
        }
      })
    );
  }
  onunload() {
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const existing = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    }
    if (leaf)
      workspace.revealLeaf(leaf);
    return leaf == null ? void 0 : leaf.view;
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
