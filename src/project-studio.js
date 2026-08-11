(function () {
  'use strict';

  const ext = window.__wbExt;
  const root = document.getElementById('project-studio');
  if (!ext || !root) return;

  const SNAPSHOT_STORE = 'wb-project-snapshots';
  const TEST_STORE = 'wb-project-test-state';
  const NOTICE_STORE = 'wb-project-notice';
  const PROJECT_KEYS = ['wb-fs', 'wb-components', 'wb-assets', 'wb-custom', 'wb-slots', 'wb-drops'];
  const KEY_LABELS = {
    'wb-fs': '项目文件',
    'wb-components': '组件设置',
    'wb-assets': '素材替换',
    'wb-custom': '点选编辑',
    'wb-slots': '插槽模块',
    'wb-drops': '画布组件'
  };
  const MAX_SNAPSHOTS = 30;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  let section = 'templates';
  let lastResult = readJson(TEST_STORE, null);
  const startupNotice = localStorage.getItem(NOTICE_STORE);
  if (startupNotice) localStorage.removeItem(NOTICE_STORE);

  const TEMPLATES = [
    {
      id: 'purple-night', name: '沉浸紫夜', tag: '氛围感',
      desc: '深紫背景、柔和高光与紧凑气泡，适合剧情互动。',
      palette: { bg: '#14101f', surface: '#21182f', accent: '#a97ff5', text: '#ece6f7', self: '#7146c8' },
      font: { size: 15, lh: 1.65 }, radius: 12
    },
    {
      id: 'deep-ocean', name: '深海阅读', tag: '长文友好',
      desc: '低刺激深蓝、舒展行距，适合长回复和持续阅读。',
      palette: { bg: '#09131e', surface: '#10283a', accent: '#58b9f7', text: '#e8f5ff', self: '#175a82' },
      font: { size: 16, lh: 1.8 }, radius: 10
    },
    {
      id: 'warm-tea', name: '暖茶长篇', tag: '温和耐看',
      desc: '暖棕与琥珀强调色，降低纯黑对比，适合长期创作。',
      palette: { bg: '#18130e', surface: '#2a2118', accent: '#e7aa62', text: '#f4eadc', self: '#7f5127' },
      font: { size: 17, lh: 1.9 }, radius: 14
    },
    {
      id: 'forest-calm', name: '森屿清新', tag: '清爽',
      desc: '墨绿层次与柔和薄荷色，适合状态栏和轻量对话。',
      palette: { bg: '#0d1713', surface: '#173027', accent: '#57cf96', text: '#e9f5ee', self: '#286849' },
      font: { size: 15, lh: 1.72 }, radius: 16
    }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function byteLength(value) {
    return new Blob([String(value || '')]).size;
  }

  function formatBytes(value) {
    const n = Number(value) || 0;
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }

  function formatDate(value) {
    const d = new Date(value || Date.now());
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function hash(value) {
    const text = String(value || '');
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function captureState() {
    const state = {};
    PROJECT_KEYS.forEach(key => { state[key] = localStorage.getItem(key); });
    return state;
  }

  function stateSignature(state) {
    return hash(PROJECT_KEYS.map(key => key + ':' + (state[key] || '')).join('\n'));
  }

  function stateSize(state) {
    return PROJECT_KEYS.reduce((sum, key) => sum + byteLength(state[key]), 0);
  }

  function getSnapshots() {
    const list = readJson(SNAPSHOT_STORE, []);
    return Array.isArray(list) ? list.filter(item => item && item.state && item.id) : [];
  }

  function persistSnapshots(list) {
    const next = list.slice(0, MAX_SNAPSHOTS);
    while (next.length) {
      try {
        localStorage.setItem(SNAPSHOT_STORE, JSON.stringify(next));
        return next;
      } catch (e) {
        if (next.length === 1) throw new Error('浏览器本地空间不足，当前项目快照过大');
        next.pop();
      }
    }
    localStorage.setItem(SNAPSHOT_STORE, '[]');
    return [];
  }

  function createSnapshot(name, kind, announce) {
    const state = captureState();
    const snapshot = {
      id: 'ps-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      schemaVersion: 1,
      name: String(name || '未命名快照').slice(0, 60),
      kind: kind || 'manual',
      createdAt: Date.now(),
      roleId: ext.currentRoleId(),
      signature: stateSignature(state),
      bytes: stateSize(state),
      state
    };
    persistSnapshots([snapshot].concat(getSnapshots()));
    if (announce !== false) {
      ext.addHistory('项目快照', snapshot.name);
      ext.miniToast('快照已保存：' + snapshot.name);
    }
    return snapshot;
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || !snapshot.state) return;
    if (!confirm('恢复快照「' + snapshot.name + '」？\n当前状态会先自动备份，模型密钥和聊天记录不受影响。')) return;
    const recovery = createSnapshot('恢复前自动备份 · ' + formatDate(Date.now()), 'recovery', false);
    try {
      PROJECT_KEYS.forEach(key => {
        const value = snapshot.state[key];
        if (typeof value === 'string') localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      });
      localStorage.setItem(NOTICE_STORE, '已恢复快照「' + snapshot.name + '」，恢复前状态也已自动备份。');
      ext.addHistory('恢复项目快照', snapshot.name);
      location.reload();
    } catch (e) {
      PROJECT_KEYS.forEach(key => {
        const value = recovery.state[key];
        try { if (typeof value === 'string') localStorage.setItem(key, value); else localStorage.removeItem(key); } catch (ignore) {}
      });
      ext.miniToast('快照恢复失败，已尽量还原恢复前状态：' + e.message);
    }
  }

  function deleteSnapshot(snapshot) {
    if (!snapshot || !confirm('删除快照「' + snapshot.name + '」？此操作不可撤销。')) return;
    persistSnapshots(getSnapshots().filter(item => item.id !== snapshot.id));
    render();
  }

  function download(filename, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function exportSnapshot(snapshot) {
    const payload = { app: 'mm-workbench', schemaVersion: 1, exportedAt: Date.now(), snapshot };
    download('mm-workbench_' + snapshot.name.replace(/[\\/:*?"<>|]/g, '_') + '.json', JSON.stringify(payload, null, 2));
    ext.miniToast('项目快照已导出；不包含 API Key、模型档案或聊天记录');
  }

  function validateImportedSnapshot(value) {
    const snapshot = value && value.app === 'mm-workbench' ? value.snapshot : value;
    if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.state || typeof snapshot.state !== 'object') throw new Error('不是受支持的 MM Workbench v1 项目快照');
    const state = {};
    PROJECT_KEYS.forEach(key => {
      const item = snapshot.state[key];
      if (item != null && typeof item !== 'string') throw new Error('快照字段格式错误：' + key);
      if (typeof item === 'string') JSON.parse(item);
      state[key] = item == null ? null : item;
    });
    return {
      id: 'ps-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      schemaVersion: 1,
      name: ('导入 · ' + (snapshot.name || '项目快照')).slice(0, 60),
      kind: 'imported',
      createdAt: Date.now(),
      roleId: String(snapshot.roleId || ''),
      signature: stateSignature(state),
      bytes: stateSize(state),
      state
    };
  }

  function templateComponentState(template) {
    const p = template.palette;
    return {
      order: ['theme', 'bubble', 'statusbar', 'shortcut', 'font', 'input'],
      enabled: { theme: true, bubble: true, statusbar: true, shortcut: true, font: true, input: true },
      values: {
        theme: Object.assign({}, p),
        bubble: { aiBg: p.surface, selfBg: p.self, radius: template.radius },
        statusbar: { bg: p.bg, border: p.accent, text: p.text },
        shortcut: { bg: p.surface, btnBg: p.bg, text: p.text },
        font: { size: template.font.size, lh: template.font.lh, color: p.text },
        input: { bg: p.surface, border: p.accent }
      },
      selected: 'theme'
    };
  }

  function templateCss(template) {
    const p = template.palette;
    return ext.buildThemeCss(p) + '\n\n' +
      '.chat-body .content.left:not(#mm-z){background:' + p.surface + '!important;border-radius:' + template.radius + 'px!important}\n' +
      '.chat-body .content.right:not(#mm-z){background:' + p.self + '!important;border-radius:' + template.radius + 'px!important}\n' +
      '.chat-body .content.left:not(#mm-z),.chat-body .content.left:not(#mm-z) p,.tavern-sandbox:not(#mm-z){font-size:' + template.font.size + 'px!important;line-height:' + template.font.lh + '!important;color:' + p.text + '!important}\n' +
      '.chat-input-scope:not(#mm-z){background:' + p.surface + '!important;border-color:' + p.accent + '!important}';
  }

  function applyTemplate(template) {
    if (!template) return;
    try {
      createSnapshot('应用模板前 · ' + formatDate(Date.now()), 'recovery', false);
      const fs = readJson('wb-fs', null) || (ext.getFileState ? ext.getFileState() : {});
      fs['styles.css'] = fs['styles.css'] || { type: 'css', content: '' };
      fs['styles.css'].content = templateCss(template);
      fs['styles.css'].updatedAt = Date.now();
      localStorage.setItem('wb-fs', JSON.stringify(fs));
      localStorage.setItem('wb-components', JSON.stringify(templateComponentState(template)));
      localStorage.setItem(NOTICE_STORE, '模板「' + template.name + '」已应用；原状态已保存为恢复快照。');
      ext.addHistory('应用项目模板', template.name);
      location.reload();
    } catch (e) { ext.miniToast('模板应用失败：' + e.message); }
  }

  function latestSnapshot() {
    return getSnapshots()[0] || null;
  }

  function diffFromLatest(state) {
    const baseline = latestSnapshot();
    if (!baseline) return { baseline: null, changes: [], totalDelta: stateSize(state) };
    const changes = PROJECT_KEYS.filter(key => (baseline.state[key] || '') !== (state[key] || '')).map(key => ({
      key,
      label: KEY_LABELS[key],
      before: byteLength(baseline.state[key]),
      after: byteLength(state[key])
    }));
    return { baseline: { id: baseline.id, name: baseline.name, createdAt: baseline.createdAt }, changes, totalDelta: stateSize(state) - stateSize(baseline.state) };
  }

  function check(result, level, label, detail) {
    result.checks.push({ level, label, detail });
    if (level === 'error') result.errors.push(label + (detail ? '：' + detail : ''));
    if (level === 'warning') result.warnings.push(label + (detail ? '：' + detail : ''));
  }

  function preflight(options) {
    const opts = options || {};
    const result = {
      ok: false,
      source: opts.source || 'manual',
      forPublish: !!opts.forPublish,
      at: Date.now(),
      checks: [], errors: [], warnings: [], capabilities: [], json: '', signature: '', diff: null
    };
    let pkg = null;
    try {
      const provided = typeof opts.packageJson === 'string' && (opts.packageJson.indexOf('regex_scripts') >= 0 || opts.packageJson.trim().indexOf('[') === 0);
      result.json = provided ? opts.packageJson : ext.exportBeautyPack();
      pkg = JSON.parse(result.json);
      check(result, 'pass', provided ? 'package.json 可读取' : '美化包可生成', formatBytes(byteLength(result.json)));
    } catch (e) {
      check(result, 'error', '美化包生成失败', e.message);
    }

    if (pkg) {
      const rules = Array.isArray(pkg) ? pkg.filter(rule => !rule.disabled) : Array.isArray(pkg.regex_scripts) ? pkg.regex_scripts : (pkg.data && pkg.data.extensions && Array.isArray(pkg.data.extensions.regex_scripts) ? pkg.data.extensions.regex_scripts.filter(rule => !rule.disabled) : []);
      if (!rules.length) check(result, 'error', '正则规则为空', '至少需要一条样式或脚本规则');
      else check(result, 'pass', '规则结构有效', rules.length + ' 条');
      if (rules.length > 130) check(result, 'error', '规则超出平台上限', rules.length + '/130');
      const names = new Set();
      rules.forEach((rule, index) => {
        if (!rule || typeof rule !== 'object') { check(result, 'error', '第 ' + (index + 1) + ' 条规则格式错误', '必须是对象'); return; }
        const name = String(rule.scriptName || '').trim() || '未命名规则';
        const regex = String(rule.findRegex || '');
        const content = String(rule.replaceString || '');
        if (!String(rule.scriptName || '').trim()) check(result, 'warning', '第 ' + (index + 1) + ' 条规则未命名', '发布时将使用“未命名规则”');
        if (name.length > 20) check(result, 'error', '规则名超长', name + '（' + name.length + '/20）');
        if (regex.length > 1000) check(result, 'error', '正则超长', name + '（' + regex.length + '/1000）');
        if (content.length > 20000) check(result, 'error', '替换内容超长', name + '（' + content.length + '/20000）');
        try { new RegExp(regex); } catch (e) { check(result, 'error', '正则无效', name + '：' + e.message); }
        if (names.has(name)) check(result, 'error', '规则名称重复', name);
        names.add(name);
      });
      const joined = rules.map(rule => String(rule.replaceString || '')).join('\n');
      if (/<style[\s>]/i.test(joined)) result.capabilities.push('CSS 样式');
      if (/<script[\s>]/i.test(joined)) result.capabilities.push('DOM 脚本');
      if (/https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket/i.test(joined)) {
        result.capabilities.push('网络访问');
        check(result, 'warning', '检测到网络能力', '发布前请确认 URL 和数据范围');
      }
      if (byteLength(result.json) > 512 * 1024) check(result, 'warning', '包体积较大', formatBytes(byteLength(result.json)));
      if (!(typeof opts.packageJson === 'string' && (opts.packageJson.indexOf('regex_scripts') >= 0 || opts.packageJson.trim().indexOf('[') === 0))) ext.syncPackageFile(result.json);
    }

    const runtime = ext.getRuntimeState();
    if (opts.forPublish) {
      if (runtime.mode !== 'chat') check(result, 'error', '发布必须使用真站聊天页', '当前模式：' + (runtime.mode || '未选择'));
      else check(result, 'pass', '真站聊天模式', '角色 ' + runtime.roleId);
      if (!runtime.bridgeReady) check(result, 'error', '实时注入桥未就绪', '登录后回工作台刷新');
      else check(result, 'pass', '实时注入桥就绪', '可验证与发布');
      if (!runtime.chatReady) check(result, 'error', '真实聊天结构未就绪', '请先登录并等待消息列表加载');
      else check(result, 'pass', '真实聊天结构就绪', '可见页面可实时编辑');
      if (runtime.brokenImages) check(result, 'warning', '页面存在破损图片', runtime.brokenImages + ' 个；不阻止发布，但建议先修复');
    } else {
      if (runtime.mode !== 'chat') check(result, 'warning', '尚未在真站聊天页验收', '导出允许继续，发布会阻止');
      else if (!runtime.chatReady) check(result, 'warning', '真站聊天页尚未完全加载', '登录后刷新再做最终验收');
      else check(result, 'pass', '真站实时预览就绪', '当前改动可见');
      if (runtime.brokenImages) check(result, 'warning', '页面存在破损图片', runtime.brokenImages + ' 个');
    }

    const state = captureState();
    result.signature = stateSignature(state);
    result.diff = diffFromLatest(state);
    result.ok = result.errors.length === 0;
    const stored = Object.assign({}, result);
    delete stored.json;
    try { localStorage.setItem(TEST_STORE, JSON.stringify(stored)); } catch (e) {}
    lastResult = stored;
    if (opts.source === 'manual') ext.addHistory('发布前测试', result.ok ? '通过' : '失败：' + result.errors[0]);
    render();
    return result;
  }

  function renderTemplates() {
    return '<div class="ps-intro"><b>长期创作闭环</b><span>选模板 → 实时精修 → 保存快照 → Test Mode → 导出/发布。每次套模板前都会自动留下恢复点。</span></div>' +
      '<div class="ps-template-grid">' + TEMPLATES.map(t =>
        '<article class="ps-template"><div class="ps-swatches">' + Object.values(t.palette).slice(0, 4).map(color => '<i style="background:' + esc(color) + '"></i>').join('') + '</div>' +
        '<div class="ps-template-head"><b>' + esc(t.name) + '</b><span>' + esc(t.tag) + '</span></div><p>' + esc(t.desc) + '</p>' +
        '<button class="primary" data-template="' + esc(t.id) + '">应用模板并留恢复点</button></article>'
      ).join('') + '</div>';
  }

  function renderSnapshots() {
    const list = getSnapshots();
    return '<div class="ps-toolbar"><input id="ps-snapshot-name" maxlength="60" placeholder="快照名称（如：第一章完成版）"><button class="primary" id="ps-save-snapshot">保存当前快照</button><button id="ps-import-snapshot">导入快照</button><input id="ps-import-file" type="file" accept=".json,application/json" hidden></div>' +
      '<p class="ps-note">仅保存项目文件、组件、素材、点选、插槽与画布；不会保存 API Key、模型档案、AI 会话、角色 ID 或登录态。最多保留 ' + MAX_SNAPSHOTS + ' 份。</p>' +
      (list.length ? '<div class="ps-list">' + list.map(s =>
        '<article class="ps-row" data-snapshot="' + esc(s.id) + '"><div><b>' + esc(s.name) + '</b><span>' + formatDate(s.createdAt) + ' · ' + formatBytes(s.bytes) + (s.kind === 'recovery' ? ' · 自动恢复点' : '') + '</span></div>' +
        '<div class="ps-actions"><button data-restore="' + esc(s.id) + '">恢复</button><button data-export="' + esc(s.id) + '">导出</button><button data-delete="' + esc(s.id) + '" class="ps-danger">删除</button></div></article>'
      ).join('') + '</div>' : '<div class="ps-empty">还没有项目快照。完成一个阶段就保存一份，之后可以放心继续尝试。</div>');
  }

  function renderHistory() {
    const history = readJson('wb-history', []);
    const list = Array.isArray(history) ? history.slice().reverse() : [];
    return '<div class="ps-toolbar"><b>最近变更</b><span class="ps-spacer"></span><button id="ps-clear-history"' + (list.length ? '' : ' disabled') + '>清空历史</button></div>' +
      '<p class="ps-note">历史用于快速回顾；需要真正恢复状态时，请使用项目快照或全局撤销/重做。</p>' +
      (list.length ? '<div class="ps-timeline">' + list.map(item => '<div class="ps-event"><i></i><div><b>' + esc(item.type) + '</b><span>' + esc(item.at ? formatDate(item.at) : item.ts || '') + '</span><p>' + esc(item.content) + '</p></div></div>').join('') + '</div>' : '<div class="ps-empty">暂无变更记录。</div>');
  }

  function renderTest() {
    const result = lastResult;
    const state = captureState();
    const diff = result && result.signature === stateSignature(state) ? result.diff : diffFromLatest(state);
    const stale = result && result.signature !== stateSignature(state);
    const capabilityHtml = result && result.capabilities && result.capabilities.length ? '<div class="ps-capabilities"><b>包能力</b>' + result.capabilities.map(item => '<span>' + esc(item) + '</span>').join('') + '</div>' : '';
    const resultHtml = result ?
      '<div class="ps-test-summary ' + (result.ok && !stale ? 'ok' : 'bad') + '"><b>' + (stale ? '项目已变化，请重新测试' : result.ok ? '测试通过' : '测试未通过') + '</b><span>' + formatDate(result.at) + ' · ' + (result.forPublish ? '发布标准' : '导出标准') + '</span></div>' +
      capabilityHtml + '<div class="ps-checks">' + (result.checks || []).map(item => '<div class="ps-check ' + item.level + '"><span>' + (item.level === 'pass' ? '✓' : item.level === 'warning' ? '⚠' : '✕') + '</span><div><b>' + esc(item.label) + '</b><small>' + esc(item.detail || '') + '</small></div></div>').join('') + '</div>' :
      '<div class="ps-empty">还没有测试结果。发布标准会验证美化包、真站模式、实时桥、聊天结构和图片资源。</div>';
    const diffHtml = diff.baseline ?
      (diff.changes.length ? '<div class="ps-diff"><b>相对最近快照「' + esc(diff.baseline.name) + '」</b>' + diff.changes.map(item => '<span>' + esc(item.label) + '：' + formatBytes(item.before) + ' → ' + formatBytes(item.after) + '</span>').join('') + '</div>' : '<div class="ps-diff"><b>与最近快照一致</b><span>当前项目没有未快照的变化。</span></div>') :
      '<div class="ps-diff"><b>尚无对比基线</b><span>先保存一份项目快照，之后测试会显示各部分差异。</span></div>';
    return '<div class="ps-toolbar"><button class="primary" id="ps-run-test">运行发布前 Test Mode</button><button id="ps-save-before-test">先保存快照</button><span class="ps-note-inline">发布按钮也会自动重跑同一套检查</span></div>' + diffHtml + resultHtml;
  }

  function bindEvents() {
    root.querySelectorAll('[data-section]').forEach(button => {
      button.onclick = () => { section = button.dataset.section; render(); };
    });
    root.querySelectorAll('[data-template]').forEach(button => {
      button.onclick = () => applyTemplate(TEMPLATES.find(t => t.id === button.dataset.template));
    });
    const save = root.querySelector('#ps-save-snapshot');
    if (save) save.onclick = () => {
      const input = root.querySelector('#ps-snapshot-name');
      createSnapshot((input.value || '手动快照 · ' + formatDate(Date.now())).trim(), 'manual', true);
      render();
    };
    const importer = root.querySelector('#ps-import-snapshot');
    const file = root.querySelector('#ps-import-file');
    if (importer && file) {
      importer.onclick = () => file.click();
      file.onchange = async () => {
        try {
          const selected = file.files && file.files[0];
          if (!selected) return;
          if (selected.size > MAX_IMPORT_BYTES) throw new Error('文件超过 2 MB 上限');
          const snapshot = validateImportedSnapshot(JSON.parse(await selected.text()));
          persistSnapshots([snapshot].concat(getSnapshots()));
          ext.miniToast('快照已导入；检查后点击“恢复”应用');
          render();
        } catch (e) { ext.miniToast('导入失败：' + e.message); }
      };
    }
    const snapshots = getSnapshots();
    root.querySelectorAll('[data-restore]').forEach(button => button.onclick = () => restoreSnapshot(snapshots.find(s => s.id === button.dataset.restore)));
    root.querySelectorAll('[data-export]').forEach(button => button.onclick = () => exportSnapshot(snapshots.find(s => s.id === button.dataset.export)));
    root.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => deleteSnapshot(snapshots.find(s => s.id === button.dataset.delete)));
    const clear = root.querySelector('#ps-clear-history');
    if (clear) clear.onclick = () => {
      if (!confirm('清空变更历史？项目内容和快照不会被删除。')) return;
      localStorage.removeItem('wb-history');
      render();
    };
    const run = root.querySelector('#ps-run-test');
    if (run) run.onclick = () => preflight({ forPublish: true, source: 'manual' });
    const before = root.querySelector('#ps-save-before-test');
    if (before) before.onclick = () => { createSnapshot('测试前 · ' + formatDate(Date.now()), 'manual', true); render(); };
  }

  function render() {
    root.innerHTML = '<div class="ps-shell">' + (startupNotice ? '<div class="ps-notice">✓ ' + esc(startupNotice) + '</div>' : '') +
      '<header><div><h2>项目工作室</h2><p>模板、版本、验证和交付都在这里完成。</p></div><span class="ps-role">当前发布角色 ' + esc(ext.currentRoleId()) + '</span></header>' +
      '<nav role="tablist" aria-label="项目工作室"><button data-section="templates" class="' + (section === 'templates' ? 'on' : '') + '">模板库</button><button data-section="snapshots" class="' + (section === 'snapshots' ? 'on' : '') + '">项目快照</button><button data-section="history" class="' + (section === 'history' ? 'on' : '') + '">变更历史</button><button data-section="test" class="' + (section === 'test' ? 'on' : '') + '">Test Mode</button></nav>' +
      '<main>' + (section === 'templates' ? renderTemplates() : section === 'snapshots' ? renderSnapshots() : section === 'history' ? renderHistory() : renderTest()) + '</main></div>';
    bindEvents();
  }

  function open(target) {
    section = target || 'test';
    ext.activateView('project', false);
    render();
  }

  const style = document.createElement('style');
  style.textContent = '#project-studio{flex:1;overflow:auto;background:var(--panel-deep);padding:14px}.ps-shell{max-width:920px;margin:0 auto}.ps-shell>header{display:flex;align-items:center;gap:12px;margin-bottom:12px}.ps-shell h2{font-size:18px}.ps-shell header p,.ps-note{color:var(--muted);font-size:11px}.ps-role{margin-left:auto;color:var(--accent2);font-size:11px;border:1px solid var(--line);border-radius:999px;padding:3px 9px}.ps-shell nav{display:flex;gap:5px;border-bottom:1px solid var(--line);margin-bottom:12px}.ps-shell nav button{border:0;border-radius:8px 8px 0 0;background:transparent}.ps-shell nav button.on{background:var(--panel3);color:var(--accent2);font-weight:700}.ps-notice{padding:8px 10px;margin-bottom:10px;border:1px solid rgba(101,218,145,.35);background:rgba(101,218,145,.09);color:var(--green);border-radius:10px}.ps-intro{display:flex;gap:10px;align-items:center;padding:10px 12px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.25);border-radius:10px;margin-bottom:12px}.ps-intro b{color:var(--accent2)}.ps-intro span{font-size:11px;color:var(--muted)}.ps-template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ps-template{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}.ps-swatches{display:flex;height:25px;border-radius:7px;overflow:hidden;margin-bottom:9px}.ps-swatches i{flex:1}.ps-template-head{display:flex;align-items:center}.ps-template-head span{margin-left:auto;font-size:10px;color:var(--accent2);background:rgba(var(--accent-rgb),.12);border-radius:999px;padding:2px 7px}.ps-template p{color:var(--muted);font-size:11px;min-height:36px;margin:5px 0 9px}.ps-toolbar{display:flex;gap:7px;align-items:center;margin-bottom:9px}.ps-toolbar input{flex:1;min-width:180px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:6px 9px}.ps-spacer{flex:1}.ps-note{margin-bottom:10px}.ps-note-inline{color:var(--muted);font-size:10.5px}.ps-list,.ps-timeline,.ps-checks{display:flex;flex-direction:column;gap:7px}.ps-row{display:flex;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 11px}.ps-row>div:first-child{display:flex;flex-direction:column;min-width:0}.ps-row span{font-size:10px;color:var(--dim)}.ps-actions{margin-left:auto;display:flex;gap:5px}.ps-danger{color:var(--red)}.ps-empty{padding:28px;text-align:center;color:var(--dim);border:1px dashed var(--line);border-radius:10px}.ps-event{display:flex;gap:9px;background:var(--panel);border-radius:9px;padding:8px 10px}.ps-event>i{width:7px;height:7px;border-radius:50%;background:var(--accent);margin-top:6px;flex-shrink:0}.ps-event>div{min-width:0}.ps-event span{font-size:10px;color:var(--dim);margin-left:8px}.ps-event p{font-size:11px;color:var(--muted);white-space:pre-wrap;word-break:break-word}.ps-diff{display:flex;flex-direction:column;gap:3px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:9px}.ps-diff span{font-size:10.5px;color:var(--muted)}.ps-capabilities{display:flex;gap:6px;align-items:center;margin:0 0 8px;color:var(--muted);font-size:10.5px}.ps-capabilities span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:2px 7px;color:var(--accent2)}.ps-test-summary{display:flex;align-items:center;padding:9px 12px;border-radius:10px;margin-bottom:8px}.ps-test-summary span{margin-left:auto;font-size:10px}.ps-test-summary.ok{background:rgba(101,218,145,.1);color:var(--green);border:1px solid rgba(101,218,145,.35)}.ps-test-summary.bad{background:rgba(245,141,141,.1);color:var(--red);border:1px solid rgba(245,141,141,.35)}.ps-check{display:flex;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:8px 10px}.ps-check>span{font-weight:800}.ps-check>div{display:flex;flex-direction:column}.ps-check small{color:var(--muted)}.ps-check.pass>span{color:var(--green)}.ps-check.warning>span{color:var(--yellow)}.ps-check.error>span{color:var(--red)}@media(max-width:760px){.ps-template-grid{grid-template-columns:1fr}.ps-row{align-items:flex-start;flex-direction:column}.ps-actions{margin-left:0}.ps-toolbar{flex-wrap:wrap}.ps-note-inline{width:100%}}';
  document.head.appendChild(style);

  window.addEventListener('wb:viewchange', event => { if (event.detail && event.detail.view === 'project') render(); });
  window.addEventListener('wb:historychange', () => { if (section === 'history' && document.getElementById('view-project').classList.contains('on')) render(); });
  window.MMProjectStudio = { preflight, open, createSnapshot, captureState };
  render();
})();
