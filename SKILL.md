# llm-wiki-sync

**OpenClaw × Obsidian LLM Wiki Sync Skill**

## 两大作用

| 定位 | 说明 |
|------|------|
| **🧠 第二大脑** | Obsidian作为外部知识库，存储详细笔记 |
| **💾 备份工作区** | Obsidian Vault是OpenClaw工作区的外部备份 |

## v2.0.0 新增功能

- **health** — 健康评分 (0-100，含A+/A/B/C/D评级)
- **dedup** — 内容查重扫描 (strict/loose 模式)
- **stats** — 详细统计面板 (文件/分类/大小/标签/链接)
- **backup** — 全量备份 (wiki+brain+核心MD+manifest)
- **export** — 报告导出 (JSON/HTML/Markdown)
- **watch** — 文件变更监视模式
- **interactive** — 交互式命令行
- **Git Hooks + GitHub CI** 自动化

## 操作列表

| 操作 | 说明 |
|------|------|
| compile | JSON/Markdown编译检查 |
| lint | 7项自检（断链/孤立/短笔记等） |
| sync | OpenClaw ↔ Obsidian数据对齐 |
| index | Obsidian index.md统计 |
| ingest | 导入内容到wiki |
| query | 搜索wiki并回答 |
| reindex | 重建index.md |
| **health** | **健康评分 0-100** |
| **dedup** | **内容查重扫描** |
| **stats** | **详细统计面板** |
| **backup** | **全量备份** |
| **export** | **报告导出** |
| **watch** | **文件变更监视** |
| all | 全部检查 |

## 调用方式

```
llm-wiki-sync compile
llm-wiki-sync lint
llm-wiki-sync health
llm-wiki-sync dedup --dedup-mode=strict
llm-wiki-sync stats
llm-wiki-sync backup --backup-dir D:/backups
llm-wiki-sync export --format html --out ./reports
llm-wiki-sync watch --interval 30
llm-wiki-sync interactive
llm-wiki-sync all
llm-wiki-sync ingest <内容>
llm-wiki-sync query <关键词>
llm-wiki-sync reindex
```

## 核心脚本

```
node "skill:llm-wiki-sync/llm-wiki-sync.js" [operation]
```

## 前提条件

### OpenClaw工作区结构要求

```
OpenClaw工作区/
├── SOUL.md, AGENTS.md, MEMORY.md, USER.md
├── HEARTBEAT.md, IDENTITY.md, TOOLS.md, BOOTSTRAP.md
└── brain/
    ├── decisions/        ← 决策记录
    ├── lessons/          ← 教训记录
    ├── inbox.md          ← 收件箱
    ├── memory-task.md    ← 记忆任务
    ├── plan.md           ← 计划
    ├── learned.md        ← 学到的经验
    └── knowledge_graph/  ← 知识图谱（可选）
        ├── nodes.json
        └── relations.json
```

### Agent与Obsidian双向连接设置

#### 方案1：通过Skill配置（推荐）

```markdown
## 配置
- OBSIDIAN_ROOT: D:/obsidian知识库/我的知识库
- ROOT: C:/Users/你的用户/.openclaw/workspace
```

### 必须存在的目录结构

#### Obsidian Vault（最小可用）
```
你的Obsidian Vault/
├── index.md     ← 全局目录（必须）
└── wiki/        ← 只需创建此目录，内容可为空
    ├── concepts/
    ├── entities/
    ├── sources/
    └── synthesis/
```

#### 如使用sync功能还需要OpenClaw brain/
```
OpenClaw工作区/
└── brain/
    ├── decisions/  ← 决策记录
    └── lessons/   ← 教训记录
```

## OpenClaw工作区结构（v2.0.0新增）

llm-wiki-sync v2.0.0 会自动检测以下 OpenClaw 关键目录和文件：

| 类别 | 路径 | 说明 |
|------|------|------|
| 核心文件 | SOUL.md, AGENTS.md, MEMORY.md, USER.md, HEARTBEAT.md, IDENTITY.md, TOOLS.md, BOOTSTRAP.md | 健康检查项 |
| brain目录 | brain/ | 第二大脑根目录 |
| 决策库 | brain/decisions/ | OpenClaw决策记录 |
| 教训库 | brain/lessons/ | OpenClaw教训记录 |
| 收件箱 | brain/inbox.md | 待处理任务列表 |
| 知识图谱 | knowledge_graph/ | 知识图谱数据（nodes.json + relations.json） |

**health/stats/backup 操作会自动检测上述所有路径**

## 配置变量（打开llm-wiki-sync.js修改）

```javascript
const CONFIG = {
  // ★ 必须修改
  ROOT:           'C:/Users/你的用户/.openclaw/workspace',
  OBSIDIAN_ROOT:  'D:/obsidian知识库/你的知识库',
  WIKI_DIR:       'D:/obsidian知识库/你的知识库/wiki',
  // 可选
  BACKUP_DIR:     'D:/obsidian知识库/备份',
  EXPORT_DIR:     'C:/Users/你的用户/.openclaw/workspace/llm-wiki-reports'
};
```

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-05-11 | 初始版本，整合compile/lint/sync/index |
| v1.1.0 | 2026-05-11 | 添加ingest/query/reindex，频率指南 |
| v1.2.0 | 2026-05-11 | 完善README，添加完整配置说明 |
| v1.3.0 | 2026-05-11 | 添加OpenClaw结构要求、双向连接设置 |
| v1.4.0 | 2026-05-11 | 强调两大定位：第二大脑+备份工作区 |
| **v2.0.0** | **2026-05-11** | **新增health/dedup/stats/backup/export/watch/interactive/CI** |

---

_最后更新: 2026-05-11_
_基于: karpathy-llm-wiki + LLM-Wiki-Template_
