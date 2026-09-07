// Plugin settings and settings tab. Settings are persisted via Obsidian's
// loadData/saveData, and the tab renders a Google-styled form.

import { App, PluginSettingTab, Setting } from "obsidian";

export interface TimelineSettings {
  /** Folder where new timeline documents are created. */
  defaultFolder: string;
  /** Reveal the markdown file after creating a timeline. */
  openAfterCreate: boolean;
  /** Show event counts on the manager sidebar entries. */
  showEventCounts: boolean;
  /** Auto-save timeline edits after a short debounce. */
  autoSave: boolean;
  /** Debounce delay (ms) before auto-save fires. */
  autoSaveDelay: number;
}

export const DEFAULT_SETTINGS: TimelineSettings = {
  defaultFolder: "Timelines",
  openAfterCreate: false,
  showEventCounts: true,
  autoSave: true,
  autoSaveDelay: 1200,
};

export class TimelineSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: { settings: TimelineSettings; saveSettings: () => Promise<void> },
    private onChange: () => void
  ) {
    super(app, plugin as never);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("默认文件夹")
      .setDesc("新建的时间线文档将创建在该仓库文件夹下。")
      .addText((text) => {
        text.setValue(this.plugin.settings.defaultFolder).onChange(async (value) => {
          this.plugin.settings.defaultFolder = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("创建后打开文档")
      .setDesc("创建时间线后，在新标签页中打开对应的 markdown 文件。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.openAfterCreate)
          .onChange(async (value) => {
            this.plugin.settings.openAfterCreate = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("显示事件数量")
      .setDesc("在侧栏的每个时间线旁显示其事件数量。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showEventCounts)
          .onChange(async (value) => {
            this.plugin.settings.showEventCounts = value;
            await this.plugin.saveSettings();
            this.onChange();
          });
      });

    new Setting(containerEl)
      .setName("自动保存")
      .setDesc("编辑时间线后自动保存到对应的 markdown 文档，无需手动点击保存。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoSave)
          .onChange(async (value) => {
            this.plugin.settings.autoSave = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
