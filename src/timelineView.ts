// The Timeline Manager workspace view: a sidebar of timeline documents plus
// a main surface that hosts the visual editor. Opened via the ribbon icon or
// the "Open timeline manager" command.

import { ButtonComponent, ItemView, Modal, Notice, WorkspaceLeaf } from "obsidian";
import { Timeline, generateId, colorForIndex } from "./types";
import { TimelineRepository, TimelineDoc } from "./timelineRepository";
import { TimelineEditor } from "./timelineEditor";
import { TimelineSettings } from "./settings";
import { setSvgIcon } from "./icons";

export const TIMELINE_VIEW_TYPE = "timeline-manager";

export class TimelineManagerView extends ItemView {
  private repo: TimelineRepository;
  private editor: TimelineEditor;
  private settings: TimelineSettings;
  private docs: TimelineDoc[] = [];
  private selectedPath: string | null = null;
  private searchQuery = "";
  private dirty = false;
  private refreshInFlight = false;

  constructor(
    leaf: WorkspaceLeaf,
    repo: TimelineRepository,
    settings: TimelineSettings
  ) {
    super(leaf);
    this.repo = repo;
    this.settings = settings;
    this.editor = new TimelineEditor(this.app, createEl("div"), repo, settings, {
      onSaved: (timeline, path) => this.handleSaved(timeline, path),
      onDirtyChange: (dirty) => this.setDirty(dirty),
    });
  }

  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "时间线管理器";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen(): Promise<void> {
    this.renderShell();
    await this.refresh();
  }

  async onClose(): Promise<void> {
    await this.editor.close();
  }

  // ---- Shell ---------------------------------------------------------------

  private renderShell(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("timeline-view-host");

    const root = contentEl.createDiv({ cls: "timeline-view" });

    // Sidebar
    const sidebar = root.createDiv({ cls: "timeline-view__sidebar" });
    const head = sidebar.createDiv({ cls: "timeline-view__sidebar-head" });
    const titleWrap = head.createDiv({ cls: "timeline-view__sidebar-title-wrap" });
    const titleIcon = titleWrap.createEl("span", { cls: "timeline-view__sidebar-title-icon" });
    setSvgIcon(titleIcon, "calendar");
    head.createEl("span", { cls: "timeline-view__sidebar-title", text: "时间线" });
    const headActions = head.createDiv({ cls: "timeline-view__sidebar-actions" });
    const refreshBtn = headActions.createEl("button", {
      cls: "tl-icon-btn",
      attr: { "aria-label": "刷新", title: "刷新" },
    });
    setSvgIcon(refreshBtn, "refresh-cw");
    refreshBtn.onclick = () => this.refresh();

    const newBtn = headActions.createEl("button", {
      cls: "tl-btn tl-btn--primary tl-btn--sm",
      attr: { "aria-label": "新建时间线", title: "新建时间线" },
    });
    setSvgIcon(newBtn, "plus");
    newBtn.createEl("span", { text: "新建" });
    newBtn.onclick = () => this.openCreateModal();

    const searchWrap = sidebar.createDiv({ cls: "timeline-view__search" });
    const search = searchWrap.createEl("input", {
      cls: "tl-input timeline-view__search-input",
      attr: { type: "search", placeholder: "搜索时间线" },
    });
    search.oninput = () => {
      this.searchQuery = search.value.trim().toLowerCase();
      this.renderSidebarList();
    };

    sidebar.createDiv({ cls: "timeline-view__list", attr: { "data-list": "" } });

    // Main
    const main = root.createDiv({ cls: "timeline-view__main" });
    const toolbar = main.createDiv({ cls: "timeline-view__main-toolbar" });
    const pathIcon = toolbar.createEl("span", { cls: "timeline-view__path-icon" });
    setSvgIcon(pathIcon, "file-text");
    toolbar.createEl("span", {
      cls: "timeline-view__path",
      attr: { "data-path": "" },
      text: "选择一个时间线",
    });
    const openFileBtn = toolbar.createEl("button", {
      cls: "tl-btn tl-btn--ghost tl-btn--sm timeline-view__open-file",
      attr: { "data-open-file": "", title: "打开对应文档" },
    });
    setSvgIcon(openFileBtn, "external-link");
    openFileBtn.createEl("span", { text: "打开文档" });
    openFileBtn.onclick = () => this.selectedPath && this.repo.openFile(this.selectedPath, true);
    openFileBtn.style.display = "none";
    toolbar.createEl("span", {
      cls: "timeline-view__dirty",
      attr: { "data-dirty": "", "aria-hidden": "true" },
      text: "未保存",
    });

    const editorHost = main.createDiv({ cls: "timeline-view__editor-host" });
    editorHost.appendChild(this.editor.getContainer());
    this.editor.close();

    this.renderSidebarList();
  }

  private get openFileButton(): HTMLElement {
    return this.contentEl.querySelector<HTMLElement>('[data-open-file=""]')!;
  }

  private get sidebarList(): HTMLElement {
    return this.contentEl.querySelector<HTMLElement>('[data-list=""]')!;
  }
  private get pathLabel(): HTMLElement {
    return this.contentEl.querySelector<HTMLElement>('[data-path=""]')!;
  }
  private get dirtyBadge(): HTMLElement {
    return this.contentEl.querySelector<HTMLElement>('[data-dirty=""]')!;
  }

  // ---- Sidebar -------------------------------------------------------------

  private renderSidebarList(): void {
    const list = this.sidebarList;
    list.empty();
    const filtered = this.filteredDocs();
    if (filtered.length === 0) {
      list.createDiv({
        cls: "timeline-view__list-empty",
        text: this.docs.length === 0 ? "还没有时间线" : "没有匹配项",
      });
      return;
    }
    filtered.forEach((doc) => {
      const item = list.createDiv({
        cls: "tl-list-item" + (doc.path === this.selectedPath ? " is-selected" : ""),
        attr: { role: "button", tabindex: "0", "data-path": doc.path },
      });
      const dot = item.createDiv({ cls: "tl-list-item__dot" });
      dot.style.setProperty("--event-color", this.categoryColor(doc.timeline));
      const text = item.createDiv({ cls: "tl-list-item__text" });
      text.createEl("span", { cls: "tl-list-item__title", text: doc.timeline.title || doc.name });
      const meta = text.createEl("span", { cls: "tl-list-item__meta" });
      if (this.settings.showEventCounts) {
        meta.append(`${doc.eventCount} 个事件`);
      }
      const del = item.createEl("button", {
        cls: "tl-list-item__delete",
        attr: { "aria-label": "删除时间线", title: "删除" },
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

  private filteredDocs(): TimelineDoc[] {
    if (!this.searchQuery) return this.docs;
    return this.docs.filter((d) => {
      const hay = `${d.timeline.title} ${d.name} ${d.timeline.description ?? ""}`.toLowerCase();
      return hay.includes(this.searchQuery);
    });
  }

  private categoryColor(timeline: Timeline): string {
    if (!timeline.events.length) return "#4285f4";
    // Use the first event's derived color so the sidebar dot matches the render.
    return colorForIndex(0, false);
  }

  // ---- Selection & main ----------------------------------------------------

  private async selectTimeline(path: string): Promise<void> {
    this.selectedPath = path;
    this.renderSidebarList();
    const timeline = await this.repo.load(path);
    const doc = this.docs.find((d) => d.path === path);
    this.pathLabel.textContent = doc?.timeline.title || path || "选择一个时间线";
    this.openFileButton.style.display = this.selectedPath ? "" : "none";
    if (timeline) {
      await this.editor.load(timeline, path);
    } else {
      this.renderEmptyMain();
    }
  }

  private renderEmptyMain(): void {
    void this.editor.close();
    this.pathLabel.textContent = "选择一个时间线";
    this.openFileButton.style.display = "none";
  }

  // ---- Refresh -------------------------------------------------------------

  async refresh(): Promise<void> {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      this.docs = await this.repo.findAll();
      this.renderSidebarList();
      // If the currently selected timeline vanished, clear the editor.
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
  openCreateModal(): void {
    this.startCreateModal();
  }

  private startCreateModal(): void {
    const modal = new Modal(this.app);
    modal.titleEl.setText("新建时间线");
    const body = modal.contentEl.createDiv({ cls: "tl-modal" });
    body.createEl("label", { cls: "tl-event-form__label", text: "标题" });
    const title = body.createEl("input", {
      cls: "tl-input",
      attr: { type: "text", placeholder: "我的时间线" },
    });
    title.focus();
    body.createEl("label", { cls: "tl-event-form__label", text: "文件夹" });
    const folder = body.createEl("input", {
      cls: "tl-input",
      attr: { type: "text", value: this.settings.defaultFolder, placeholder: "Timelines" },
    });
    body.createEl("label", { cls: "tl-event-form__label", text: "描述" });
    const desc = body.createEl("textarea", {
      cls: "tl-input",
      attr: { rows: "2", placeholder: "可选" },
    });

    const actions = body.createDiv({ cls: "tl-modal__actions" });
    let created = false;
    new ButtonComponent(actions)
      .setButtonText("取消")
      .setClass("tl-btn")
      .setClass("tl-btn--ghost")
      .onClick(() => modal.close());
    new ButtonComponent(actions)
      .setButtonText("创建时间线")
      .setClass("tl-btn")
      .setClass("tl-btn--primary")
      .setIcon("plus")
      .onClick(async () => {
        if (created) return;
        created = true;
        await this.createTimeline(title.value.trim(), folder.value.trim(), desc.value.trim());
        modal.close();
      });
    title.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        actions.querySelector<HTMLButtonElement>(".tl-btn--primary")?.click();
      }
    };
    modal.open();
  }

  private async createTimeline(title: string, folder: string, description: string): Promise<void> {
    const safeTitle = title || "未命名时间线";
    const now = new Date().toISOString();
    const timeline: Timeline = {
      version: 1,
      id: generateId(),
      title: safeTitle,
      description: description || undefined,
      events: [],
      createdAt: now,
      updatedAt: now,
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
      new Notice(`已创建「${safeTitle}」`);
    } catch (err) {
      new Notice("无法创建时间线");
      console.error(err);
    }
  }

  private confirmDelete(doc: TimelineDoc): void {
    const modal = new Modal(this.app);
    modal.titleEl.setText("删除时间线");
    modal.contentEl.createEl("p", {
      text: `删除「${doc.timeline.title || doc.name}」？这将把该 markdown 文件移至回收站。`,
    });
    const actions = modal.contentEl.createDiv({ cls: "tl-modal__actions" });
    new ButtonComponent(actions)
      .setButtonText("取消")
      .setClass("tl-btn")
      .setClass("tl-btn--ghost")
      .onClick(() => modal.close());
    new ButtonComponent(actions)
      .setButtonText("删除")
      .setClass("tl-btn")
      .setClass("tl-btn--danger")
      .setWarning()
      .onClick(async () => {
        await this.repo.delete(doc.path);
        if (this.selectedPath === doc.path) {
          this.selectedPath = null;
          this.renderEmptyMain();
        }
        await this.refresh();
        modal.close();
        new Notice("已删除时间线");
      });
    modal.open();
  }

  // ---- Editor callbacks ----------------------------------------------------

  private async handleSaved(timeline: Timeline, path: string): Promise<void> {
    this.selectedPath = path;
    await this.refresh();
    // Keep the editor mounted; do not reload the working copy to avoid wiping
    // the in-progress edit state. Refresh updates the sidebar metadata.
    this.pathLabel.textContent = timeline.title || path;
    this.renderSidebarList();
  }

  private setDirty(dirty: boolean): void {
    this.dirty = dirty;
    this.dirtyBadge.style.display = dirty ? "" : "none";
  }
}
