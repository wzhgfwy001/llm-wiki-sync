# llm-wiki-sync

> **OpenClaw × Obsidian LLM Wiki 协同系统**
>
> 本项目是一套完整的知识管理系统实施指南。AI Agent 读取本文档后可直接执行搭建，无需人工干预。

---

## 🎯 系统概述

### 两大核心定位

| 定位 | 说明 |
|------|------|
| **🧠 OpenClaw 的第二大脑** | Obsidian 作为外部知识库，存储详细笔记 |
| **💾 OpenClaw 的备份工作区** | Obsidian Vault 是 OpenClaw 工作区的外部备份 |

### 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   OpenClaw 工作区                    │
│         (C:/Users/<USER>/.openclaw/workspace/)       │
│                                                      │
│  SOUL.md, AGENTS.md, MEMORY.md, USER.md, HEARTBEAT  │
│                                                      │
│  brain/                                             │
│   ├── decisions/  ← 决策记录（同步到 wiki/sources/  │
│   ├── lessons/   ← 教训记录（同步到 wiki/sources/   │
│   ├── inbox.md   ← 待办事项                           │
│   ├── memory-task.md                                 │
│   └── knowledge_graph/  ← 知识图谱                    │
└────────────────┬──────────────────────────────────────┘
                 │  llm-wiki-sync 同步
                 │  sync 命令检查两边是否一致
                 ▼
┌─────────────────────────────────────────────────────┐
│              Obsidian Vault                          │
│         (D:/obsidian知识库/我的知识库/)             │
│                                                      │
│  index.md        ← 全局目录（必须存在）             │
│                                                      │
│  wiki/                                              │
│   ├── concepts/   ← 概念页面                         │
│   ├── entities/   ← 实体页面                         │
│   ├── sources/    ← 来源资料                         │
│   │   ├── decisions/  ← 决策记录备份                 │
│   │   └── lessons/   ← 教训记录备份                 │
│   └── synthesis/   ← 综合分析                        │
└─────────────────────────────────────────────────────┘
```

---

## 📋 实施清单（Agent 可直接执行）

以下步骤按顺序执行即可完成完整搭建。

### 第1步：创建 Obsidian Vault 目录结构

```bash
# 创建 Obsidian Vault（路径可根据实际情况调整）
mkdir -p "D:/obsidian知识库/你的知识库/wiki/concepts"
mkdir -p "D:/obsidian知识库/你的知识库/wiki/entities"
mkdir -p "D:/obsidian知识库/你的知识库/wiki/sources/decisions"
mkdir -p "D:/obsidian知识库/你的知识库/wiki/sources/lessons"
mkdir -p "D:/obsidian知识库/你的知识库/wiki/synthesis"

# 创建全局索引文件（必须）
echo "# Index" > "D:/obsidian知识库/你的知识库/index.md"
echo "> 由 llm-wiki-sync 管理" >> "D:/obsidian知识库/你的知识库/index.md"
```

### 第2步：确认 OpenClaw 工作区结构

```
OpenClaw 工作区根目录/
├── SOUL.md           ← 系统灵魂（必须存在）
├── AGENTS.md         ← Agent 定义（必须存在）
├── MEMORY.md         ← 长期记忆（必须存在）
├── USER.md           ← 用户画像（必须存在）
├── HEARTBEAT.md      ← 心跳配置（必须存在）
├── IDENTITY.md       ← 身份定义（必须存在）
├── TOOLS.md          ← 工具说明（必须存在）
├── BOOTSTRAP.md      ← 启动脚本（必须存在）
└── brain/            ← 第二大脑根目录
    ├── decisions/    ← 决策记录（与 wiki/sources/decisions/ 同步）
    ├── lessons/      ← 教训记录（与 wiki/sources/lessons/ 同步）
    ├── inbox.md      ← 收件箱
    ├── memory-task.md
    ├── plan.md
    ├── learned.md
    └── knowledge_graph/
        ├── nodes.json
        └── relations.json
```

### 第3步：安装 llm-wiki-sync

```bash
# 方式1：复制到 skills 目录
cp -r llm-wiki-sync/ ~/.openclaw/workspace/skills/skill-drafts/llm-wiki-sync/

# 方式2：Git Clone（独立仓库）
git clone https://github.com/wzhgfwy001/llm-wiki-sync.git
```

### 第4步：配置脚本路径

编辑 `llm-wiki-sync.js`，修改 `CONFIG` 对象：

```javascript
const CONFIG = {
  // ★ 必须修改为你的实际路径
  ROOT:           'C:/Users/<你的用户名>/.openclaw/workspace',
  OBSIDIAN_ROOT:  'D:/obsidian知识库/你的知识库',
  WIKI_DIR:       'D:/obsidian知识库/你的知识库/wiki',

  // 以下为可选配置
  BACKUP_DIR:     'D:/obsidian知识库/备份',
  EXPORT_DIR:     'C:/Users/<你的用户名>/.openclaw/workspace/llm-wiki-reports',

  // OpenClaw 核心文件（health 检查用）
  OC_KEY_FILES: [
    'SOUL.md', 'AGENTS.md', 'MEMORY.md', 'IDENTITY.md',
    'USER.md', 'TOOLS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md'
  ],

  // Obsidian Wiki 必需子目录
  WIKI_SUBDIRS: ['concepts', 'entities', 'sources', 'synthesis'],

  // 忽略的外部链接（Wiki 中引用但不需要检查的文件）
  IGNORED_EXTERNAL_LINKS: ['USER.md', 'SOUL.md', 'AGENTS.md', 'MEMORY.md'],
};
```

**路径格式注意：**
- Windows 使用 `/` 或 `\\`，不要用单反斜杠 `\`
- macOS/Linux 使用 `/`
- 路径中避免空格和特殊字符

### 第5步：验证安装

```bash
node llm-wiki-sync.js help
```

应看到帮助输出，显示所有可用操作。

### 第6步：首次全面检查

```bash
node llm-wiki-sync.js all
```

正常结果示例：
- compile: 17 通过
- sync: decisions OK, lessons OK
- health: 100/100 (A+)
- 最终状态: PASS 或 FAIL（lint 警告不影响功能）

### 第7步：重建索引（首次运行后执行）

```bash
node llm-wiki-sync.js reindex
```

将所有 wiki 文件列入 `index.md`，解决孤立页面问题。

---

## 📂 完整目录结构（可复制部署）

以下结构是本系统的完整形态。`llm-wiki-sync` 脚本会检测所有这些路径：

### OpenClaw 工作区（本地路径）

```
C:/Users/<USER>/.openclaw/workspace/     ← ROOT 配置项
├── SOUL.md
├── AGENTS.md
├── MEMORY.md
├── USER.md
├── IDENTITY.md
├── TOOLS.md
├── HEARTBEAT.md
├── BOOTSTRAP.md
└── brain/
    ├── decisions/          ← 决策记录（必须子目录）
    │   ├── 2026-01-01-决策A.md
    │   └── 2026-01-15-决策B.md
    ├── lessons/             ← 教训记录（必须子目录）
    │   ├── 2026-01-10-教训X.md
    │   └── 2026-02-20-教训Y.md
    ├── inbox.md
    ├── memory-task.md
    ├── plan.md
    ├── learned.md
    └── knowledge_graph/
        ├── nodes.json       ← 知识图谱节点
        └── relations.json   ← 知识图谱关系
```

### Obsidian Vault（外部存储路径）

```
D:/obsidian知识库/你的知识库/       ← OBSIDIAN_ROOT 配置项
├── index.md                ← 全局目录（必须存在）
└── wiki/                  ← 所有笔记（必须子目录）
    ├── concepts/          ← 概念页面（必须子目录）
    │   ├── LLM-Wiki方法论.md
    │   └── Karpathy模板.md
    ├── entities/           ← 实体页面（必须子目录）
    │   └── OpenClaw系统.md
    ├── sources/           ← 来源资料（必须子目录）
    │   ├── decisions/     ← 决策记录备份（与 brain/decisions/ 同步）
    │   └── lessons/        ← 教训记录备份（与 brain/lessons/ 同步）
    └── synthesis/          ← 综合分析（必须子目录）
        └── 季度总结.md
```

---

## 🔧 配置详解

### CONFIG 字段说明

| 字段 | 必须 | 说明 | 示例 |
|------|------|------|------|
| `ROOT` | ✅ | OpenClaw 工作区根目录 | `C:/Users/你的用户名/.openclaw/workspace` |
| `OBSIDIAN_ROOT` | ✅ | Obsidian Vault 根目录 | `D:/obsidian知识库/你的知识库` |
| `WIKI_DIR` | ✅ | Obsidian Wiki 目录 | `D:/obsidian知识库/你的知识库/wiki` |
| `BACKUP_DIR` | ❌ | 备份输出目录 | `D:/obsidian知识库/备份` |
| `EXPORT_DIR` | ❌ | 报告导出目录 | `C:/Users/你的用户名/.openclaw/workspace/llm-wiki-reports` |
| `OC_KEY_FILES` | ❌ | 健康检查的核心文件列表 | 见上方默认值 |
| `WIKI_SUBDIRS` | ❌ | Wiki 必需子目录 | `['concepts','entities','sources','synthesis']` |

### OpenClaw Agent 与 Obsidian 双向连接原理

```
写入流程（用户决定 → OpenClaw 执行）：
  用户决策/教训 → brain/decisions/ → sync 命令 → wiki/sources/decisions/

读取流程（Agent 查询 → OpenClaw 编译）：
  用户提问 → Agent 读取 wiki/concepts/ + wiki/entities/ → 编译回答
```

Agent 不直接读写 Obsidian，而是通过 `sync` 命令保持两边数据对齐。

---

## 📖 操作详解

### compile — 文件完整性检查

检查 OpenClaw 核心 JSON 和 Markdown 文件是否存在且有效。

```bash
node llm-wiki-sync.js compile
```

检查范围：
- `brain/feature-flags.json`
- `brain/progress.json`
- `brain/active-chains.json`
- `brain/knowledge_graph/nodes.json`
- `brain/knowledge_graph/relations.json`
- 所有 `OC_KEY_FILES` 列表中的 `.md` 文件

### lint — 7项自检（Karpathy LLM Wiki 标准）

| 检查项 | 通过条件 | 失败条件 |
|--------|----------|----------|
| 短笔记 | 无 <200 字符的笔记 | 存在短笔记 |
| 断链 | 所有 `[[page]]` 指向存在的文件 | 存在断链 |
| 孤立 | 所有 wiki 文件都在 `index.md` 中 | 存在孤立页面 |
| 缺失概念 | 无 ≥3页面提到但无自己页面的概念 | 存在缺失概念 |
| 过期声明 | 无无 `evergreen:true` 且源>180天的声明 | 存在过期声明 |
| 索引漂移 | 所有 wiki/ 文件都在 `index.md` 中 | 存在漂移 |
| 矛盾 | 无跨页面冲突声明 | 存在矛盾 |

```bash
node llm-wiki-sync.js lint
```

### sync — OpenClaw ↔ Obsidian 数据对齐

检查 `brain/decisions/` 与 `wiki/sources/decisions/` 文件数是否一致，同理 lessons。

```bash
node llm-wiki-sync.js sync
```

**注意：** sync 不会自动复制文件，只报告差异。手动同步或修改 `CONFIG` 指向同一目录可实现真正双向同步。

### health — 健康评分（0-100）

| 检查项 | 分值 |
|--------|------|
| OpenClaw 核心文件存在 | 8项各 -20 |
| Wiki 目录结构完整 | 4项各 -10 |
| index.md 存在 | -15 |
| 短笔记比例 ≤20% | 0，否则 -10 |
| 孤立页面比例 ≤30% | 0，否则 -10 |
| decisions 同步 | 不同步 -5 |
| lessons 同步 | 不同步 -5 |

评分标准：100分满分，A+(90+) / A(85+) / B(75+) / C(65+) / D(<65)

```bash
node llm-wiki-sync.js health
```

### dedup — 内容查重

```bash
node llm-wiki-sync.js dedup                   # loose 模式（70%相似度）
node llm-wiki-sync.js dedup --dedup-mode=strict  # strict 模式（50%相似度）
```

### stats — 详细统计

```bash
node llm-wiki-sync.js stats
```

输出内容：
- 文件总数、分类分布
- 大小分布（tiny<512B / small<2KB / medium<8KB / large<30KB / huge>30KB）
- 标签分布 Top10
- 链接/图片统计
- OpenClaw 集成状态（brain/、knowledge_graph/）
- 知识图谱节点/边数

### backup — 全量备份

```bash
node llm-wiki-sync.js backup --backup-dir D:/backups
```

输出结构：
```
D:/backups/llm-wiki-backup-2026-05-11T03-11-00/
├── wiki/               ← 所有 wiki 文件
├── brain/             ← brain/ 下所有 .md 文件
├── index.md            ← 全局索引
├── manifest.json       ← 备份清单（时间戳+版本+文件数）
└── [SOUL.md, AGENTS.md, ...]  ← 核心 .md 文件
```

### export — 报告导出

```bash
node llm-wiki-sync.js export --format=html --out ./reports
node llm-wiki-sync.js export --format=md   --out ./reports
node llm-wiki-sync.js export --format=json --out ./reports
```

### watch — 文件变更监视

```bash
node llm-wiki-sync.js watch --interval 30   # 每30秒检查一次
```

状态持久化到 `.llm-wiki-sync.state.json`。

### reindex — 重建 index.md

```bash
node llm-wiki-sync.js reindex
```

将 `wiki/` 下所有文件写入 `index.md`，解决孤立页面问题。**首次部署后必须执行。**

### ingest — 导入内容

```bash
node llm-wiki-sync.js ingest "这是一个新概念"
```

### query — 关键词搜索

```bash
node llm-wiki-sync.js query "OpenClaw"
```

---

## ⚙️ 自动化配置

### GitHub CI（可选）

`.github/workflows/sync-ci.yml` 在每次 push 时自动运行：
- 语法检查（`node --check`）
- 帮助信息验证
- stats 统计
- 报告生成

### Git Hooks（可选）

```bash
node scripts/llm-wiki-hooks.js install   # 安装 pre-push hook
node scripts/llm-wiki-hooks.js uninstall # 卸载
```

Hook 在 `git push` 前自动运行 compile + lint。

---

## 🔍 故障排查

### compile 失败：文件不存在

```
[FAIL] brain/feature-flags.json 不存在
```

**解决：** 检查 `CONFIG.ROOT` 路径是否正确，确认 OpenClaw 工作区存在。

### lint 失败：大量断链

```
[WARN] 发现 90 个断链
```

**原因：** Wiki 中引用了其他用户环境特有的路径。  
**解决：** 将 `CONFIG.IGNORED_EXTERNAL_LINKS` 中加入这些文件名。

### health 失败：孤立页面 100%

```
[WARN] 孤立页面比例过高: 100%
```

**原因：** `index.md` 未包含 wiki 文件。  
**解决：** 执行 `node llm-wiki-sync.js reindex`

### sync 失败：decisions 不同步

```
[FAIL] decisions: MISMATCH
```

**原因：** `brain/decisions/` 和 `wiki/sources/decisions/` 文件数量不一致。  
**解决：** 手动补充缺失文件，或将两者之一清空重新同步。

### 脚本参数不生效

**原因：** 参数解析 bug（v2.0.0 之前版本）。  
**解决：** 确认使用 v2.0.0+，`node llm-wiki-sync.js help` 应显示单操作输出而非 `all`。

---

## 📄 基于

- [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [LLM-Wiki-Template (Whitefox75)](https://github.com/Whitefox75/LLM-Wiki-Template)
- [LLM-Wiki-Template (IvanKRZ)](https://github.com/IvanKRZ/LLM-Wiki-Template)

## 📄 许可

MIT

---

_版本: v2.0.0_
