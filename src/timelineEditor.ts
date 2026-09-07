// Visual timeline editor. Renders an editable form for a timeline and its
// events plus a live, drag-and-drop preview. Events are organized by dragging;
// the working copy is persisted to the markdown table via the repository.

import { ButtonComponent, Modal, App } from "obsidian";
import { setSvgIcon } from "./icons";
import {
  Timeline,
  TimelineEvent,
  generateId,
  isValidEventDate,
  sortEventsAscending,
} from "./types";
import { TimelineRepository } from "./timelineRepository";
import { renderTimeline } from "./timelineRender";
import { TimelineSettings } from "./settings";

export interface EditorCallbacks {
  onSaved?: (timeline: Timeline, path: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

type FormMode = { kind: "closed" } | { kind: "new" } | { kind: "edit"; event: TimelineEvent };

export class TimelineEditor {
  private timeline: Timeline | null = null;
  private path: string | null = null;
  private dirty = false;
  private formMode: FormMode = { kind: "closed" };
  private sortByDate = false;
  /** Pending auto-save timer id (from setTimeout). Null when none scheduled. */
  private autoSaveTimer: number | null = null;
  /** True while an auto-save is in flight, to avoid concurrent writes. */
  private saving = false;

  constructor(
    private app: App,
    private container: HTMLElement,
    private repo: TimelineRepository,
    private settings: TimelineSettings,
    private callbacks: EditorCallbacks = {}
  ) {
    this.container.empty();
    this.container.addClass("tl-editor");
  }

  async load(timeline: Timeline, path: string): Promise<void> {
    // Flush any pending auto-save of the previous timeline before swapping, so
    // that the old save's side effects (dirty reset, onSaved callback) do not
    // land on the new timeline.
    await this.flushSave();
    this.timeline = JSON.parse(JSON.stringify(timeline)) as Timeline;
    this.path = path;
    this.dirty = false;
    this.formMode = { kind: "closed" };
    this.sortByDate = false;
    this.clearAutoSaveTimer();
    this.callbacks.onDirtyChange?.(false);
    this.render();
  }

  async close(): Promise<void> {
    // Best-effort flush before tearing down.
    try {
      await this.flushSave();
    } catch {
      // Swallow: the editor is leaving the DOM anyway.
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
  async flushSave(): Promise<void> {
    if (!this.timeline || !this.path || !this.dirty || this.saving) return;
    this.clearAutoSaveTimer();
    await this.save();
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  hasTimeline(): boolean {
    return this.timeline !== null;
  }

  // ---- Rendering -----------------------------------------------------------

  private render(): void {
    this.container.empty();
    if (!this.timeline) {
      this.renderEmpty();
      return;
    }
    this.renderHeader();
    this.renderToolbar();
    this.renderBody();
  }

  private renderEmpty(): void {
    const empty = this.container.createDiv({ cls: "tl-editor__empty" });
    empty.createEl("p", { cls: "tl-editor__empty-title", text: "未打开时间线" });
    empty.createEl("p", {
      cls: "tl-editor__empty-copy",
      text: "从左侧选择一个时间线，或新建一个时间线开始可视化地组织事件。",
    });
  }

  private renderHeader(): void {
    const tl = this.timeline!;
    const header = this.container.createDiv({ cls: "tl-editor__header" });

    const titleRow = header.createDiv({ cls: "tl-editor__title-row" });
    const titleInput = titleRow.createEl("input", {
      cls: "tl-editor__title-input",
      attr: { type: "text", placeholder: "时间线标题", value: tl.title },
    });
    titleInput.oninput = () => {
      tl.title = titleInput.value;
      this.markDirty();
    };

    const actions = titleRow.createDiv({ cls: "tl-editor__header-actions" });
    new ButtonComponent(actions)
      .setButtonText("打开文档")
      .setClass("tl-btn")
      .setClass("tl-btn--ghost")
      .onClick(() => this.path && this.repo.openFile(this.path, true));
    new ButtonComponent(actions)
      .setButtonText(this.dirty ? "保存" : "已保存")
      .setClass("tl-btn")
      .setClass("tl-btn--primary")
      .setDisabled(!this.dirty)
      .onClick(() => this.save());

    const descRow = header.createDiv({ cls: "tl-editor__desc-row" });
    const desc = descRow.createEl("textarea", {
      cls: "tl-editor__desc-input",
      attr: { placeholder: "简短描述（可选）", rows: "2" },
    });
    desc.value = tl.description ?? "";
    desc.oninput = () => {
      tl.description = desc.value.trim() ? desc.value : undefined;
      this.markDirty();
    };
  }

  private renderToolbar(): void {
    const tl = this.timeline!;
    const toolbar = this.container.createDiv({ cls: "tl-editor__toolbar" });

    const info = toolbar.createDiv({ cls: "tl-editor__toolbar-info" });
    info.createEl("span", {
      cls: "tl-editor__count",
      text: `${tl.events.length} 个事件`,
    });
    info.createEl("span", {
      cls: "tl-editor__hint-inline",
      text: "拖拽 ⠿ 重排",
    });

    const actions = toolbar.createDiv({ cls: "tl-editor__toolbar-actions" });
    new ButtonComponent(actions)
      .setButtonText(this.sortByDate ? "按日期排序：开" : "按日期排序：关")
      .setClass("tl-btn")
      .setClass("tl-btn--ghost")
      .setClass("tl-btn--sm")
      .onClick(() => {
        this.sortByDate = !this.sortByDate;
        this.render();
      });
    new ButtonComponent(actions)
      .setButtonText("添加事件")
      .setClass("tl-btn")
      .setClass("tl-btn--primary")
      .onClick(() => {
        this.formMode = { kind: "new" };
        this.render();
        this.container.querySelector<HTMLElement>(".tl-event-form__title")?.focus();
      });
    // Inject the plus icon manually (ButtonComponent.setIcon uses Obsidian's
    // internal icon registry which may not be available in all environments).
    const addBtn = actions.querySelector<HTMLButtonElement>(".tl-btn--primary");
    if (addBtn) {
      const iconSpan = createEl("span", { cls: "tl-btn__icon" });
      setSvgIcon(iconSpan, "plus");
      addBtn.prepend(iconSpan);
    }
  }

  private renderBody(): void {
    const body = this.container.createDiv({ cls: "tl-editor__body" });

    const previewWrap = body.createDiv({ cls: "tl-editor__preview" });
    const previewInner = previewWrap.createDiv({ cls: "tl-editor__preview-inner" });
    renderTimeline(
      previewInner,
      this.timeline!,
      {
        draggable: !this.sortByDate,
        sortByDate: this.sortByDate,
        showHeader: false,
        onEventClick: (event) => this.openEventForm(event),
        onReorder: (fromId, toId) => this.reorderEvents(fromId, toId),
      }
    );

    if (this.formMode.kind !== "closed") {
      const formWrap = body.createDiv({ cls: "tl-editor__form", attr: { "data-event-form": "" } });
      this.renderEventForm(formWrap);
      // Scroll the form into view after the DOM settles, so the user sees the
      // editor they just invoked by clicking "add" or clicking an event card.
      requestAnimationFrame(() => {
        formWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } else {
      const hint = body.createDiv({ cls: "tl-editor__hint" });
      hint.createEl("p", { text: "点击事件卡片进行编辑，拖拽 ⠿ 手柄重新排序，或使用「添加事件」新建。" });
    }
  }

  private renderEventForm(host: HTMLElement): void {
    host.empty();
    const isNew = this.formMode.kind === "new";
    const seed: TimelineEvent =
      this.formMode.kind === "edit"
        ? { ...this.formMode.event }
        : {
            id: generateId(),
            date: new Date().toISOString().slice(0, 10),
            title: "",
          };

    const form = host.createDiv({ cls: "tl-event-form" });
    form.createEl("h4", {
      cls: "tl-event-form__heading",
      text: isNew ? "新建事件" : "编辑事件",
    });

    // 时间
    const dateField = this.field(form, "时间");
    const dateInput = dateField.createEl("input", {
      cls: "tl-input",
      attr: { type: "date", value: seed.date.slice(0, 10) },
    });
    const timeInput = dateField.createEl("input", {
      cls: "tl-input tl-event-form__time",
      attr: { type: "time", value: this.timePart(seed.date) },
    });

    // 事件
    const titleField = this.field(form, "事件");
    const titleInput = titleField.createEl("input", {
      cls: "tl-input tl-event-form__title",
      attr: { type: "text", placeholder: "发生了什么？", value: seed.title },
    });

    // 描述
    const descField = this.field(form, "描述");
    const descInput = descField.createEl("textarea", {
      cls: "tl-input tl-event-form__desc",
      attr: { rows: "3", placeholder: "简短描述", value: seed.description ?? "" },
    });

    // Actions
    const actions = form.createDiv({ cls: "tl-event-form__actions" });
    if (!isNew) {
      new ButtonComponent(actions)
        .setButtonText("删除")
        .setClass("tl-btn")
        .setClass("tl-btn--danger")
        .setWarning()
        .onClick(() => this.deleteEvent(seed.id));
    }
    actions.createDiv({ cls: "tl-event-form__spacer" });
    new ButtonComponent(actions)
      .setButtonText("取消")
      .setClass("tl-btn")
      .setClass("tl-btn--ghost")
      .onClick(() => {
        this.formMode = { kind: "closed" };
        this.render();
      });
    new ButtonComponent(actions)
      .setButtonText(isNew ? "添加事件" : "更新事件")
      .setClass("tl-btn")
      .setClass("tl-btn--primary")
      .onClick(() => {
        const event: TimelineEvent = {
          id: seed.id,
          date: this.composeDate(dateInput.value, timeInput.value),
          title: titleInput.value.trim() || "未命名事件",
          description: descInput.value.trim() || undefined,
        };
        this.commitEvent(event, isNew);
      });
  }

  private field(host: HTMLElement, label: string): HTMLElement {
    const wrap = host.createDiv({ cls: "tl-event-form__field" });
    wrap.createEl("label", { cls: "tl-event-form__label", text: label });
    return wrap;
  }

  // ---- State helpers -------------------------------------------------------

  private openEventForm(event: TimelineEvent): void {
    this.formMode = { kind: "edit", event };
    this.render();
    this.container.querySelector<HTMLElement>(".tl-event-form__title")?.focus();
  }

  private reorderEvents(fromId: string, toId: string): void {
    const tl = this.timeline!;
    const fromIdx = tl.events.findIndex((e) => e.id === fromId);
    const toIdx = tl.events.findIndex((e) => e.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [moved] = tl.events.splice(fromIdx, 1);
    tl.events.splice(toIdx, 0, moved);
    this.formMode = { kind: "closed" };
    this.render();
    this.markDirty();
  }

  private commitEvent(event: TimelineEvent, isNew: boolean): void {
    const tl = this.timeline!;
    if (isNew) {
      tl.events.push(event);
    } else {
      const idx = tl.events.findIndex((e) => e.id === event.id);
      if (idx >= 0) tl.events[idx] = event;
    }
    this.formMode = { kind: "closed" };
    this.render();
    this.markDirty();
  }

  private deleteEvent(id: string): void {
    const tl = this.timeline!;
    tl.events = tl.events.filter((e) => e.id !== id);
    this.formMode = { kind: "closed" };
    this.render();
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
    this.callbacks.onDirtyChange?.(true);
    const saveBtn = this.container.querySelector<HTMLButtonElement>(
      ".tl-editor__header-actions .tl-btn--primary"
    );
    if (saveBtn) {
      saveBtn.setText(this.settings.autoSave ? "保存中…" : "保存");
      saveBtn.disabled = false;
    }
    this.scheduleAutoSave();
  }

  /** Debounced auto-save: fires `autoSaveDelay` ms after the last edit. */
  private scheduleAutoSave(): void {
    if (!this.settings.autoSave) return;
    this.clearAutoSaveTimer();
    const delay = Math.max(300, this.settings.autoSaveDelay || 1200);
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null;
      void this.save();
    }, delay);
  }

  private clearAutoSaveTimer(): void {
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private timePart(date: string): string {
    if (date.length > 10) return date.slice(11, 16);
    return "";
  }

  private composeDate(date: string, time: string): string {
    if (!isValidEventDate(date)) {
      return this.timeline!.events[0]?.date ?? new Date().toISOString().slice(0, 10);
    }
    return time ? `${date} ${time}` : date;
  }

  private async save(): Promise<void> {
    if (!this.timeline || !this.path || this.saving) return;
    this.saving = true;
    this.timeline.updatedAt = new Date().toISOString();
    // Persist the user's dragged order (not a date-sorted copy).
    try {
      const savedPath = await this.repo.save(this.timeline, this.path);
      this.path = savedPath;
      this.dirty = false;
      this.clearAutoSaveTimer();
      this.callbacks.onDirtyChange?.(false);
      this.callbacks.onSaved?.(this.timeline, savedPath);
      // Update only the save button label instead of a full re-render, so the
      // user's focus / scroll position in the form is not disturbed.
      const saveBtn = this.container.querySelector<HTMLButtonElement>(
        ".tl-editor__header-actions .tl-btn--primary"
      );
      if (saveBtn) {
        saveBtn.setText("已保存");
        saveBtn.disabled = true;
      }
    } catch (err) {
      this.showError("无法保存时间线", err);
    } finally {
      this.saving = false;
    }
  }

  private showError(message: string, err: unknown): void {
    const modal = new Modal(this.app);
    modal.titleEl.setText("时间线管理器");
    modal.contentEl.createEl("p", { text: message });
    modal.contentEl.createEl("pre", {
      text: err instanceof Error ? err.message : String(err),
    });
    new ButtonComponent(modal.contentEl)
      .setButtonText("关闭")
      .setClass("tl-btn")
      .setClass("tl-btn--primary")
      .onClick(() => modal.close());
    modal.open();
  }
}

// Keep sortEventsAscending referenced for callers that import from here.
export { sortEventsAscending };
