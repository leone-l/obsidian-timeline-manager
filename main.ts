// Timeline Manager — an Obsidian plugin to visually create and manage
// timelines. Each timeline is a markdown document: frontmatter holds metadata
// and a 时间/事件/描述 table holds the events. The management view supports
// drag-and-drop organization; reading view renders the table as a visual
// timeline via a post-processor.

import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import {
  TimelineSettings,
  DEFAULT_SETTINGS,
  TimelineSettingTab,
} from "./src/settings";
import { TimelineRepository } from "./src/timelineRepository";
import {
  TIMELINE_VIEW_TYPE,
  TimelineManagerView,
} from "./src/timelineView";
import { registerTimelinePostProcessor } from "./src/timelinePostProcessor";
import { buildTimelineTable } from "./src/timelineParser";
import { generateId } from "./src/types";
import { setSvgIcon } from "./src/icons";

export default class TimelineManagerPlugin extends Plugin {
  settings: TimelineSettings = DEFAULT_SETTINGS;
  private repo!: TimelineRepository;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.repo = new TimelineRepository(this.app);

    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new TimelineManagerView(leaf, this.repo, this.settings)
    );

    registerTimelinePostProcessor(this);

    // Use addRibbonIcon (standard API) but override the icon with our own
    // inline SVG, in case the internal icon registry doesn't have the name.
    const ribbonEl = this.addRibbonIcon("calendar", "打开时间线管理器", async () => {
      await this.activateView();
    });
    setSvgIcon(ribbonEl, "calendar");

    this.addCommand({
      id: "open-timeline-manager",
      name: "打开时间线管理器",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "create-new-timeline",
      name: "新建时间线",
      callback: async () => {
        const view = await this.activateView();
        view.openCreateModal();
      },
    });

    this.addCommand({
      id: "insert-timeline-table",
      name: "在当前笔记中插入时间线表格",
      editorCallback: (editor) => {
        const now = new Date().toISOString();
        const timeline = {
          version: 1,
          id: generateId(),
          title: "未命名时间线",
          description: "",
          events: [
            { id: generateId(), date: now.slice(0, 10), title: "示例事件", description: "在此编辑" },
          ],
          createdAt: now,
          updatedAt: now,
        };
        const table = buildTimelineTable(timeline);
        editor.replaceSelection("\n" + table + "\n");
        new Notice("已插入时间线表格");
      },
    });

    this.addSettingTab(
      new TimelineSettingTab(this.app, this, async () => {
        // When a display setting changes, refresh any open view.
        const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof TimelineManagerView) {
            await leaf.view.refresh();
          }
        }
      })
    );
  }

  onunload(): void {
    // Obsidian tears down views; nothing else to clean up here.
  }

  async activateView(): Promise<TimelineManagerView> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
    return leaf?.view as TimelineManagerView;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
