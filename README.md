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
git clone https://github.com/用户名/llm-wiki-sync.git
```

### 配置

编辑 `llm-wiki-sync.js`，修改CONFIG中的路径：

```javascript
const CONFIG = {
  OBSIDIAN_ROOT: 'D:/obsidian知识库/你的知识库',
  WIKI_DIR: 'D:/obsidian知识库/你的知识库/wiki',
  ROOT: 'C:/Users/你的用户/.openclaw/workspace'
};
```

### 运行

```bash
node llm-wiki-sync.js all          # 全部检查
node llm-wiki-sync.js compile      # 编译检查
node llm-wiki-sync.js lint         # 7项自检
node llm-wiki-sync.js sync         # 数据对齐
node llm-wiki-sync.js ingest       # 导入内容
node llm-wiki-sync.js query "关键词"  # 搜索回答
node llm-wiki-sync.js reindex      # 重建索引
```

## 📁 文件清单

```
llm-wiki-sync/
├── llm-wiki-sync.js   ← 核心脚本
├── SKILL.md           ← Skill定义
├── README.md          ← 本文件
└── _meta.json         ← 元数据
```

## ✅ 7项自检

| 检查项 | 说明 |
|--------|------|
| 断链 | `[[page]]` 指向不存在的文件 |
| 孤立 | wiki页面不在index.md中 |
| 短笔记 | 内容<50字符 |
| 缺失概念 | ≥3页面提到但无自己页面 |
| 过期声明 | 无`evergreen:true`且源>180天 |
| 索引漂移 | wiki/文件不在index.md中 |
| 矛盾 | 跨页面冲突声明 |

## 🔧 系统要求

- Node.js v16+
- Obsidian v1.0+（可选）
- Git（推荐）

## 📄 基于

- [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [LLM-Wiki-Template (Whitefox75)](https://github.com/Whitefox75/LLM-Wiki-Template)
- [LLM-Wiki-Template (IvanKRZ)](https://github.com/IvanKRZ/LLM-Wiki-Template)

## 📄 许可

MIT

---

_版本: v1.4.0_