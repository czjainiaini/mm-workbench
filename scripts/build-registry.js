/* 全位置样式注册表生成器
 * 读取仓库内可追踪的基础规范 src/style-registry.base.json，
 * 合并实点补丁 src/live-patch.json，确定性生成 src/style-registry.js。
 *
 * 运行：node scripts/build-registry.js
 * 校验：node scripts/build-registry.js --check
 * 维护者一次性迁移旧生成物：node scripts/build-registry.js --capture-base
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const BASE_FILE = path.join(ROOT, 'src', 'style-registry.base.json');
const PATCH_FILE = path.join(ROOT, 'src', 'live-patch.json');
const OUTPUT_FILE = path.join(ROOT, 'src', 'style-registry.js');
const args = new Set(process.argv.slice(2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function captureBase() {
  const source = fs.readFileSync(OUTPUT_FILE, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: OUTPUT_FILE });
  const registry = sandbox.window.MM_REGISTRY;
  if (!registry || !Array.isArray(registry.entries)) throw new Error('现有 style-registry.js 不含有效 MM_REGISTRY');
  const entries = registry.entries.filter((entry) => /^r\d+$/.test(String(entry.id || '')));
  if (!entries.length) throw new Error('现有 style-registry.js 不含可迁移的基础条目');
  const payload = {
    version: 1,
    note: '仓库内可复现的基础样式规范；live-patch.json 在生成时继续合并。',
    entries
  };
  fs.writeFileSync(BASE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('已捕获基础规范:', entries.length, '条 →', path.relative(ROOT, BASE_FILE));
}

function validateEntry(entry, sourceName) {
  if (!entry || typeof entry !== 'object') throw new Error(sourceName + ' 含非对象条目');
  if (!String(entry.selector || '').trim()) throw new Error(sourceName + ' 含空 selector');
  if (!entry.props || typeof entry.props !== 'object' || Array.isArray(entry.props)) throw new Error(sourceName + ' 的 props 无效: ' + entry.selector);
}

function buildRegistry() {
  const base = readJson(BASE_FILE);
  if (!base || !Array.isArray(base.entries) || !base.entries.length) throw new Error('style-registry.base.json 缺少 entries');
  const entries = JSON.parse(JSON.stringify(base.entries));
  const seen = new Set();
  entries.forEach((entry, index) => {
    validateEntry(entry, '基础规范');
    if (seen.has(entry.selector)) throw new Error('基础规范 selector 重复: ' + entry.selector);
    seen.add(entry.selector);
    entry.id = 'r' + (index + 1);
    entry.name = String(entry.name || entry.selector.split(',')[0]).slice(0, 46);
    entry.group = String(entry.group || '其他');
    entry.literals = entry.literals && typeof entry.literals === 'object' ? entry.literals : {};
  });

  const patch = readJson(PATCH_FILE);
  if (!Array.isArray(patch)) throw new Error('live-patch.json 必须是数组');
  let merged = 0;
  let added = 0;
  patch.forEach((item) => {
    validateEntry(item, '实点补丁');
    const existing = entries.find((entry) => entry.selector === item.selector);
    if (existing) {
      Object.assign(existing.props, item.props || {});
      if (item.literals) Object.assign(existing.literals, item.literals);
      merged++;
      return;
    }
    added++;
    entries.push({
      id: 'p' + (entries.length + 1),
      name: String(item.name || item.selector.split(',')[0]).slice(0, 46),
      selector: item.selector,
      group: item.group || '其他',
      props: Object.assign({}, item.props || {}),
      literals: Object.assign({}, item.literals || {})
    });
  });

  const groups = {};
  entries.forEach((entry) => { groups[entry.group] = (groups[entry.group] || 0) + 1; });
  const output = `/* 全位置样式注册表（自动生成，勿手改；重新生成：node scripts/build-registry.js）
 * 共 ${entries.length} 条 / ${Object.keys(groups).length} 组
 * props 值为调色板角色：bg/surface/accent/accentSoft/text/muted/border/heading/shadow/inputBg/overlay/onAccent/icon
 * literals 为结构常量（圆角等），主题引擎原样输出 */
window.MM_REGISTRY = {
  version: 1,
  groups: ${JSON.stringify(groups, null, 2).replace(/\n/g, '\n  ')},
  entries: ${JSON.stringify(entries, null, 2).replace(/\n/g, '\n  ')}
};
`;
  return { output, entries, groups, merged, added };
}

if (args.has('--capture-base')) captureBase();
const result = buildRegistry();
if (args.has('--check')) {
  const current = fs.readFileSync(OUTPUT_FILE, 'utf8').replace(/\r\n/g, '\n');
  if (current !== result.output) {
    console.error('style-registry.js 与仓库内规范不一致，请运行 node scripts/build-registry.js');
    process.exitCode = 1;
  } else console.log('✓ style-registry.js 可由仓库内规范完整复现');
} else {
  fs.writeFileSync(OUTPUT_FILE, result.output, 'utf8');
  console.log('live-patch：新增', result.added, '条，合并', result.merged, '条');
  console.log('条目总数:', result.entries.length);
  console.log('分组:', JSON.stringify(result.groups, null, 1));
}
