# Timeline Manager for Obsidian

一个 Obsidian 插件，用于可视化地创建和管理时间线。每条时间线都是一个 Markdown 文档——frontmatter 存储元数据，GFM 表格存储事件（时间 | 事件 | 描述），在阅读视图中自动渲染为可视化时间线。

## 功能特性

- **可视化时间线管理器** — 侧边栏列出所有时间线文档，支持搜索、新建、删除
- **拖拽排序** — 通过 `⠿` 手柄拖拽事件卡片重新排列顺序
- **自动保存** — 编辑后自动防抖保存到 Markdown 文档，切换/关闭时自动落盘
- **阅读视图渲染** — 在阅读视图中将事件表格自动渲染为可视化时间线
- **Markdown 原生存储** — 数据以 frontmatter + GFM 表格存储，源码模式可直接查看和编辑
- **内联 SVG 图标** — 不依赖 Obsidian 图标注册表，所有图标始终可见
- **Google Design System 风格** — 支持亮色/暗色主题

## 存储格式

每条时间线对应一个 `.md` 文件：

```markdown
---
timelineId: a1b2c3
title: "产品发布计划"
createdAt: 2024-03-15T10:00:00.000Z
updatedAt: 2025-01-01T00:00:00.000Z
---

# 产品发布计划

Q3 发布的跨团队里程碑。

| 时间 | 事件 | 描述 |
| --- | --- | --- |
| 2024-03-20 | 启动会 | 全员启动 |
| 2024-04-15 14:30 | Beta 发布 | 内测版本 |
```

- frontmatter 存储元数据（ID、标题、时间戳）
- GFM 表格存储事件，源码模式可直接编辑
- 支持管道符 `\|` 和反斜杠 `\\` 转义

## 安装

### 方式一：手动安装

1. 下载最新 [Release](https://github.com/leone-l/obsidian-timeline-manager/releases)
2. 解压 zip 文件
3. 将 `main.js`、`manifest.json`、`styles.css` 复制到你的 Vault 下的 `.obsidian/plugins/timeline-manager/` 目录
4. 在 Obsidian 设置 → 第三方插件中启用「Timeline Manager」

### 方式二：从源码构建

```bash
git clone https://github.com/leone-l/obsidian-timeline-manager.git
cd obsidian-timeline-manager
npm install
npm run build
```

将生成的 `main.js`、`manifest.json`、`styles.css` 复制到插件目录。

## 使用方法

1. 点击左侧边栏的日历图标，或运行命令「打开时间线管理器」
2. 点击「+ 新建」创建时间线
3. 在编辑器中添加事件（时间、事件名、短描述）
4. 拖拽 `⠿` 手柄重新排列事件顺序
5. 编辑自动保存到对应的 Markdown 文档

## 设置

- **默认文件夹** — 新建时间线的默认存放目录
- **创建后打开文档** — 创建时间线后自动打开 Markdown 文档
- **显示事件数量** — 在侧栏列表中显示每个时间线的事件数
- **自动保存** — 编辑后自动保存（默认开启）

## 技术栈

- TypeScript + esbuild
- Obsidian Plugin API
- HTML5 Drag and Drop API
- Google Design System 设计令牌

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck

# 运行测试
npm test
```

## License

MIT
