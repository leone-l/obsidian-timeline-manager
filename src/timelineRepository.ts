// Vault access layer for timeline documents. Handles scanning the vault for
// timeline code blocks, loading them, and persisting edits back to disk while
// preserving any surrounding markdown the user added to the file.

import { App, TFile, TFolder, normalizePath } from "obsidian";
import { Timeline } from "./types";
import {
  extractTimeline,
  buildTimelineMarkdown,
  replaceTimelineTable,
} from "./timelineParser";

export interface TimelineDoc {
  path: string;
  name: string;
  timeline: Timeline;
  /** Number of events, for cheap display without re-sorting. */
  eventCount: number;
  updatedAt: string;
}

export class TimelineRepository {
  constructor(private app: App) {}

  /** Scan the vault for files containing a timeline code block. */
  async findAll(): Promise<TimelineDoc[]> {
    const files = this.app.vault.getMarkdownFiles();
    const out: TimelineDoc[] = [];
    for (const file of files) {
      const doc = await this.toTimelineDoc(file);
      if (doc) out.push(doc);
    }
    out.sort((a, b) => {
      const au = a.updatedAt || "";
      const bu = b.updatedAt || "";
      return bu.localeCompare(au);
    });
    return out;
  }

  /** Load a single timeline by file path. */
  async load(path: string): Promise<Timeline | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    const doc = await this.toTimelineDoc(file);
    return doc ? doc.timeline : null;
  }

  /** Persist a (possibly new) timeline to disk and return its path. */
  async save(timeline: Timeline, targetPath: string): Promise<string> {
    const normalized = normalizePath(targetPath);
    const existing = this.app.vault.getAbstractFileByPath(normalized);

    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      const next = replaceTimelineTable(content, timeline);
      await this.app.vault.modify(existing, next);
      return existing.path;
    }

    // New file: ensure parent folder exists, then create with full document.
    await this.ensureFolder(normalized);
    const body = buildTimelineMarkdown(timeline);
    const created = await this.app.vault.create(normalized, body);
    return created.path;
  }

  /** Delete a timeline document from the vault. */
  async delete(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      await this.app.vault.trash(file, true);
    }
  }

  /** Open the underlying markdown file in a new leaf. */
  async openFile(path: string, newLeaf = false): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(newLeaf).openFile(file);
    }
  }

  /** Build a vault-relative file path for a new timeline. */
  buildPath(folder: string, title: string): string {
    const safe = (title || "untimeline")
      .trim()
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "untimeline";
    const folderPart = folder ? folder.replace(/\/+$/, "") : "";
    const name = `${safe}.md`;
    return normalizePath(folderPart ? `${folderPart}/${name}` : name);
  }

  /** Avoid clobbering an existing file when creating a new timeline. */
  async uniquePath(base: string): Promise<string> {
    let candidate = base;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(candidate) instanceof TFile) {
      const dot = base.lastIndexOf(".");
      candidate =
        dot > 0
          ? `${base.slice(0, dot)} ${counter}${base.slice(dot)}`
          : `${base} ${counter}`;
      counter++;
    }
    return candidate;
  }

  private async toTimelineDoc(file: TFile): Promise<TimelineDoc | null> {
    if (file.extension !== "md") return null;
    const content = await this.app.vault.cachedRead(file);
    const { timeline } = extractTimeline(content);
    if (!timeline) return null;
    return {
      path: file.path,
      name: file.basename,
      timeline,
      eventCount: timeline.events.length,
      updatedAt: timeline.updatedAt || file.stat.mtime?.toString() || "",
    };
  }

  private async ensureFolder(filePath: string): Promise<void> {
    const slash = filePath.lastIndexOf("/");
    if (slash <= 0) return;
    const folderPath = filePath.slice(0, slash);
    if (this.app.vault.getAbstractFileByPath(folderPath) instanceof TFolder) return;
    try {
      await this.app.vault.createFolder(folderPath);
    } catch {
      // Folder may already exist due to a race; ignore.
    }
  }
}
