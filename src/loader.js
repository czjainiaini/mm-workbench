/* ============================================================
 * MMLoader —— 角色卡功能栏包 → 独立程序注入器
 * 将「regex_scripts 占位符包」解析并直接注入 chatIframe，
 * 摆脱对角色卡正则系统/油猴的依赖。
 * 依赖 MMAgent（getChatDoc / Guardian / SnapshotEngine），
 * 独立加载时在 sexyai.ai 上自动初始化精简运行时。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__MM_LOADER_LOADED__) return;
  window.__MM_LOADER_LOADED__ = true;

  /* ---------- 精简自举：独立运行时（非油猴、未加载主脚本） ---------- */
  function ensureAgent() {
    if (window.MMAgent) return window.MMAgent;
    const agent = {};
    agent.getChatDoc = function () {
      const ifr = document.getElementById('chatIframe');
      if (!ifr) return document; // 本地复刻沙盒模式：聊天页即顶层文档
      try { return ifr.contentDocument || null; } catch (e) { return null; }
    };
    agent.Guardian = {
      forbidden: /(pay|wallet|recharge|charge|account|password|passwd|captcha|verify-code|logout)/i,
      check(text) {
        if (this.forbidden.test(text)) return { ok: false, reason: '触及禁区' };
        return { ok: true };
      }
    };
    agent.SnapshotEngine = {
      commits: [],
      add(c) { this.commits.push(c); },
      list() { return this.commits.slice().reverse(); }
    };
    window.MMAgent = agent;
    return agent;
  }

  /* ---------- 解析：剥离导出器拼接的分节标记 ---------- */
  // 导出工具会在 replaceString 尾部拼接「N.规则名称：…」「## 持久化说明」「## 使用与验收」等分节文字
  const SECTION_NOISE = /\n+(?:#{2,3}[^\n]*|\d+\.\s*规则名称：[^\n]*)[\s\S]*$/;

  function cleanPayload(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(SECTION_NOISE, '').trim();
  }

  /** 解析包 JSON，返回按顺序排列的载荷列表 */
  function parsePackage(json) {
    const pkg = typeof json === 'string' ? JSON.parse(json) : json;
    const scripts = pkg.regex_scripts || [];
    const payloads = [];
    for (const s of scripts) {
      const body = cleanPayload(s.replaceString);
      if (!body) continue;
      let kind = null;
      if (/^\s*<style[\s>]/i.test(body)) kind = 'style';
      else if (/^\s*<script[\s>]/i.test(body)) kind = 'script';
      if (!kind) {
        payloads.push({ kind: 'unknown', name: s.scriptName || '(未命名)', body });
        continue;
      }
      // 提取标签内部内容
      let inner = body;
      let attrs = '';
      const m = body.match(/^<(\w+)([^>]*)>([\s\S]*)<\/\1>\s*$/i);
      if (m) { attrs = m[2] || ''; inner = m[3]; }
      payloads.push({
        kind,
        name: s.scriptName || '(未命名)',
        attrs,
        body: kind === 'style' ? body : inner, // style 整标签注入，script 取内容重建
        placeholder: s.findRegex || ''
      });
    }
    return {
      name: pkg.name || '未命名美化包',
      pageDepth: pkg.pageDepth,
      statusbarTemplate: pkg.statusbar || '',
      payloads
    };
  }

  /* ---------- 注入 ---------- */
  const loaded = []; // { pkg, nodes:[], teardowns:[] }

  function loadPackage(json, opts) {
    opts = opts || {};
    const agent = ensureAgent();
    const chatDoc = agent.getChatDoc();
    if (!chatDoc) return { ok: false, reason: 'chatIframe 不可达' };

    const pkg = parsePackage(json);
    const guard = agent.Guardian.check(pkg.payloads.map(p => p.name).join(' '), 'pkg-load');
    if (!guard.ok) return { ok: false, reason: guard.reason };

    const head = chatDoc.head || chatDoc.documentElement;
    const nodes = [];
    const teardowns = [];
    const injected = [];

    for (const p of pkg.payloads) {
      if (p.kind === 'style') {
        const holder = chatDoc.createElement('div');
        holder.innerHTML = p.body; // 保留原标签属性（如 data-mmd-theme / disabled）
        const st = holder.firstChild;
        if (st) {
          st.setAttribute('data-mm-pkg', pkg.name);
          head.appendChild(st);
          nodes.push(st);
          injected.push('style: ' + p.name);
        }
      } else if (p.kind === 'script') {
        const sc = chatDoc.createElement('script');
        sc.textContent = p.body; // 同源 chatIframe 且 CSP 允许内联脚本（实测绿灯）
        sc.setAttribute('data-mm-pkg', pkg.name);
        (chatDoc.body || head).appendChild(sc);
        nodes.push(sc);
        injected.push('script: ' + p.name);
      } else {
        injected.push('skip(unknown): ' + p.name);
      }
    }

    // 已知拆卸钩子（包内脚本暴露的全局关闭函数）
    const w = chatDoc.defaultView;
    if (w && typeof w._mhdm_off === 'function') teardowns.push(() => { try { w._mhdm_off(); } catch (e) {} });

    const entry = { pkg: pkg.name, nodes, teardowns };
    loaded.push(entry);

    if (agent.SnapshotEngine) {
      agent.SnapshotEngine.add({
        id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
        ts: new Date().toISOString(),
        type: 'package',
        area: pkg.name,
        note: injected.join(' | '),
        before: null,
        after: pkg.payloads.map(p => p.kind + ':' + p.name).join('\n'),
        reverted: false
      });
    }

    return {
      ok: true,
      pkg: pkg.name,
      injected,
      skipped: injected.filter(s => s.indexOf('skip') === 0),
      statusbarTemplate: opts.returnTemplate ? pkg.statusbarTemplate : undefined
    };
  }

  /** 卸载：移除注入节点 + 调用拆卸钩子；脚本内 MutationObserver 建议刷新页面彻底清理 */
  function unloadPackage(name) {
    const idx = name ? loaded.findIndex(e => e.pkg === name) : loaded.length - 1;
    if (idx < 0) return { ok: false, reason: '未找到已加载的包' };
    const entry = loaded[idx];
    entry.teardowns.forEach(fn => fn());
    entry.nodes.forEach(n => { try { n.remove(); } catch (e) {} });
    loaded.splice(idx, 1);
    return { ok: true, pkg: entry.pkg, needRefreshHint: '脚本类注入建议刷新页面彻底还原' };
  }

  const MMLoader = {
    loadPackage,
    unloadPackage,
    parsePackage,
    loaded: () => loaded.slice(),
    VERSION: '0.1.0'
  };
  window.MMLoader = MMLoader;

  /* ---------- 独立运行自举：在 sexyai.ai 上等待 chatIframe 后自动待命 ---------- */
  if (!window.MMAgent && /sexyai\.ai/.test(location.host)) {
    let waited = 0;
    const timer = setInterval(() => {
      waited += 500;
      const doc = ensureAgent().getChatDoc();
      if (doc && doc.readyState === 'complete') {
        clearInterval(timer);
        console.log('[MMLoader] 就绪。调用 MMLoader.loadPackage(json) 加载美化包');
      } else if (waited > 30000) clearInterval(timer);
    }, 500);
  }
})();
