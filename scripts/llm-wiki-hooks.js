#!/usr/bin/env node
/**
 * llm-wiki-sync hooks installer
 * 
 * Install Git hooks that run before git push to ensure wiki quality:
 *   - compile: JSON/Markdown compilation check
 *   - lint:    7-point self-check
 * 
 * Usage:
 *   node scripts/llm-wiki-hooks.js install   # Install hooks
 *   node scripts/llm-wiki-hooks.js uninstall # Remove hooks
 *   node scripts/llm-wiki-hooks.js run       # Run hooks manually
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOOKS_DIR = path.join(__dirname, '..', '.git', 'hooks');
const PRE_PUSH_HOOK = path.join(HOOKS_DIR, 'pre-push');
const SCRIPT_DIR = path.join(__dirname);

function log(msg) { console.log('[hooks] ' + msg); }

const PRE_PUSH_CONTENT = `#!/bin/sh
# llm-wiki-sync pre-push hook
# Automatically runs compile + lint before git push

node scripts/llm-wiki-hooks.js run || {
  echo "Hook failed: fix issues before pushing"
  exit 1
}
`;

const WINDOWS_PRE_PUSH_CONTENT = `@echo off
REM llm-wiki-sync pre-push hook
node scripts\\llm-wiki-hooks.js run
if errorlevel 1 (
  echo Hook failed: fix issues before pushing
  exit /b 1
)
`;

function install() {
  try {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
  } catch {}

  const isWindows = process.platform === 'win32';
  const content = isWindows ? WINDOWS_PRE_PUSH_CONTENT : PRE_PUSH_CONTENT;
  const hookPath = PRE_PUSH_HOOK + (isWindows ? '.bat' : '');

  fs.writeFileSync(hookPath, content, isWindows ? 'utf8' : 'utf8');
  if (!isWindows) {
    try { fs.chmodSync(hookPath, 0o755); } catch {}
  }
  log('Installed pre-push hook: ' + path.basename(hookPath));
  log('Run "node llm-wiki-sync.js all" locally before pushing to avoid CI failures');
}

function uninstall() {
  const isWindows = process.platform === 'win32';
  const hookPath = PRE_PUSH_HOOK + (isWindows ? '.bat' : '');
  try {
    fs.unlinkSync(hookPath);
    log('Removed pre-push hook');
  } catch {
    log('No hook found to remove');
  }
}

function runHooks() {
  const rootDir = path.join(SCRIPT_DIR, '..');
  process.chdir(rootDir);

  log('Running pre-push checks...');
  let failed = false;

  // Run compile
  try {
    log('Running compile...');
    execSync('node llm-wiki-sync.js compile', { stdio: 'inherit', cwd: rootDir });
    log('compile: PASS');
  } catch {
    log('compile: FAIL');
    failed = true;
  }

  // Run lint
  try {
    log('Running lint...');
    execSync('node llm-wiki-sync.js lint', { stdio: 'inherit', cwd: rootDir });
    log('lint: PASS');
  } catch {
    log('lint: FAIL');
    failed = true;
  }

  if (failed) {
    log('Pre-push checks FAILED');
    process.exit(1);
  }

  log('Pre-push checks PASSED');
  process.exit(0);
}

const cmd = process.argv[2];
switch (cmd) {
  case 'install':   install();   break;
  case 'uninstall': uninstall(); break;
  case 'run':       runHooks();  break;
  default:
    console.log('Usage: node llm-wiki-hooks.js install|uninstall|run');
}
