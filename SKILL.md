# llm-wiki-sync

**OpenClaw × Obsidian LLM Wiki Sync Skill**

## 两大作用

| 定位 | 说明 |
|------|------|
| **🧠 第二大脑** | Obsidian作为外部知识库，存储详细笔记 |
| **💾 备份工作区** | Obsidian Vault是OpenClaw工作区的外部备份 |

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
| all | 全部检查 |

## 调用方式

```
llm-wiki-sync compile
llm-wiki-sync lint
llm-wiki-sync sync
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
├── HEARTBEAT.md, IDENTITY.md, TOOLS.md
└── brain/
    ├── decisions/        ← 决策记录
    ├── lessons/          ← 教训记录
    ├── inbox.md          ← 收件箱
    ├── memory-task.md    ← 记忆任务
    ├── plan.md           ← 计划
    └── learned.md        ← 学到的经验
```

### Agent与Obsidian双向连接设置

#### 方案1：通过Skill配置（推荐）

```markdown
## 配置
- OBSIDIAN_ROOT: D:/obsidian知识库/我的知识库
- ROOT: C:/Users/你的用户/.openclaw/workspace
```

### 忽略的外部引用

```javascript
const IGNORED_EXTERNAL_LINKS = [
  'USER.md', 'SOUL.md', 'AGENTS.md', 'MEMORY.md'
];
```

### 必须存在的目录结构

#### Obsidian Vault（最小可用）
```
你的Obsidian Vault/
├── index.md     ← 全局目录（必须）
└── wiki/        ← 只需创建此目录，内容可为空
```

#### 如使用sync功能还需要OpenClaw brain/
```
OpenClaw工作区/
└── brain/
    ├── decisions/  ← 决策记录
    └── lessons/    ← 教训记录
```

### 配置变量（打开llm-wiki-sync.js修改）

```javascript
const CONFIG = {
  // ★ 必须修改
  OBSIDIAN_ROOT: 'D:/obsidian知识库/你的知识库',
  WIKI_DIR: 'D:/obsidian知识库/你的知识库/wiki',
  
  // 如使用sync功能也需要修改
  ROOT: 'C:/Users/你的用户/.openclaw/workspace'
};
```

### 路径格式注意
- Windows用 `/` 或 `\\`
- macOS/Linux用 `/`
- 避免空格和特殊字符

### 系统要求
- Node.js v16+
- Obsidian v1.0+（可选）
- Git（推荐，用于版本控制）

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-05-11 | 初始版本，整合compile/lint/sync/index |
| v1.1.0 | 2026-05-11 | 添加ingest/query/reindex，频率指南 |
| v1.2.0 | 2026-05-11 | 完善README，添加完整配置说明 |
| v1.3.0 | 2026-05-11 | 添加OpenClaw结构要求、双向连接设置 |
| v1.4.0 | 2026-05-11 | 强调两大定位：第二大脑+备份工作区 |

---

_最后更新: 2026-05-11_
_基于: karpathy-llm-wiki + LLM-Wiki-Template_