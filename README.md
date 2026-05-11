# llm-wiki-sync

> **OpenClaw × Obsidian LLM Wiki Sync**

## 🎯 两大定位

| 定位 | 说明 |
|------|------|
| **🧠 OpenClaw的第二大脑** | Obsidian作为外部知识库，存储详细笔记 |
| **💾 OpenClaw的备份工作区** | Obsidian Vault是OpenClaw工作区的外部备份 |

基于Karpathy LLM Wiki方法论，实现OpenClaw与Obsidian的协同工作。

## 📚 Karpathy LLM Wiki 核心思想

| 传统方式 | LLM Wiki方式 |
|----------|-------------|
| LLM = 临时检索工具 | LLM = 编译器 |
| 问答时临时搜索 | 一次性编译，持续复用 |
| 知识散落原始文档 | 结构化Wiki |

## 🚀 快速开始

### 安装

```bash
# 方式1：复制目录
cp -r llm-wiki-sync/ 你的skills/目录/

# 方式2：Git Clone
git clone https://github.com/wzhgfwy001/llm-wiki-sync.git
```

### 配置

编辑 `llm-wiki-sync.js`，修改CONFIG中的路径：

```javascript
const CONFIG = {
  ROOT:           'C:/Users/你的用户/.openclaw/workspace',
  OBSIDIAN_ROOT:  'D:/obsidian知识库/你的知识库',
  WIKI_DIR:       'D:/obsidian知识库/你的知识库/wiki'
};
```

### 运行

```bash
# 全部检查（推荐首次运行）
node llm-wiki-sync.js all

# 单项检查
node llm-wiki-sync.js compile    # 编译检查
node llm-wiki-sync.js lint        # 7项自检
node llm-wiki-sync.js health      # 健康评分
node llm-wiki-sync.js dedup       # 查重扫描
node llm-wiki-sync.js stats       # 详细统计
node llm-wiki-sync.js sync        # 数据对齐

# 备份与导出
node llm-wiki-sync.js backup --backup-dir D:/backups
node llm-wiki-sync.js export --format html --out ./reports

# 监视与交互
node llm-wiki-sync.js watch --interval 30
node llm-wiki-sync.js interactive

# 内容管理
node llm-wiki-sync.js ingest "<内容>"      # 导入内容
node llm-wiki-sync.js query "关键词"        # 搜索回答
node llm-wiki-sync.js reindex              # 重建索引
```

## 📁 文件清单

```
llm-wiki-sync/
├── llm-wiki-sync.js          ← 核心脚本 (v2.0.0)
├── SKILL.md                  ← Skill定义
├── README.md                 ← 本文件
├── _meta.json                ← 元数据
├── .github/workflows/
│   └── sync-ci.yml           ← GitHub CI自动化
├── scripts/
│   └── llm-wiki-hooks.js     ← Git hooks脚本
└── .gitignore
```

## ✅ 7项自检 (lint)

| 检查项 | 说明 |
|--------|------|
| 断链 | `[[page]]` 指向不存在的文件 |
| 孤立 | wiki页面不在index.md中 |
| 短笔记 | 内容<200字符 |
| 缺失概念 | ≥3页面提到但无自己页面 |
| 过期声明 | 无`evergreen:true`且源>180天 |
| 索引漂移 | wiki/文件不在index.md中 |
| 矛盾 | 跨页面冲突声明 |

## 🎯 v2.0.0 新功能

### health — 健康评分
```
node llm-wiki-sync.js health
```
- 0-100分，含 A+/A/B/C/D 评级
- 8项检查：核心文件、Wiki目录结构、index.md、brain/、短笔记比例、孤立页面比例、decisions同步、lessons同步
- 自动检测 brain/ 和 knowledge_graph/ 目录

### dedup — 查重扫描
```
node llm-wiki-sync.js dedup --dedup-mode=strict
```
- loose模式（默认）：70%相似度阈值
- strict模式：50%相似度阈值

### stats — 详细统计
```
node llm-wiki-sync.js stats
```
- 文件总数、大小分布、分类统计
- 标签分布 Top10、链接统计
- OpenClaw集成状态、知识图谱节点/边数

### backup — 全量备份
```
node llm-wiki-sync.js backup --backup-dir D:/backups
```
- 自动备份 wiki/ + brain/ + 核心MD + index.md
- 生成 manifest.json 记录备份信息

### export — 报告导出
```
node llm-wiki-sync.js export --format=html --out ./reports
```
- html：带图表美化的可视化报告
- md：纯Markdown报告
- json：结构化数据导出

### watch — 文件监视
```
node llm-wiki-sync.js watch --interval 30
```
- 监视 wiki/ 目录文件变更
- 状态持久化到 `.llm-wiki-sync.state.json`

### interactive — 交互模式
```
node llm-wiki-sync.js --interactive
```
- TTY交互式命令行
- 输入命令实时执行

## 🔧 系统要求

- Node.js v16+
- Obsidian v1.0+（可选）
- Git（推荐，用于版本控制和CI）

## 📂 OpenClaw工作区结构

llm-wiki-sync 会自动检测以下目录结构：

```
OpenClaw工作区/
├── SOUL.md, AGENTS.md, MEMORY.md, USER.md
├── HEARTBEAT.md, IDENTITY.md, TOOLS.md, BOOTSTRAP.md
└── brain/
    ├── decisions/
    ├── lessons/
    ├── inbox.md
    ├── memory-task.md
    ├── knowledge_graph/
    │   ├── nodes.json
    │   └── relations.json
    └── ...
```

## ⚙️ Git Hooks 自动提交

安装 hooks：
```bash
node scripts/llm-wiki-hooks.js install
```

hooks 会在 `git push` 前自动运行：
- `compile` 检查
- `lint` 自检

## 🔄 GitHub CI

`.github/workflows/sync-ci.yml` 会在每次 push 时自动运行全部检查。

## 📄 基于

- [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [LLM-Wiki-Template (Whitefox75)](https://github.com/Whitefox75/LLM-Wiki-Template)
- [LLM-Wiki-Template (IvanKRZ)](https://github.com/IvanKRZ/LLM-Wiki-Template)

## 📄 许可

MIT

---

_版本: v2.0.0_
