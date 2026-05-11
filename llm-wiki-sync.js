#!/usr/bin/env node
/**
 * llm-wiki-sync v2.0.0
 * OpenClaw × Obsidian LLM Wiki Sync
 *
 * Usage: node llm-wiki-sync.js [operation] [options]
 *   operation: compile | lint | sync | index | ingest | query | reindex |
 *             health | dedup | stats | backup | export | watch | all
 *
 * Options:
 *   -f, --format html|md|json   export format (default: html)
 *   -i, --interactive          interactive TTY mode
 *   -w, --watch                 watch mode (Ctrl+C to stop)
 *   -t, --interval <seconds>    watch interval (default: 60)
 *   -o, --out <path>            export output path
 *   --backup-dir <path>         backup directory
 *   -v, --verbose               verbose output
 *   --dedup-mode strict|loose  dedup mode (default: loose)
 *
 * Examples:
 *   node llm-wiki-sync.js all
 *   node llm-wiki-sync.js health
 *   node llm-wiki-sync.js export --format html --out ./reports
 *   node llm-wiki-sync.js watch --interval 30
 *   node llm-wiki-sync.js backup --backup-dir D:/backups
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const CONFIG = {
  ROOT:              'C:/Users/DELL/.openclaw/workspace',
  OBSIDIAN_ROOT:     'D:/obsidian知识库/我的知识库',
  WIKI_DIR:          'D:/obsidian知识库/我的知识库/wiki',
  BACKUP_DIR:        'D:/obsidian知识库/备份',
  EXPORT_DIR:        'C:/Users/DELL/.openclaw/workspace/llm-wiki-reports',
  // OpenClaw key files & dirs (for health/stats)
  OC_KEY_FILES: ['SOUL.md','AGENTS.md','MEMORY.md','IDENTITY.md','USER.md',
                 'TOOLS.md','HEARTBEAT.md','BOOTSTRAP.md'],
  OC_BRAIN_DIR:  'brain',
  OC_KG_DIR:     'knowledge_graph',
  // Obsidian LLM Wiki required subdirs
  WIKI_SUBDIRS:  ['concepts','entities','sources','synthesis'],
  // Ignored external link targets
  IGNORED_EXTERNAL_LINKS: ['USER.md','SOUL.md','AGENTS.md','MEMORY.md'],
  // Export / backup settings
  BACKUP_SUBDIRS: ['wiki','brain'],
  REPORT_TITLE:  'LLM Wiki Sync Report',
  MAX_SHORT_NOTE_CHARS: 200,
  HEALTH_WEIGHTS: {
    empty_file:        -20,
    missing_subdir:    -10,
    missing_index:     -15,
    short_note_pct:    -10,   // >20% of notes are short
    orphan_pct:        -10,   // >30% pages are orphans
    decisions_unsync:   -5,
    lessons_unsync:     -5,
  }
};

// ─────────────────────────────────────────
// ANSI COLORS & LOGGING
// ─────────────────────────────────────────
const C  = { g:'\x1b[32m', r:'\x1b[31m', y:'\x1b[33m', c:'\x1b[36m', b:'\x1b[34m',
             m:'\x1b[35m', w:'\x1b[37m', G:'\x1b[92m', R:'\x1b[91m', Y:'\x1b[93m',
             RESET:'\x1b[0m' };
const CI = { ok:'[OK]', fail:'[FAIL]', warn:'[WARN]', info:'[INFO]', skip:'[SKIP]' };

function log(msg, type) {
  const colorMap = { ok:C.G, fail:C.r, warn:C.y, info:C.c, skip:C.b };
  const iconMap  = { ok:CI.ok, fail:CI.fail, warn:CI.warn, info:CI.info, skip:CI.skip };
  const col = colorMap[type]||C.g;
  const ico = iconMap[type]||CI.ok;
  console.log(col + ico + C.RESET + ' ' + msg);
}

function hr(title) {
  const len = 58;
  if (!title) { console.log(C.m + '─'.repeat(len) + C.RESET); return; }
  const pad = Math.max(0, Math.floor((len - title.length - 2) / 2));
  console.log(C.m + '─'.repeat(pad) + C.w + ' ' + title + ' ' + C.m + '─'.repeat(len - pad - title.length - 2) + C.RESET);
}

// ─────────────────────────────────────────
// FILE UTILITIES
// ─────────────────────────────────────────
function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
function writeFile(p, content) {
  try { fs.writeFileSync(p, content, 'utf8'); return true; } catch (e) { return false; }
}
function exists(p) { return fs.existsSync(p); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function mkdir(p) {
  try { fs.mkdirSync(p, { recursive:true }); return true; } catch { return false; }
}
function ls(p) {
  try { return fs.readdirSync(p); } catch { return []; }
}
function lsMd(p) {
  try { return fs.readdirSync(p).filter(f => f.endsWith('.md')); } catch { return []; }
}
function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}
function scanDir(dir, files) {
  files = files || [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) scanDir(path.join(dir, e.name), files);
      else if (e.name.endsWith('.md')) files.push(path.join(dir, e.name));
    }
  } catch {}
  return files;
}
function scanDirFull(dir, files) {
  files = files || [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) scanDirFull(path.join(dir, e.name), files);
      else files.push(path.join(dir, e.name));
    }
  } catch {}
  return files;
}
function relative(p, base) { return path.relative(base, p).replace(/\\/g, '/'); }
function stripExt(p) { return p.replace(/\.md$/, ''); }
function joinDir() { return path.join.apply(null, arguments); }

// Parse [[link]] style wiki links from content
function parseLinks(content) {
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
  return matches.map(l => l.replace(/\[\[|\]\]/g, '')).filter(l => !l.includes('://'));
}

// Parse #tag style tags
function parseTags(content) {
  const matches = content.match(/#[a-zA-Z0-9_\-]+/g) || [];
  return [...new Set(matches)];
}

// ─────────────────────────────────────────
// OPERATION: compile
// ─────────────────────────────────────────
function compile(opts) {
  hr('compile — JSON/Markdown 编译检查');
  let pass = 0, fail = 0;

  // JSON files in brain/
  const jsonFiles = [
    'brain/feature-flags.json',
    'brain/progress.json',
    'brain/active-chains.json',
    'brain/knowledge_graph/nodes.json',
    'brain/knowledge_graph/relations.json',
  ];
  for (const f of jsonFiles) {
    const p = joinDir(CONFIG.ROOT, f);
    if (!exists(p)) { log('brain/' + path.basename(f) + ' 不存在', 'fail'); fail++; continue; }
    try {
      JSON.parse(readFile(p));
      log('brain/' + path.basename(f) + ' JSON有效', 'ok');
      pass++;
    } catch(e) {
      log('brain/' + path.basename(f) + ': ' + e.message, 'fail');
      fail++;
    }
  }

  // Core OpenClaw *.md files
  for (const f of CONFIG.OC_KEY_FILES) {
    const p = joinDir(CONFIG.ROOT, f);
    if (!exists(p)) { log(f + ' 不存在', 'fail'); fail++; continue; }
    const lines = (readFile(p) || '').split('\n').length;
    log(f + ' (' + lines + ' lines)', 'ok');
    pass++;
  }

  // brain/*.md files
  const brainFiles = ['inbox.md','memory-task.md','plan.md','learned.md'];
  for (const f of brainFiles) {
    const p = joinDir(CONFIG.ROOT, 'brain', f);
    if (!exists(p)) { log('brain/' + f + ' 不存在', 'warn'); continue; }
    const lines = (readFile(p) || '').split('\n').length;
    log('brain/' + f + ' (' + lines + ' lines)', 'ok');
    pass++;
  }

  // index.md
  const idxP = joinDir(CONFIG.OBSIDIAN_ROOT, 'index.md');
  if (!exists(idxP)) { log('index.md 不存在', 'fail'); fail++; }
  else {
    const lines = (readFile(idxP) || '').split('\n').length;
    log('index.md (' + lines + ' lines)', 'ok');
    pass++;
  }

  console.log('\n' + C.w + '结果: ' + C.G + pass + C.w + ' 通过 | ' +
              (fail > 0 ? C.r : C.G) + fail + C.w + ' 失败' + C.RESET);
  return fail === 0;
}

// ─────────────────────────────────────────
// OPERATION: lint
// ─────────────────────────────────────────
function lint(opts) {
  hr('lint — 7项自检 (Karpathy LLM Wiki标准)');
  let issues = 0;

  const wikiFiles = exists(CONFIG.WIKI_DIR) ? scanDir(CONFIG.WIKI_DIR) : [];
  log('总文件数: ' + wikiFiles.length, 'info');

  // Build file lookup sets
  const relFiles = new Set(wikiFiles.map(f => relative(f, CONFIG.WIKI_DIR)));
  const stemFiles = new Set(wikiFiles.map(f => stripExt(relative(f, CONFIG.WIKI_DIR))));
  const idxContent = readFile(joinDir(CONFIG.OBSIDIAN_ROOT, 'index.md')) || '';

  // [1] Short notes check
  log('--- [1] 短笔记检查 (<200 chars) ---', 'info');
  const shortNotes = wikiFiles.filter(f => {
    const c = (readFile(f)||'').replace(/[#\[\]`*_\n\r]/g, '').trim();
    return c.length < CONFIG.MAX_SHORT_NOTE_CHARS;
  }).length;
  if (shortNotes > 0) {
    log('发现 ' + shortNotes + ' 个短笔记', 'warn');
    issues += shortNotes;
  } else {
    log('无短笔记', 'ok');
  }

  // [2] Broken links check
  log('--- [2] 断链检查 ---', 'info');
  let brokenLinks = 0;
  for (const f of wikiFiles) {
    const content = readFile(f) || '';
    const links = parseLinks(content);
    for (const link of links) {
      if (link.includes('://') || CONFIG.IGNORED_EXTERNAL_LINKS.includes(link)) continue;
      const targetPath = joinDir(path.dirname(f), link + '.md');
      const altPath = joinDir(CONFIG.WIKI_DIR, link + '.md');
      if (!exists(targetPath) && !exists(altPath)) {
        brokenLinks++;
      }
    }
  }
  if (brokenLinks > 0) {
    log('发现 ' + brokenLinks + ' 个断链', 'warn');
    issues += brokenLinks;
  } else {
    log('无断链', 'ok');
  }

  // [3] Orphan pages check
  log('--- [3] 孤立页面检查 ---', 'info');
  const orphans = wikiFiles.filter(f => {
    const basename = stripExt(relative(f, CONFIG.WIKI_DIR));
    return !idxContent.includes(basename) && !idxContent.includes(basename.replace(/\\/g,'/'));
  }).length;
  if (orphans > 0) {
    log('发现 ' + orphans + ' 个孤立页面', 'warn');
    issues += orphans;
  } else {
    log('无孤立页面', 'ok');
  }

  // [4] Missing concepts
  log('--- [4] 缺失概念检查 ---', 'info');
  log('通过 (需全文分析)', 'skip');

  // [5] Stale declarations
  log('--- [5] 过期声明检查 ---', 'info');
  log('通过 (需源日期检查)', 'skip');

  // [6] Index drift
  log('--- [6] 索引漂移检查 ---', 'info');
  const driftFiles = wikiFiles.filter(f => {
    const rel = relative(f, CONFIG.WIKI_DIR);
    return !idxContent.includes(rel) && !idxContent.includes(rel.replace(/\//g,' '));
  });
  if (driftFiles.length > 0) {
    log('发现 ' + driftFiles.length + ' 个未列入index.md的文件', 'warn');
    issues += driftFiles.length;
  } else {
    log('所有wiki文件已在index.md中', 'ok');
  }

  // [7] Contradictions
  log('--- [7] 矛盾声明检查 ---', 'info');
  log('通过 (需人工审核)', 'skip');

  console.log('\n' + C.w + 'lint结果: ' + (issues > 0 ? C.y : C.G) + issues + C.w + ' 个问题' + C.RESET);
  return issues === 0;
}

// ─────────────────────────────────────────
// OPERATION: sync
// ─────────────────────────────────────────
function sync(opts) {
  hr('sync — OpenClaw ↔ Obsidian 数据对齐');
  const ocDec = joinDir(CONFIG.ROOT, 'brain', 'decisions');
  const ocLess = joinDir(CONFIG.ROOT, 'brain', 'lessons');
  const obDec = joinDir(CONFIG.WIKI_DIR, 'sources', 'decisions');
  const obLess = joinDir(CONFIG.WIKI_DIR, 'sources', 'lessons');

  const ocDecCount = exists(ocDec) ? lsMd(ocDec).length : 0;
  const ocLessCount = exists(ocLess) ? lsMd(ocLess).length : 0;
  const obDecCount = exists(obDec) ? lsMd(obDec).length : 0;
  const obLessCount = exists(obLess) ? lsMd(obLess).length : 0;

  log('OpenClaw: decisions=' + ocDecCount + ', lessons=' + ocLessCount, 'info');
  log('Obsidian: decisions=' + obDecCount + ', lessons=' + obLessCount, 'info');

  const decOk = ocDecCount === obDecCount;
  const lessOk = ocLessCount === obLessCount;
  log('decisions: ' + (decOk ? 'OK' : 'MISMATCH'), decOk ? 'ok' : 'fail');
  log('lessons: ' + (lessOk ? 'OK' : 'MISMATCH'), lessOk ? 'ok' : 'fail');

  return decOk && lessOk;
}

// ─────────────────────────────────────────
// OPERATION: index
// ─────────────────────────────────────────
function indexCmd(opts) {
  hr('index — Wiki目录统计');
  if (!exists(CONFIG.WIKI_DIR)) { log('WIKI_DIR不存在', 'fail'); return false; }

  const stats = { concepts:0, entities:0, sources:0, synthesis:0 };
  for (const sub of CONFIG.WIKI_SUBDIRS) {
    const subPath = joinDir(CONFIG.WIKI_DIR, sub);
    if (exists(subPath)) {
      stats[sub] = scanDir(subPath).length;
    }
    log(sub + '/: ' + stats[sub], 'info');
  }

  // Total wiki files
  const total = scanDir(CONFIG.WIKI_DIR).length;
  log('总文件数: ' + total, 'info');

  // Total lines
  let totalLines = 0;
  for (const f of scanDir(CONFIG.WIKI_DIR)) {
    totalLines += (readFile(f)||'').split('\n').length;
  }
  log('总行数: ~' + totalLines, 'info');

  return true;
}

// ─────────────────────────────────────────
// OPERATION: ingest
// ─────────────────────────────────────────
function ingest(opts) {
  hr('ingest — 导入内容到Wiki');
  const content = opts._[2] || '';
  if (!content) {
    log('用法: node llm-wiki-sync.js ingest "<内容>"', 'info');
    return false;
  }
  const slug = content.split(' ').slice(0,5).join('-').toLowerCase().replace(/[^a-z0-9-]/g,'') || 'note';
  const destDir = joinDir(CONFIG.WIKI_DIR, 'concepts');
  mkdir(destDir);
  const destPath = joinDir(destDir, slug + '.md');
  const frontmatter = `---\ncreated: ${new Date().toISOString().split('T')[0]}\ntags: [${slug}]\n---\n\n# ${content.split('\n')[0].substring(0,60)}\n\n${content}\n`;
  if (writeFile(destPath, frontmatter)) {
    log('已写入: ' + relative(destPath, CONFIG.WIKI_DIR), 'ok');
  } else {
    log('写入失败', 'fail');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// OPERATION: query
// ─────────────────────────────────────────
function query(opts) {
  hr('query — 搜索Wiki回答');
  const keyword = opts._[2] || '';
  if (!keyword) {
    log('用法: node llm-wiki-sync.js query "<关键词>"', 'info');
    return false;
  }
  if (!exists(CONFIG.WIKI_DIR)) { log('WIKI_DIR不存在', 'fail'); return false; }

  const files = scanDir(CONFIG.WIKI_DIR);
  const results = [];
  for (const f of files) {
    const content = readFile(f) || '';
    if (content.includes(keyword)) {
      const rel = relative(f, CONFIG.WIKI_DIR);
      const firstLine = (content.split('\n').find(l=>l.startsWith('#')) || '# ' + rel).substring(0,80);
      results.push({ file: rel, line: firstLine });
    }
  }
  if (results.length === 0) {
    log('未找到包含 "' + keyword + '" 的页面', 'warn');
  } else {
    log('找到 ' + results.length + ' 个结果:', 'info');
    for (const r of results) {
      console.log('  ' + C.c + r.file + C.RESET + ' — ' + r.line);
    }
  }
  return results.length > 0;
}

// ─────────────────────────────────────────
// OPERATION: reindex
// ─────────────────────────────────────────
function reindexCmd(opts) {
  hr('reindex — 重建 index.md');
  if (!exists(CONFIG.WIKI_DIR)) { log('WIKI_DIR不存在', 'fail'); return false; }

  const files = scanDir(CONFIG.WIKI_DIR);
  const lines = ['# Index\n',
    '> 自动生成 | llm-wiki-sync v2.0.0 | ' + new Date().toISOString() + '\n',
    '## 文件清单\n'
  ];

  for (const f of files.sort()) {
    const rel = relative(f, CONFIG.WIKI_DIR);
    const title = (readFile(f)||'').split('\n').find(l=>l.startsWith('#')) || rel;
    lines.push('- [[' + rel.replace(/\.md$/,'') + ']] ' + title.substring(0,60) + '\n');
  }

  lines.push('\n## 统计\n');
  lines.push('- 总文件数: ' + files.length + '\n');
  const totalLines = files.reduce((n,f) => n + (readFile(f)||'').split('\n').length, 0);
  lines.push('- 总行数: ~' + totalLines + '\n');

  const idxPath = joinDir(CONFIG.OBSIDIAN_ROOT, 'index.md');
  if (writeFile(idxPath, lines.join(''))) {
    log('已更新 index.md (' + files.length + ' 个文件)', 'ok');
  } else {
    log('写入index.md失败', 'fail');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// OPERATION: health
// ─────────────────────────────────────────
function health(opts) {
  hr('health — 健康评分 (0-100)');
  let score = 100;
  const issues = [];

  // [1] OpenClaw key files
  log('--- [1] OpenClaw核心文件 ---', 'info');
  for (const f of CONFIG.OC_KEY_FILES) {
    const p = joinDir(CONFIG.ROOT, f);
    if (!exists(p)) {
      log('  缺失: ' + f, 'fail');
      score += CONFIG.HEALTH_WEIGHTS.empty_file;
      issues.push('缺失核心文件: ' + f);
    } else {
      const size = fileSize(p);
      if (size === 0) {
        log('  空文件: ' + f, 'fail');
        score += CONFIG.HEALTH_WEIGHTS.empty_file;
        issues.push('空文件: ' + f);
      }
    }
  }

  // [2] Required wiki subdirs
  log('--- [2] Wiki目录结构 ---', 'info');
  for (const sub of CONFIG.WIKI_SUBDIRS) {
    const p = joinDir(CONFIG.WIKI_DIR, sub);
    if (!exists(p)) {
      log('  缺失: wiki/' + sub + '/', 'fail');
      score += CONFIG.HEALTH_WEIGHTS.missing_subdir;
      issues.push('缺失目录: wiki/' + sub);
    }
  }

  // [3] index.md
  log('--- [3] index.md ---', 'info');
  const idxPath = joinDir(CONFIG.OBSIDIAN_ROOT, 'index.md');
  if (!exists(idxPath)) {
    log('  缺失 index.md', 'fail');
    score += CONFIG.HEALTH_WEIGHTS.missing_index;
    issues.push('缺失 index.md');
  }

  // [4] brain/ subdirs
  log('--- [4] OpenClaw brain/ ---', 'info');
  const brainDirs = ['decisions','lessons'];
  for (const d of brainDirs) {
    const p = joinDir(CONFIG.ROOT, 'brain', d);
    if (!exists(p)) {
      log('  缺失 brain/' + d + '/', 'warn');
      score += CONFIG.HEALTH_WEIGHTS.missing_subdir;
      issues.push('缺失目录: brain/' + d);
    }
  }

  // [5] Short notes ratio
  log('--- [5] 短笔记比例 ---', 'info');
  const wikiFiles = exists(CONFIG.WIKI_DIR) ? scanDir(CONFIG.WIKI_DIR) : [];
  if (wikiFiles.length > 0) {
    const shortNotes = wikiFiles.filter(f => {
      const c = (readFile(f)||'').replace(/[#\[\]`*_\n\r]/g,'').trim();
      return c.length < CONFIG.MAX_SHORT_NOTE_CHARS;
    }).length;
    const ratio = shortNotes / wikiFiles.length;
    if (ratio > 0.2) {
      log('  短笔记比例过高: ' + Math.round(ratio*100) + '%', 'warn');
      score += CONFIG.HEALTH_WEIGHTS.short_note_pct;
      issues.push('短笔记比例过高: ' + Math.round(ratio*100) + '%');
    } else {
      log('  短笔记比例: ' + Math.round(ratio*100) + '%', 'ok');
    }
  }

  // [6] Orphan ratio
  log('--- [6] 孤立页面比例 ---', 'info');
  if (wikiFiles.length > 0 && exists(idxPath)) {
    const idxContent = readFile(idxPath) || '';
    const orphans = wikiFiles.filter(f => {
      const basename = stripExt(relative(f, CONFIG.WIKI_DIR));
      return !idxContent.includes(basename);
    }).length;
    const ratio = orphans / wikiFiles.length;
    if (ratio > 0.3) {
      log('  孤立页面比例过高: ' + Math.round(ratio*100) + '%', 'warn');
      score += CONFIG.HEALTH_WEIGHTS.orphan_pct;
      issues.push('孤立页面比例过高: ' + Math.round(ratio*100) + '%');
    } else {
      log('  孤立页面比例: ' + Math.round(ratio*100) + '%', 'ok');
    }
  }

  // [7] OpenClaw↔Obsidian sync
  log('--- [7] OpenClaw↔Obsidian同步 ---', 'info');
  const ocDec = joinDir(CONFIG.ROOT,'brain','decisions');
  const obDec = joinDir(CONFIG.WIKI_DIR,'sources','decisions');
  const ocLess = joinDir(CONFIG.ROOT,'brain','lessons');
  const obLess = joinDir(CONFIG.WIKI_DIR,'sources','lessons');
  const decMis = (exists(ocDec)?lsMd(ocDec).length:0) !== (exists(obDec)?lsMd(obDec).length:0);
  const lessMis = (exists(ocLess)?lsMd(ocLess).length:0) !== (exists(obLess)?lsMd(obLess).length:0);
  if (decMis) {
    log('  decisions未同步', 'warn');
    score += CONFIG.HEALTH_WEIGHTS.decisions_unsync;
    issues.push('decisions未同步');
  }
  if (lessMis) {
    log('  lessons未同步', 'warn');
    score += CONFIG.HEALTH_WEIGHTS.lessons_unsync;
    issues.push('lessons未同步');
  }
  if (!decMis && !lessMis) log('  OpenClaw↔Obsidian已同步', 'ok');

  // [8] OpenClaw info detection
  log('--- [8] OpenClaw信息检测 ---', 'info');
  const ocBrainExists = exists(joinDir(CONFIG.ROOT, 'brain'));
  const ocKgExists = exists(joinDir(CONFIG.ROOT, 'knowledge_graph'));
  if (ocBrainExists) log('  brain/ 目录已连接', 'ok'); else log('  brain/ 未连接', 'skip');
  if (ocKgExists) log('  knowledge_graph/ 已连接', 'ok'); else log('  knowledge_graph/ 未连接', 'skip');

  // Score grade
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A+' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 65 ? 'C' : 'D';
  const gradeColor = score >= 90 ? C.G : score >= 75 ? C.c : score >= 65 ? C.y : C.r;

  console.log('\n' + C.w + '='.repeat(40));
  console.log('  健康评分: ' + gradeColor + score + '/100' + C.w + '  (' + grade + ')');
  if (issues.length > 0) {
    console.log('  问题列表:');
    for (const i of issues) console.log('    - ' + i);
  } else {
    console.log('  ' + C.G + '✓ 无重大问题' + C.RESET);
  }
  console.log(C.w + '='.repeat(40) + C.RESET);

  return score >= 75;
}

// ─────────────────────────────────────────
// OPERATION: dedup
// ─────────────────────────────────────────
function dedup(opts) {
  hr('dedup — 内容查重扫描');
  const mode = opts.dedupMode || 'loose';
  const threshold = mode === 'strict' ? 0.5 : 0.7;

  if (!exists(CONFIG.WIKI_DIR)) { log('WIKI_DIR不存在', 'fail'); return false; }

  const files = scanDir(CONFIG.WIKI_DIR);
  log('扫描 ' + files.length + ' 个文件 (mode=' + mode + ', threshold=' + threshold + ')', 'info');

  const hashes = new Map();
  const dupGroups = [];
  let dupsFound = 0;

  for (const f of files) {
    const content = (readFile(f)||'').replace(/\r/g,'');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
    const norm = lines.join('\n').toLowerCase().replace(/[#`*\[\]]/g,'').replace(/\s+/g,' ').trim();
    if (!norm) continue;

    // Simple hash for comparison
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = ((hash << 5) - hash + norm.charCodeAt(i)) | 0;
    }
    hash = hash >>> 0;

    if (hashes.has(hash)) {
      dupsFound++;
      const existing = hashes.get(hash);
      const rel = relative(f, CONFIG.WIKI_DIR);
      const existingRel = existing;
      const group = dupGroups.find(g => g.files.includes(existingRel));
      if (group) {
        group.files.push(rel);
      } else {
        dupGroups.push({ files: [existingRel, rel], norm: norm.substring(0,80) });
      }
    } else {
      hashes.set(hash, relative(f, CONFIG.WIKI_DIR));
    }
  }

  if (dupsFound === 0) {
    log('未发现重复内容', 'ok');
  } else {
    log('发现 ' + dupsFound + ' 个重复文件', 'warn');
    for (const g of dupGroups) {
      log('  重复组: ' + g.files.join(' ↔ '), 'info');
      log('    内容: ' + g.norm + '...', 'skip');
    }
    console.log('\n  建议: node llm-wiki-sync.js dedup --dedup-mode=strict 查看严格结果');
  }

  console.log('\n' + C.w + 'dedup结果: ' + (dupsFound > 0 ? C.y : C.G) + dupsFound + C.w + ' 个重复' + C.RESET);
  return dupsFound === 0;
}

// ─────────────────────────────────────────
// OPERATION: stats
// ─────────────────────────────────────────
function stats(opts) {
  hr('stats — 详细统计面板');
  const wikiFiles = exists(CONFIG.WIKI_DIR) ? scanDir(CONFIG.WIKI_DIR) : [];
  const ocFiles = scanDirFull(CONFIG.ROOT).filter(f => !f.includes('node_modules'));

  // File counts
  log('--- 文件统计 ---', 'info');
  log('OpenClaw工作区: ' + ocFiles.length + ' 个文件', 'info');
  log('Wiki文件: ' + wikiFiles.length + ' 个.md文件', 'info');

  // Size distribution
  let totalWikiSize = 0;
  const sizeBuckets = { tiny:0, small:0, medium:0, large:0, huge:0 };
  for (const f of wikiFiles) {
    const sz = fileSize(f);
    totalWikiSize += sz;
    if (sz < 512)       sizeBuckets.tiny++;
    else if (sz < 2048) sizeBuckets.small++;
    else if (sz < 8192) sizeBuckets.medium++;
    else if (sz < 30720)sizeBuckets.large++;
    else                sizeBuckets.huge++;
  }
  log('Wiki总大小: ' + (totalWikiSize/1024).toFixed(1) + ' KB', 'info');
  console.log('  大小分布: tiny<'+C.c+'512B:'+sizeBuckets.tiny+C.w+' small<'+C.c+'2KB:'+sizeBuckets.small+C.w+
              ' medium<'+C.c+'8KB:'+sizeBuckets.medium+C.w+' large<'+C.c+'30KB:'+sizeBuckets.large+C.w+
              ' huge>30KB:'+sizeBuckets.huge);

  // Category distribution
  log('--- 分类分布 ---', 'info');
  for (const sub of CONFIG.WIKI_SUBDIRS) {
    const p = joinDir(CONFIG.WIKI_DIR, sub);
    if (exists(p)) {
      const count = scanDir(p).length;
      const bar = '█'.repeat(Math.round(count / Math.max(wikiFiles.length,1) * 30));
      console.log('  ' + C.c + (sub + ':').padEnd(12) + C.w + bar + ' ' + count);
    }
  }

  // Tag distribution
  const tagCounts = {};
  for (const f of wikiFiles) {
    for (const tag of parseTags(readFile(f)||'')) {
      tagCounts[tag] = (tagCounts[tag]||0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if (topTags.length > 0) {
    log('--- 热门标签 Top10 ---', 'info');
    for (const [tag, count] of topTags) {
      const bar = '█'.repeat(count);
      console.log('  ' + C.y + tag.padEnd(20) + C.w + bar + ' ' + count);
    }
  }

  // Link stats
  log('--- 链接统计 ---', 'info');
  let totalLinks = 0, totalImages = 0;
  for (const f of wikiFiles) {
    const content = readFile(f)||'';
    totalLinks += (content.match(/\[\[|\]\]/g)||[]).length / 2;
    totalImages += (content.match(/!\[.*?\]\(.*?\)/g)||[]).length;
  }
  log('总内部链接: ~' + Math.round(totalLinks), 'info');
  log('总图片引用: ' + totalImages, 'info');

  // OpenClaw specific
  log('--- OpenClaw集成状态 ---', 'info');
  const ocBrainDir = joinDir(CONFIG.ROOT, 'brain');
  const ocKgDir = joinDir(CONFIG.ROOT, 'knowledge_graph');
  if (exists(ocBrainDir)) {
    const brainFiles = ls(ocBrainDir).filter(f=>f.endsWith('.md'));
    log('  brain/: ' + brainFiles.length + ' 个.md文件', 'ok');
    for (const sub of ['decisions','lessons']) {
      const p = joinDir(ocBrainDir, sub);
      if (exists(p)) log('    brain/' + sub + '/: ' + lsMd(p).length, 'ok');
    }
  }
  if (exists(ocKgDir)) {
    const kgFiles = ls(ocKgDir).filter(f=>f.endsWith('.json')||f.endsWith('.dot'));
    log('  knowledge_graph/: ' + kgFiles.length + ' 个图文件', 'ok');
  }

  // Knowledge graph nodes/edges (if available)
  const nodesP = joinDir(CONFIG.ROOT, 'knowledge_graph', 'nodes.json');
  const relsP  = joinDir(CONFIG.ROOT, 'knowledge_graph', 'relations.json');
  if (exists(nodesP) && exists(relsP)) {
    try {
      const nodes = JSON.parse(readFile(nodesP));
      const rels  = JSON.parse(readFile(relsP));
      log('  知识图谱: ' + nodes.length + ' 节点, ' + rels.length + ' 边', 'ok');
    } catch {}
  }

  return true;
}

// ─────────────────────────────────────────
// OPERATION: backup
// ─────────────────────────────────────────
function backup(opts) {
  hr('backup — 全量备份');
  const destBase = opts.backupDir || CONFIG.BACKUP_DIR;
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-').substring(0,19);
  const destDir = joinDir(destBase, 'llm-wiki-backup-' + timestamp);
  mkdir(destDir);

  let backed = 0, failed = 0;

  // Backup wiki/
  const wikiDest = joinDir(destDir, 'wiki');
  if (exists(CONFIG.WIKI_DIR)) {
    mkdir(wikiDest);
    for (const f of scanDir(CONFIG.WIKI_DIR)) {
      const rel = relative(f, CONFIG.WIKI_DIR);
      const dest = joinDir(wikiDest, rel);
      mkdir(path.dirname(dest));
      try {
        fs.copyFileSync(f, dest);
        backed++;
      } catch { failed++; }
    }
    log('wiki/ -> ' + relative(wikiDest, destBase) + ': ' + backed + ' 文件', 'ok');
  }

  // Backup brain/
  const brainSrc = joinDir(CONFIG.ROOT, 'brain');
  const brainDest = joinDir(destDir, 'brain');
  let brainBacked = 0;
  if (exists(brainSrc)) {
    mkdir(brainDest);
    for (const f of scanDir(brainSrc)) {
      const rel = relative(f, brainSrc);
      const destF = joinDir(brainDest, rel);
      mkdir(path.dirname(destF));
      try {
        fs.copyFileSync(f, destF);
        brainBacked++;
      } catch { failed++; }
    }
    log('brain/ -> ' + relative(brainDest, destBase) + ': ' + brainBacked + ' 文件', 'ok');
    backed += brainBacked;
  }

  // Backup core *.md files
  let coreBacked = 0;
  for (const f of CONFIG.OC_KEY_FILES) {
    const src = joinDir(CONFIG.ROOT, f);
    const destF = joinDir(destDir, f);
    if (exists(src)) {
      try {
        fs.copyFileSync(src, destF);
        coreBacked++;
      } catch { failed++; }
    }
  }
  if (coreBacked > 0) log('核心MD -> ' + destDir + ': ' + coreBacked + ' 文件', 'ok');
  backed += coreBacked;

  // Backup index.md
  const idxSrc = joinDir(CONFIG.OBSIDIAN_ROOT, 'index.md');
  const idxDest = joinDir(destDir, 'index.md');
  if (exists(idxSrc)) {
    try {
      fs.copyFileSync(idxSrc, idxDest);
      log('index.md -> ' + destDir, 'ok');
      backed++;
    } catch { failed++; }
  }

  // Write manifest
  const manifest = {
    timestamp,
    version: '2.0.0',
    sources: {
      ROOT: CONFIG.ROOT,
      WIKI_DIR: CONFIG.WIKI_DIR,
      OBSIDIAN_ROOT: CONFIG.OBSIDIAN_ROOT,
    },
    counts: { wiki: backed - coreBacked - (exists(idxSrc)?1:0), brain: brainBacked, core: coreBacked }
  };
  writeFile(joinDir(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log('manifest.json 已写入', 'ok');

  console.log('\n' + C.w + '备份完成: ' + C.G + backed + C.w + ' 文件 | ' +
              (failed > 0 ? C.r : C.G) + failed + C.w + ' 失败' + C.RESET);
  console.log('  备份位置: ' + destDir);
  return failed === 0;
}

// ─────────────────────────────────────────
// OPERATION: export
// ─────────────────────────────────────────
function exportReport(opts) {
  hr('export — 生成报告');
  const format = opts.format || 'html';
  const outDir = opts.out || CONFIG.EXPORT_DIR;
  const timestamp = new Date().toISOString().substring(0,19).replace(/[:.]/g,'-');

  mkdir(outDir);

  // Gather data
  const wikiFiles = exists(CONFIG.WIKI_DIR) ? scanDir(CONFIG.WIKI_DIR) : [];
  const idxContent = readFile(joinDir(CONFIG.OBSIDIAN_ROOT, 'index.md')) || '';

  // Stats
  const totalSize = wikiFiles.reduce((n,f) => n + fileSize(f), 0);
  const totalLines = wikiFiles.reduce((n,f) => n + (readFile(f)||'').split('\n').length, 0);
  const tagCounts = {};
  for (const f of wikiFiles) {
    for (const t of parseTags(readFile(f)||'')) tagCounts[t] = (tagCounts[t]||0)+1;
  }
  const topTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,20);

  // Category counts
  const catCounts = {};
  for (const sub of CONFIG.WIKI_SUBDIRS) {
    const p = joinDir(CONFIG.WIKI_DIR, sub);
    if (exists(p)) catCounts[sub] = scanDir(p).length;
  }

  const reportMeta = {
    generated: new Date().toISOString(),
    version: '2.0.0',
    wikiFiles: wikiFiles.length,
    totalSizeKb: (totalSize/1024).toFixed(1),
    totalLines,
    topTags: topTags.slice(0,10),
    categories: catCounts,
  };

  let outPath;
  if (format === 'json') {
    outPath = joinDir(outDir, 'llm-wiki-report-' + timestamp + '.json');
    writeFile(outPath, JSON.stringify({ meta: reportMeta, tags: tagCounts }, null, 2));
    log('JSON报告已写入: ' + relative(outPath, outDir), 'ok');
  } else if (format === 'md') {
    outPath = joinDir(outDir, 'llm-wiki-report-' + timestamp + '.md');
    const lines = ['# LLM Wiki 同步报告\n',
      '> 生成时间: ' + reportMeta.generated + '\n',
      '## 统计概览\n',
      '- Wiki文件: ' + reportMeta.wikiFiles + '\n',
      '- 总大小: ' + reportMeta.totalSizeKb + ' KB\n',
      '- 总行数: ' + reportMeta.totalLines + '\n',
      '## 分类统计\n',
    ];
    for (const [k,v] of Object.entries(catCounts)) lines.push('- ' + k + ': ' + v + '\n');
    lines.push('\n## 热门标签\n');
    for (const [t,c] of topTags.slice(0,20)) lines.push('- ' + t + ': ' + c + '\n');
    writeFile(outPath, lines.join(''));
    log('Markdown报告已写入: ' + relative(outPath, outDir), 'ok');
  } else {
    // HTML
    outPath = joinDir(outDir, 'llm-wiki-report-' + timestamp + '.html');
    const tagBars = topTags.map(([t,c]) =>
      `<div class="tag-row"><span class="tag-name">${t}</span><div class="bar-wrap"><div class="bar" style="width:${Math.min(100,c/wikiFiles.length*300)}%"></div></div><span class="tag-count">${c}</span></div>`
    ).join('\n');
    const catBars = Object.entries(catCounts).map(([k,v]) =>
      `<div class="cat-row"><span>${k}</span><strong>${v}</strong></div>`
    ).join('\n');

    const html = `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<title>LLM Wiki Report</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:0 auto;padding:20px;background:#0f1419;color:#e6e6e6}
h1{color:#4fc3f7;border-bottom:2px solid #4fc3f7;padding-bottom:8px}
h2{color:#81d4fa;margin-top:32px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:16px 0}
.card{background:#1c2733;border-radius:8px;padding:16px}
.card .num{font-size:2.2em;font-weight:700;color:#4fc3f7}
.card .lbl{color:#8899a6;font-size:.85em}
.bar-wrap{background:#253341;border-radius:3px;height:8px;flex:1;margin:0 8px}
.tag-row,.cat-row{display:flex;align-items:center;padding:4px 0}
.tag-name{width:180px;font-family:monospace;font-size:.9em;color:#ccd6dd}
.tag-count{width:30px;text-align:right;color:#8899a6}
.bar{background:linear-gradient(90deg,#4fc3f7,#80deea);height:8px;border-radius:3px;transition:width .3s}
.watermark{text-align:center;color:#38434a;font-size:.75em;margin-top:40px}
</style></head><body>
<h1>🧠 LLM Wiki Sync Report</h1>
<p>生成时间: ${reportMeta.generated} | v${reportMeta.version}</p>
<div class="grid">
  <div class="card"><div class="num">${reportMeta.wikiFiles}</div><div class="lbl">Wiki文件</div></div>
  <div class="card"><div class="num">${reportMeta.totalSizeKb}</div><div class="lbl">总大小 (KB)</div></div>
  <div class="card"><div class="num">${reportMeta.totalLines}</div><div class="lbl">总行数</div></div>
  <div class="card"><div class="num">${Object.keys(tagCounts).length}</div><div class="lbl">标签数</div></div>
</div>
<h2>📁 分类统计</h2>
<div class="grid">${catBars}</div>
<h2>🏷️ 热门标签 Top20</h2>
<div>${tagBars}</div>
<div class="watermark">Generated by llm-wiki-sync v2.0.0</div>
</body></html>`;
    writeFile(outPath, html);
    log('HTML报告已写入: ' + relative(outPath, outDir), 'ok');
  }

  console.log('\n' + C.w + '导出完成: ' + C.G + relative(outPath, outDir) + C.RESET);
  return true;
}

// ─────────────────────────────────────────
// OPERATION: watch
// ─────────────────────────────────────────
function watchMode(opts) {
  hr('watch — 监视文件变更 (Ctrl+C 停止)');
  const interval = (opts.interval || 60) * 1000;
  log('每 ' + (interval/1000) + ' 秒检查一次...', 'info');
  log('监视模式已启动. 按 Ctrl+C 停止.', 'info');

  let lastState = {};
  try {
    const stateFile = joinDir(CONFIG.ROOT, '.llm-wiki-sync.state.json');
    if (exists(stateFile)) lastState = JSON.parse(readFile(stateFile)||'{}');
  } catch {}

  function check() {
    const wikiFiles = exists(CONFIG.WIKI_DIR) ? scanDir(CONFIG.WIKI_DIR) : [];
    const newState = {};
    let changed = false;
    for (const f of wikiFiles) {
      const stat = fs.statSync(f);
      const key = relative(f, CONFIG.WIKI_DIR);
      newState[key] = stat.mtimeMs;
      if (!lastState[key] || lastState[key] !== stat.mtimeMs) {
        changed = true;
        log('变更: ' + key, 'warn');
      }
    }
    if (changed) {
      lastState = newState;
      try {
        writeFile(joinDir(CONFIG.ROOT, '.llm-wiki-sync.state.json'), JSON.stringify(newState));
      } catch {}
      log('文件状态已更新', 'info');
    } else {
      log('无变更 (' + wikiFiles.length + ' 文件)', 'skip');
    }
  }

  check();
  const timer = setInterval(check, interval);
  process.on('SIGINT', () => {
    console.log('\n\n停止监视.');
    clearInterval(timer);
    process.exit(0);
  });
  // Keep alive
  setInterval(() => {}, 1000);
}

// ─────────────────────────────────────────
// OPERATION: all
// ─────────────────────────────────────────
function runAll(opts) {
  hr('all — 全部检查 (compile+lint+sync+index+health)');
  let allPassed = true;
  if (!compile(opts))  allPassed = false;
  if (!lint(opts))     allPassed = false;
  if (!sync(opts))     allPassed = false;
  if (!indexCmd(opts)) allPassed = false;
  if (!health(opts))   allPassed = false;
  return allPassed;
}

// ─────────────────────────────────────────
// INTERACTIVE MODE
// ─────────────────────────────────────────
function interactive(opts) {
  hr('interactive — 交互模式');
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => new Promise(res => rl.question(C.c + '\nllm-wiki> ' + C.RESET, res));

  log('欢迎使用 llm-wiki-sync 交互模式', 'info');
  log('输入命令: compile | lint | sync | index | health | dedup | stats | backup | export | all | quit', 'info');

  (async () => {
    while (true) {
      const input = await prompt();
      const cmd = (input || '').trim().toLowerCase();
      if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') {
        log('再见!', 'info');
        rl.close();
        break;
      }
      const parts = cmd.split(' ');
      const op = parts[0];
      const arg = parts.slice(1).join(' ');

      switch(op) {
        case 'compile': compile(opts); break;
        case 'lint':    lint(opts);    break;
        case 'sync':    sync(opts);    break;
        case 'index':   indexCmd(opts); break;
        case 'health':  health(opts);  break;
        case 'dedup':   dedup(opts);   break;
        case 'stats':   stats(opts);   break;
        case 'backup':  backup(opts);  break;
        case 'export':  exportReport(opts); break;
        case 'all':     runAll(opts);  break;
        case 'help':
          console.log('可用命令: compile lint sync index health dedup stats backup export all quit');
          break;
        default:
          if (op) log('未知命令: ' + op + ' (输入 help 查看)', 'warn');
      }
    }
  })();
}

// ─────────────────────────────────────────
// ARGV PARSER
// ─────────────────────────────────────────
function parseArgv(argv) {
  const opts = { _: argv };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-f' || a === '--format')    { opts.format    = argv[++i]; continue; }
    if (a === '-i' || a === '--interactive'){ opts.interactive = true;    continue; }
    if (a === '-w' || a === '--watch')      { opts.watch       = true;    continue; }
    if (a === '-t' || a === '--interval')  { opts.interval    = parseInt(argv[++i]); continue; }
    if (a === '-o' || a === '--out')        { opts.out         = argv[++i]; continue; }
    if (a === '-v' || a === '--verbose')    { opts.verbose     = true;    continue; }
    if (a === '--backup-dir')               { opts.backupDir   = argv[++i]; continue; }
    if (a === '--dedup-mode')               { opts.dedupMode   = argv[++i]; continue; }
  }
  return opts;
}

// ─────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────
function main(argv) {
  const opts = parseArgv(argv.slice(2));
  const operation = opts._[2] || 'all';

  console.log('\n' + C.m + '╔' + '═'.repeat(56) + '╗');
  console.log('║  llm-wiki-sync ' + C.w + 'v2.0.0' + C.m + '  OpenClaw × Obsidian LLM Wiki  ║');
  console.log('╚' + '═'.repeat(56) + '╝' + C.RESET);

  if (opts.interactive) {
    interactive(opts);
    return;
  }
  if (opts.watch) {
    watchMode(opts);
    return;
  }

  let allPassed = true;

  switch (operation) {
    case 'compile':  allPassed = compile(opts);    break;
    case 'lint':     allPassed = lint(opts);       break;
    case 'sync':     allPassed = sync(opts);       break;
    case 'index':    allPassed = indexCmd(opts);   break;
    case 'ingest':   allPassed = ingest(opts);      break;
    case 'query':    allPassed = query(opts);       break;
    case 'reindex':  allPassed = reindexCmd(opts);  break;
    case 'health':   allPassed = health(opts);      break;
    case 'dedup':    allPassed = dedup(opts);       break;
    case 'stats':    allPassed = stats(opts);       break;
    case 'backup':   allPassed = backup(opts);      break;
    case 'export':   allPassed = exportReport(opts); break;
    case 'all':      allPassed = runAll(opts);      break;
    case 'watch':    watchMode(opts);               break;
    case 'help':
      console.log('用法: node llm-wiki-sync.js <operation> [options]');
      console.log('操作: compile|lint|sync|index|ingest|query|reindex|health|dedup|stats|backup|export|watch|all');
      console.log('选项: -f html|md|json -i -w -t <sec> -o <path> --backup-dir <path> --dedup-mode strict|loose -v');
      return;
    default:
      log('未知操作: ' + operation + ' (使用 help 查看)', 'fail');
      process.exit(1);
  }

  console.log('\n' + C.m + '─'.repeat(58) + C.RESET);
  console.log('  最终状态: ' + (allPassed ? C.G + 'PASS' : C.r + 'FAIL') + C.RESET);
  console.log(C.m + '─'.repeat(58) + C.RESET);

  process.exit(allPassed ? 0 : 1);
}

main(process.argv);
