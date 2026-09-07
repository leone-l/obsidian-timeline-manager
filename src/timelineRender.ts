// Shared DOM renderer for a Timeline. Used by the management editor (draggable,
// interactive) and by the reading-view post-processor (read-only). Events render
// in array order — the user's dragged order — and colors are derived from each
// event's index via the Google chart palette, so the stored markdown stays a
// clean three-column table.

import {
  Timeline,
  TimelineEvent,
  colorForIndex,
  sortEventsAscending,
} from "./types";

export interface RenderOptions {
  /** When true, rows are draggable to reorder and clickable to edit. */
  draggable?: boolean;
  /** Called when an event row is clicked. */
  onEventClick?: (event: TimelineEvent, index: number) => void;
  /** Called after a drag-and-drop reorder, with the moved id and target id. */
  onReorder?: (fromId: string, toId: string) => void;
  /** Whether the surrounding theme is dark. Defaults to auto-detection. */
  isDark?: boolean;
  /** Show the timeline header block (title/meta). Defaults to true. */
  showHeader?: boolean;
  /** Sort events by date instead of preserving manual order. */
  sortByDate?: boolean;
}

/** Render a timeline into `container`, replacing prior content. */
export function renderTimeline(
  container: HTMLElement,
  timeline: Timeline,
  options: RenderOptions = {}
): void {
  container.empty();
  container.addClass("timeline-render");

  const isDark = options.isDark ?? container.closest(".theme-dark, .dark") !== null;

  if (options.showHeader !== false) {
    const header = container.createDiv({ cls: "timeline-render__header" });
    header.createEl("h3", {
      cls: "timeline-render__title",
      text: timeline.title || "Untitled timeline",
    });
    if (timeline.description) {
      header.createEl("p", {
        cls: "timeline-render__description",
        text: timeline.description,
      });
    }
    const events = timeline.events ?? [];
    const ordered = options.sortByDate ? sortEventsAscending(events) : events;
    const meta = header.createDiv({ cls: "timeline-render__meta" });
    const countPill = meta.createEl("span", {
      cls: "timeline-render__pill",
      text: `${events.length} 个事件`,
    });
    countPill.createEl("span", {
      cls: "timeline-render__pill-dot",
      attr: { "aria-hidden": "true" },
    });
    if (ordered.length) {
      const first = formatDate(ordered[0].date);
      const last = formatDate(ordered[ordered.length - 1].date);
      meta.createEl("span", {
        cls: "timeline-render__range",
        text: `${first} → ${last}`,
      });
    }
  }

  const list = container.createDiv({ cls: "timeline-render__list" });
  const ordered = options.sortByDate
    ? sortEventsAscending(timeline.events ?? [])
    : timeline.events ?? [];

  if (ordered.length === 0) {
    list.createDiv({
      cls: "timeline-render__empty",
      text: "还没有事件。在管理页面中添加或拖拽来组织时间线。",
    });
    return;
  }

  ordered.forEach((event, index) => {
    const color = colorForIndex(index, isDark);
    const row = list.createDiv({
      cls: "timeline-event" +
        (options.draggable ? " is-draggable" : "") +
        (options.onEventClick ? " is-interactive" : ""),
      attr: {
        "data-event-id": event.id,
        "data-event-index": String(index),
      },
    });
    row.style.setProperty("--event-color", color);

    if (options.draggable) {
      // Only the grip is draggable, not the whole card. This prevents the
      // browser from interpreting a click on the card body as a drag start,
      // which made clicking to edit feel unreliable.
      const handle = row.createDiv({
        cls: "timeline-event__grip",
        attr: { "aria-hidden": "true", "data-drag-handle": "true", draggable: "true" },
      });
      handle.setText("⠿");
    }

    const marker = row.createDiv({ cls: "timeline-event__marker" });
    marker.createEl("span", {
      cls: "timeline-event__dot",
      attr: { "aria-hidden": "true" },
    });

    const body = row.createDiv({ cls: "timeline-event__body" });
    body.createEl("time", {
      cls: "timeline-event__date",
      text: formatDate(event.date),
      attr: { datetime: event.date },
    });
    body.createEl("h4", {
      cls: "timeline-event__title",
      text: event.title,
    });
    if (event.description) {
      body.createEl("p", {
        cls: "timeline-event__description",
        text: event.description,
      });
    }

    if (options.onEventClick) {
      row.setAttr("role", "button");
      row.setAttr("tabindex", "0");
      const handler = (ev: MouseEvent) => {
        // Don't trigger edit when the user clicks the drag grip.
        const target = ev.target as HTMLElement;
        if (target.closest(".timeline-event__grip")) return;
        ev.preventDefault();
        options.onEventClick?.(event, index);
      };
      row.onclick = handler;
      row.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          options.onEventClick?.(event, index);
        }
      };
    }
  });

  if (options.draggable && options.onReorder) {
    attachDragReorder(list, options.onReorder);
  }
}

/** Wire HTML5 drag-and-drop reordering onto the rendered list. Only the
 *  grip handle is draggable, so clicking the card body always edits. */
function attachDragReorder(
  list: HTMLElement,
  onReorder: (fromId: string, toId: string) => void
): void {
  let dragId: string | null = null;

  list.addEventListener("dragstart", (ev) => {
    // The drag starts on the grip (the only draggable child). Find its row.
    const grip = (ev.target as HTMLElement).closest<HTMLElement>("[data-drag-handle]");
    if (!grip) return;
    const row = grip.closest<HTMLElement>(".timeline-event");
    if (!row) return;
    dragId = row.getAttribute("data-event-id");
    row.addClass("is-dragging");
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", dragId ?? "");
    }
  });

  list.addEventListener("dragend", () => {
    list.querySelectorAll(".timeline-event").forEach((el) =>
      el.removeClass("is-dragging", "is-drop-target")
    );
    dragId = null;
  });

  list.addEventListener("dragover", (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>(".timeline-event");
    if (!row || row.getAttribute("data-event-id") === dragId) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    list.querySelectorAll(".is-drop-target").forEach((el) =>
      el.removeClass("is-drop-target")
    );
    row.addClass("is-drop-target");
  });

  list.addEventListener("dragleave", (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>(".timeline-event");
    row?.removeClass("is-drop-target");
  });

  list.addEventListener("drop", (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>(".timeline-event");
    if (!row || !dragId) return;
    ev.preventDefault();
    const targetId = row.getAttribute("data-event-id");
    if (targetId && targetId !== dragId) {
      onReorder(dragId, targetId);
    }
    row.removeClass("is-drop-target");
    dragId = null;
  });
}

/** Format an event date into a readable label. */
function formatDate(raw: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "未注明";
  const dateOnly = trimmed.slice(0, 10);
  const date = new Date(dateOnly + "T00:00:00");
  if (isNaN(date.getTime())) return trimmed;
  const months = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];
  const timePart = trimmed.length > 10 ? trimmed.slice(11, 16) : "";
  const label = `${date.getFullYear()} ${months[date.getMonth()]}${date.getDate()}日`;
  return timePart ? `${label} ${timePart}` : label;
}
