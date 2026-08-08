// ==UserScript==
// @name         魅魔Agent工作台 PoC
// @namespace    mm-agent
// @version      0.1.0
// @description  sexyai.ai 可视化编程 Agent：ocs 三层执行架构 + 区域注册表 + 快照/Diff/回滚 + 守卫
// @match        https://sexyai.ai/*
// @match        http://localhost:8787/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__MM_AGENT_LOADED__) return;
  window.__MM_AGENT_LOADED__ = true;

  /* ============================================================
   * 0. 配置与常量
   * ============================================================ */
  const CONFIG = {
    bridgeSrc: 'about:blank',        // 中间层同源桥（用户 ocs 管线中可换为站内路径如 '/x'）
    executorFlags: 'allow-scripts',  // 执行域：无 allow-same-origin → opaque，CSP 不传导
    maxOpsPerMinute: 20,             // 守卫限流
    commitStorageKey: 'mm-agent-commits',
    maxStoredCommits: 50,
    msgTimeout: 8000
  };

  // 实测校准的区域注册表（与 src/region-registry.json 同步）
  const REGISTRY = [
    { key: 'chat_iframe',      name: '聊天应用 iframe',          selector: '#chatIframe',                                              scope: 'top',       stability: 'high' },
    { key: 'scroll_container', name: '消息滚动容器',             selector: '#scrollview .uni-scroll-view-content',                     scope: 'chatIframe', stability: 'high' },
    { key: 'msg_list',         name: '消息列表',                 selector: '.chat-body#msglistview',                                   scope: 'chatIframe', stability: 'high' },
    { key: 'msg_item',         name: '单条消息',                 selector: '.chat-body .item',                                         scope: 'chatIframe', stability: 'medium' },
    { key: 'ai_bubble',        name: 'AI 消息气泡',              selector: '.item.Ai .content.left',                                   scope: 'chatIframe', stability: 'high' },
    { key: 'self_bubble',      name: '用户消息气泡',             selector: '.item.self .right',                                        scope: 'chatIframe', stability: 'medium' },
    { key: 'ai_richtext',      name: 'AI 富文本渲染区(状态栏挂载点)', selector: '.content.left .tavern-sandbox',                        scope: 'chatIframe', stability: 'high' },
    { key: 'input_real',       name: '真实输入框(展开态)',        selector: '.chat-input-scope uni-textarea.chatMsgTextarea textarea',  scope: 'chatIframe', stability: 'medium' },
    { key: 'input_collapsed',  name: '输入区折叠预览',           selector: '.chat-input-collapsed-display',                            scope: 'chatIframe', stability: 'medium' },
    { key: 'send_btn',         name: '发送按钮',                 selector: '.chat-input-bottom-row .btn-icon',                         scope: 'chatIframe', stability: 'medium' }
  ];
  const FALLBACKS = {
    ai_bubble: ['.item.Ai .content.left', '.item.Ai', '[id^=q-]'],
    msg_list: ['.chat-body#msglistview', '#msglistview', '.chat-body'],
    input_real: ['.chat-input-scope textarea', '.chatMsgTextarea textarea', 'textarea.uni-textarea-textarea']
  };

  /* ============================================================
   * 1. 工具函数
   * ============================================================ */
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const nowISO = () => new Date().toISOString();
  const logs = [];
  function log(level, ...args) {
    const rec = { ts: nowISO(), level, msg: args.map(String).join(' ') };
    logs.push(rec);
    if (logs.length > 200) logs.shift();
    if (typeof console !== 'undefined') console[level === 'error' ? 'error' : 'log']('[MM-Agent]', rec.msg);
  }

  /** 获取 chatIframe 的 document（带重试与降级链意识） */
  function getChatDoc() {
    const ifr = document.getElementById('chatIframe');
    if (!ifr) return null;
    try { return ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document) || null; }
    catch (e) { log('error', 'chatIframe 跨域不可达:', e); return null; }
  }

  /** 按注册表解析区域元素，带 fallback 链 */
  function resolveRegion(key) {
    const reg = REGISTRY.find(r => r.key === key);
    if (!reg) return null;
    const doc = reg.scope === 'top' ? document : getChatDoc();
    if (!doc) return null;
    const trySelectors = [reg.selector].concat(FALLBACKS[key] || []);
    for (const sel of trySelectors) {
      try {
        const el = doc.querySelector(sel);
        if (el) return { el, sel, reg };
      } catch (e) { /* 非法选择器跳过 */ }
    }
    return null;
  }

  /* ============================================================
   * 2. Bus —— nonce 签名的 postMessage 总线
   * ============================================================ */
  class Bus {
    constructor() {
      this.secret = uid();
      this.pending = new Map();
      this.readyHandlers = {};
      window.addEventListener('message', (e) => this._onMessage(e));
    }
    _onMessage(e) {
      const m = e.data;
      if (!m || m.__mm !== true) return;
      // 握手消息先于 secret 同步到达，单独放行（随后由 init 验证执行域归属）
      if (/^[a-z-]+-ready$/.test(m.type || '') && this.readyHandlers[m.type]) {
        const r = this.readyHandlers[m.type];
        delete this.readyHandlers[m.type];
        r();
        return;
      }
      if (m.secret !== this.secret) return; // 拒绝非本工具消息
      if (m.id && this.pending.has(m.id)) {
        const { resolve } = this.pending.get(m.id);
        this.pending.delete(m.id);
        resolve(m);
      }
    }
    waitReady(type) {
      return new Promise((resolve) => { this.readyHandlers[type] = resolve; });
    }
    call(target, type, payload) {
      return new Promise((resolve, reject) => {
        const id = uid();
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('postMessage 超时: ' + type));
        }, CONFIG.msgTimeout);
        this.pending.set(id, {
          resolve: (m) => { clearTimeout(timer); resolve(m); }
        });
        try {
          target.postMessage({ __mm: true, secret: this.secret, id, type, payload }, '*');
        } catch (e) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(e);
        }
      });
    }
  }
  const bus = new Bus();

  /* ============================================================
   * 3. MiddleLayer —— ocs 三层执行架构
   *    壳(本脚本/控制面) → 同源桥iframe(资源/token) → opaque执行域(CSP-free)
   * ============================================================ */
  const EXECUTOR_HTML = `<!doctype html><html><body><scr` + `ipt>
var SECRET = '__MM_SECRET__';
window.addEventListener('message', async function(e){
  var m = e.data;
  if(!m || m.__mm !== true || m.secret !== SECRET) return;
  function reply(r){ r.__mm = true; r.id = m.id; r.secret = SECRET; parent.postMessage(r, '*'); }
  try {
    if(m.type === 'ping'){
      reply({ ok:true, opaque:(function(){ try { void parent.location.href; return false; } catch(_) { return true; } })() });
    } else if(m.type === 'fetch'){
      var t0 = Date.now();
      var res = await fetch(m.payload.url, m.payload.opts || {});
      var text = await res.text();
      reply({ ok:true, status:res.status, ms:Date.now()-t0, body:text.slice(0, 200000) });
    } else {
      reply({ ok:false, error:'unknown type: ' + m.type });
    }
  } catch(err){ reply({ ok:false, error:String(err) }); }
});
parent.postMessage({ __mm:true, type:'__MM_READY_TYPE__' }, '*');
</scr` + `ipt></body></html>`;

  const MiddleLayer = {
    bridge: null,
    bridgeWin: null,
    executor: null,
    executorWin: null,
    status: { bridge: 'pending', executor: 'pending' },

    _executorHtml(readyType) {
      return EXECUTOR_HTML
        .replace('__MM_SECRET__', bus.secret)
        .replace('__MM_READY_TYPE__', readyType);
    },

    _readyTimeout(p, name) {
      return Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(name + ' 超时')), CONFIG.msgTimeout))
      ]);
    },

    async init() {
      // Phase A：同源桥 iframe（同域上下文：token 读取 / API 直连，无 CORS 障碍）
      this.bridge = document.createElement('iframe');
      this.bridge.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
      this.bridge.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      this.bridge.src = CONFIG.bridgeSrc;
      const bridgeReady = bus.waitReady('bridge-ready');
      document.body.appendChild(this.bridge);
      await this._waitLoad(this.bridge);
      // 同源可达，直接写入执行脚本
      const bdoc = this.bridge.contentDocument;
      bdoc.open();
      bdoc.write(this._executorHtml('bridge-ready'));
      bdoc.close();
      await this._readyTimeout(bridgeReady, 'bridge-ready');
      this.bridgeWin = this.bridge.contentWindow;
      this.status.bridge = 'ok';
      log('info', '同源桥 iframe 就绪（API 直连通道）');

      // Phase B：opaque 执行域（blob + sandbox 无 allow-same-origin → CSP-free，专职渲染/计算）
      const blob = new Blob([this._executorHtml('executor-ready')], { type: 'text/html' });
      this.executor = document.createElement('iframe');
      this.executor.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
      this.executor.setAttribute('sandbox', CONFIG.executorFlags);
      this.executor.src = URL.createObjectURL(blob);

      const execReady = bus.waitReady('executor-ready');
      document.body.appendChild(this.executor);
      await this._waitLoad(this.executor);
      await this._readyTimeout(execReady, 'executor-ready');
      this.executorWin = this.executor.contentWindow;
      this.status.executor = 'ok';
      log('info', 'opaque 执行域就绪（CSP-free）');
    },

    _waitLoad(ifr) {
      return new Promise((resolve) => {
        if (ifr.contentDocument && ifr.contentDocument.readyState === 'complete') return resolve();
        ifr.addEventListener('load', () => resolve(), { once: true });
        setTimeout(resolve, 3000); // 兜底
      });
    },

    /** 通过同源桥发起 fetch（与站点同域：无 CORS 障碍、token/cookie 上下文完整）；桥不可用时降级 opaque 域 */
    async apiFetch(url, opts) {
      const target = this.bridgeWin || this.executorWin;
      if (!target) throw new Error('无可用执行域');
      const r = await bus.call(target, 'fetch', { url, opts: opts || {} });
      if (!r.ok) throw new Error(r.error || 'fetch 失败');
      return r;
    },

    async pingExecutor() {
      if (!this.executorWin) return { ok: false, error: '执行域未就绪' };
      return bus.call(this.executorWin, 'ping', {});
    }
  };

  /* ============================================================
   * 4. TokenProbe —— token 提取（只读探测，仅内存保留）
   * ============================================================ */
  const TokenProbe = {
    result: null,
    run() {
      const found = [];
      const scan = (storage, label) => {
        try {
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (/token|auth|session/i.test(k)) {
              const v = storage.getItem(k) || '';
              found.push({ source: label, key: k, preview: v.slice(0, 16) + (v.length > 16 ? '...' : ''), len: v.length });
            }
          }
        } catch (e) { /* storage 不可用 */ }
      };
      scan(window.localStorage, 'top.localStorage');
      scan(window.sessionStorage, 'top.sessionStorage');
      // chatIframe URL 参数（实测 token=iframe_xxx）
      const ifr = document.getElementById('chatIframe');
      if (ifr && ifr.src) {
        const m = ifr.src.match(/[?&]token=([^&]+)/);
        if (m) found.push({ source: 'chatIframe.url', key: 'token', preview: m[1].slice(0, 16) + '...', len: m[1].length });
      }
      // chatIframe 内 storage（同源可达时）
      const chatDoc = getChatDoc();
      if (chatDoc && chatDoc.defaultView) {
        scan(chatDoc.defaultView.localStorage, 'chat.localStorage');
      }
      this.result = found;
      log('info', 'TokenProbe 完成，发现', found.length, '个候选');
      return found;
    }
  };

  /* ============================================================
   * 5. ApiProbe —— 拦截记录 chatIframe 内的 fetch/XHR（只读日志）
   * ============================================================ */
  const ApiProbe = {
    entries: [],
    installed: false,
    _mask(url) {
      try { return String(url).replace(/([?&](?:token|authorization|key)=)[^&]+/gi, '$1***'); }
      catch (e) { return String(url); }
    },
    _record(rec) {
      this.entries.push(Object.assign({ ts: nowISO() }, rec));
      if (this.entries.length > 100) this.entries.shift();
    },
    install() {
      const chatDoc = getChatDoc();
      if (!chatDoc || !chatDoc.defaultView) return false;
      const w = chatDoc.defaultView;
      if (w.__MM_PROBE_PATCHED__) { this.installed = true; return true; }
      // fetch 钩子
      const origFetch = w.fetch;
      w.fetch = function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
        const method = (args[1] && args[1].method) || 'GET';
        const t0 = Date.now();
        return origFetch.apply(this, args).then(
          (res) => { ApiProbe._record({ via: 'fetch', method, url: ApiProbe._mask(url), status: res.status, ms: Date.now() - t0 }); return res; },
          (err) => { ApiProbe._record({ via: 'fetch', method, url: ApiProbe._mask(url), error: String(err) }); throw err; }
        );
      };
      // XHR 钩子
      const OrigXHR = w.XMLHttpRequest;
      const origOpen = OrigXHR.prototype.open;
      const origSend = OrigXHR.prototype.send;
      OrigXHR.prototype.open = function (method, url) {
        this.__mm = { method, url };
        return origOpen.apply(this, arguments);
      };
      OrigXHR.prototype.send = function () {
        const meta = this.__mm;
        const t0 = Date.now();
        if (meta) {
          this.addEventListener('loadend', () => {
            ApiProbe._record({ via: 'xhr', method: meta.method, url: ApiProbe._mask(meta.url), status: this.status, ms: Date.now() - t0 });
          });
        }
        return origSend.apply(this, arguments);
      };
      w.__MM_PROBE_PATCHED__ = true;
      this.installed = true;
      log('info', 'ApiProbe 已挂载（只读记录）');
      return true;
    }
  };

  /* ============================================================
   * 6. Guardian —— 行为红线守卫
   * ============================================================ */
  const Guardian = {
    forbidden: /(pay|wallet|recharge|charge|account|password|passwd|captcha|verify-code|login-out|logout)/i,
    audit: [],
    opTimes: [],
    check(text, kind) {
      if (this.forbidden.test(text)) {
        this.audit.push({ ts: nowISO(), action: 'BLOCK', kind, detail: text.slice(0, 120) });
        log('error', '守卫拦截(' + kind + '):', text.slice(0, 80));
        return { ok: false, reason: '触及禁区（支付/账号/验证码等敏感区域）' };
      }
      const t = Date.now();
      this.opTimes = this.opTimes.filter(x => t - x < 60000);
      if (this.opTimes.length >= CONFIG.maxOpsPerMinute) {
        this.audit.push({ ts: nowISO(), action: 'RATE_LIMIT', kind, detail: text.slice(0, 120) });
        return { ok: false, reason: '触发限流（每分钟 ' + CONFIG.maxOpsPerMinute + ' 次操作上限）' };
      }
      this.opTimes.push(t);
      this.audit.push({ ts: nowISO(), action: 'PASS', kind, detail: text.slice(0, 120) });
      return { ok: true };
    }
  };

  /* ============================================================
   * 7. SnapshotEngine + InjectEngine —— 追加式快照链与 CSS 注入
   * ============================================================ */
  const SnapshotEngine = {
    commits: [],
    init() {
      try {
        const raw = localStorage.getItem(CONFIG.commitStorageKey);
        if (raw) this.commits = JSON.parse(raw);
      } catch (e) { this.commits = []; }
    },
    persist() {
      try {
        const arr = this.commits.slice(-CONFIG.maxStoredCommits);
        localStorage.setItem(CONFIG.commitStorageKey, JSON.stringify(arr));
      } catch (e) { log('error', '快照持久化失败:', e); }
    },
    add(commit) {
      this.commits.push(commit);
      this.persist();
    },
    list() { return this.commits.slice().reverse(); }
  };

  const InjectEngine = {
    styleNodes: new Map(), // areaKey -> <style>

    /** 注入/替换某区域的 CSS，生成 commit；before 为替换前内容（null=新增） */
    applyCss(areaKey, cssText, note) {
      const guard = Guardian.check(cssText + ' ' + areaKey + ' ' + (note || ''), 'css-inject');
      if (!guard.ok) return { ok: false, reason: guard.reason };
      const chatDoc = getChatDoc();
      if (!chatDoc) return { ok: false, reason: 'chatIframe 不可达' };

      let node = this.styleNodes.get(areaKey);
      const before = node ? node.textContent : null;
      if (!node) {
        node = chatDoc.createElement('style');
        node.setAttribute('data-mm-agent', 'area-' + areaKey);
        (chatDoc.head || chatDoc.documentElement).appendChild(node);
        this.styleNodes.set(areaKey, node);
      }
      node.textContent = cssText;

      const commit = {
        id: uid(), ts: nowISO(), type: 'css', area: areaKey,
        note: note || '', before, after: cssText, reverted: false
      };
      SnapshotEngine.add(commit);
      log('info', 'CSS 已应用 →', areaKey, '(commit ' + commit.id + ')');
      Panel.renderCommits();
      return { ok: true, commit };
    },

    /** 回滚某 commit：恢复 before 内容（null=移除样式节点） */
    rollback(commitId) {
      const commit = SnapshotEngine.commits.find(c => c.id === commitId);
      if (!commit || commit.type !== 'css') return { ok: false, reason: '非 CSS 类型或不存在' };
      const node = this.styleNodes.get(commit.area);
      if (node) {
        if (commit.before === null) {
          node.remove();
          this.styleNodes.delete(commit.area);
        } else {
          node.textContent = commit.before;
        }
      }
      commit.reverted = true;
      SnapshotEngine.persist();
      log('info', '已回滚 commit', commitId);
      Panel.renderCommits();
      return { ok: true };
    },

    /** 高亮定位区域元素（闪烁描边） */
    locate(areaKey) {
      const hit = resolveRegion(areaKey);
      if (!hit) return false;
      const el = hit.el;
      const prev = el.style.outline;
      el.style.outline = '3px solid #c084fc';
      el.style.outlineOffset = '2px';
      el.scrollIntoView && el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => { el.style.outline = prev || ''; }, 1500);
      return true;
    }
  };

  /* ============================================================
   * 8. Panel —— 控制面 UI（顶层文档，独立于站点渲染管线）
   * ============================================================ */
  const Panel = {
    root: null,
    tab: 'overview',

    build() {
      const doc = document;
      const style = doc.createElement('style');
      style.textContent = `
        #mm-panel{position:fixed;top:12px;right:12px;width:340px;max-height:86vh;z-index:2147483647;
          background:#16121f;color:#e9e2f5;font:12px/1.5 "Segoe UI",system-ui,sans-serif;
          border:1px solid #3d2f5c;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);
          display:flex;flex-direction:column;overflow:hidden}
        #mm-panel header{padding:8px 12px;background:#221a36;display:flex;align-items:center;gap:8px;cursor:move}
        #mm-panel header b{font-size:13px;color:#c084fc}
        #mm-panel .tabs{display:flex;border-bottom:1px solid #3d2f5c}
        #mm-panel .tabs span{flex:1;text-align:center;padding:6px 0;cursor:pointer;color:#9b8fb8}
        #mm-panel .tabs span.on{color:#c084fc;border-bottom:2px solid #c084fc;background:#1d1730}
        #mm-panel .body{padding:10px 12px;overflow:auto;flex:1}
        #mm-panel .row{margin:4px 0;word-break:break-all}
        #mm-panel .ok{color:#7dd68a} #mm-panel .warn{color:#e8c268} #mm-panel .err{color:#ef7d7d}
        #mm-panel button{background:#3d2f5c;color:#e9e2f5;border:0;border-radius:6px;padding:3px 8px;cursor:pointer;margin:2px 2px 2px 0;font-size:11px}
        #mm-panel button:hover{background:#57428a}
        #mm-panel textarea{width:100%;height:90px;background:#0e0b16;color:#e9e2f5;border:1px solid #3d2f5c;border-radius:6px;font:11px/1.4 Consolas,monospace;padding:6px;box-sizing:border-box}
        #mm-panel select{background:#0e0b16;color:#e9e2f5;border:1px solid #3d2f5c;border-radius:6px;padding:3px}
        #mm-panel .commit{border:1px solid #3d2f5c;border-radius:8px;padding:6px 8px;margin:6px 0;background:#1d1730}
        #mm-panel .commit .meta{color:#9b8fb8}
        #mm-panel pre{background:#0e0b16;border-radius:6px;padding:6px;margin:4px 0;white-space:pre-wrap;max-height:120px;overflow:auto;font-size:10px}
        #mm-panel .del{background:#5c2f3d;color:#ffd9d9}
        #mm-panel table{width:100%;border-collapse:collapse;font-size:11px}
        #mm-panel td,#mm-panel th{border-bottom:1px solid #2c2244;padding:3px 4px;text-align:left;word-break:break-all}
        #mm-panel .toggle{margin-left:auto;cursor:pointer;color:#9b8fb8}`;
      doc.head.appendChild(style);

      const root = doc.createElement('div');
      root.id = 'mm-panel';
      root.innerHTML = `
        <header><b>魅魔Agent</b><span style="color:#9b8fb8">PoC v0.1</span><span class="toggle" id="mm-toggle">—</span></header>
        <div class="tabs">
          <span data-tab="overview" class="on">概览</span>
          <span data-tab="regions">区域</span>
          <span data-tab="probe">探测</span>
          <span data-tab="commits">快照</span>
          <span data-tab="inject">注入</span>
          <span data-tab="loader">装载</span>
        </div>
        <div class="body" id="mm-body"></div>`;
      doc.body.appendChild(root);
      this.root = root;

      root.querySelector('.tabs').addEventListener('click', (e) => {
        const tab = e.target && e.target.dataset && e.target.dataset.tab;
        if (!tab) return;
        this.tab = tab;
        root.querySelectorAll('.tabs span').forEach(s => s.classList.toggle('on', s.dataset.tab === tab));
        this.render();
      });
      root.querySelector('#mm-toggle').addEventListener('click', () => {
        const body = root.querySelector('.body');
        const tabs = root.querySelector('.tabs');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        tabs.style.display = hidden ? '' : 'none';
      });
      this.render();
    },

    render() {
      const body = this.root.querySelector('#mm-body');
      if (this.tab === 'overview') this.renderOverview(body);
      else if (this.tab === 'regions') this.renderRegions(body);
      else if (this.tab === 'probe') this.renderProbe(body);
      else if (this.tab === 'commits') { body.innerHTML = ''; this.commitsBody = body; this.renderCommits(); }
      else if (this.tab === 'inject') this.renderInject(body);
      else if (this.tab === 'loader') this.renderLoader(body);
    },

    renderOverview(body) {
      const chatDoc = getChatDoc();
      const tokens = TokenProbe.result || [];
      body.innerHTML = `
        <div class="row">chatIframe: <span class="${chatDoc ? 'ok' : 'err'}">${chatDoc ? '可达' : '不可达'}</span></div>
        <div class="row">同源桥: <span class="${MiddleLayer.status.bridge === 'ok' ? 'ok' : 'warn'}">${MiddleLayer.status.bridge}</span></div>
        <div class="row">opaque 执行域: <span class="${MiddleLayer.status.executor === 'ok' ? 'ok' : 'warn'}">${MiddleLayer.status.executor}</span></div>
        <div class="row">ApiProbe: <span class="${ApiProbe.installed ? 'ok' : 'warn'}">${ApiProbe.installed ? '已挂载' : '未挂载'}</span>（只读记录）</div>
        <div class="row">token 候选: <span class="${tokens.length ? 'ok' : 'warn'}">${tokens.length} 个</span></div>
        <div class="row">快照数: ${SnapshotEngine.commits.length}　守卫审计: ${Guardian.audit.length}</div>
        <div class="row" style="color:#9b8fb8">架构：壳控制面 → 同源桥 → opaque 执行域（postMessage+nonce）</div>
        <button id="mm-refresh">刷新探测</button>`;
      body.querySelector('#mm-refresh').onclick = () => { TokenProbe.run(); this.render(); };
    },

    renderRegions(body) {
      let html = '<table><tr><th>区域</th><th>命中</th><th></th></tr>';
      REGISTRY.forEach(r => {
        const hit = resolveRegion(r.key);
        html += `<tr><td>${r.name}<br><span style="color:#9b8fb8;font-size:10px">${r.stability}</span></td>
          <td class="${hit ? 'ok' : 'err'}">${hit ? hit.sel : '未命中'}</td>
          <td><button data-locate="${r.key}">定位</button></td></tr>`;
      });
      html += '</table>';
      body.innerHTML = html;
      body.querySelectorAll('[data-locate]').forEach(b => {
        b.onclick = () => { if (!InjectEngine.locate(b.dataset.locate)) log('error', '定位失败:', b.dataset.locate); };
      });
    },

    renderProbe(body) {
      let html = '<div class="row"><b>API 日志（最近 ' + ApiProbe.entries.length + ' 条）</b></div>';
      if (!ApiProbe.entries.length) html += '<div class="row" style="color:#9b8fb8">暂无记录——在页面上操作产生请求后会出现在这里</div>';
      html += '<table><tr><th>方式</th><th>方法</th><th>URL</th><th>状态</th></tr>';
      ApiProbe.entries.slice(-20).reverse().forEach(e => {
        html += `<tr><td>${e.via}</td><td>${e.method || '-'}</td><td>${e.url || ''}</td><td>${e.status || e.error || ''}</td></tr>`;
      });
      html += '</table>';
      body.innerHTML = html;
    },

    renderCommits() {
      const body = this.commitsBody;
      if (!body) return;
      const list = SnapshotEngine.list();
      if (!list.length) { body.innerHTML = '<div class="row" style="color:#9b8fb8">暂无修改记录</div>'; return; }
      body.innerHTML = '';
      list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'commit';
        div.innerHTML = `
          <div><b>${c.area}</b> <span class="meta">${c.type} · ${c.ts.slice(11, 19)}${c.reverted ? ' · 已回滚' : ''}</span></div>
          ${c.note ? '<div class="meta">备注: ' + c.note + '</div>' : ''}
          <div class="meta">— 修改前 —</div><pre>${c.before === null ? '(无)' : escapeHtml(c.before)}</pre>
          <div class="meta">+ 修改后 —</div><pre>${escapeHtml(c.after)}</pre>
          ${c.reverted ? '' : '<button class="del" data-rollback="' + c.id + '">回滚此修改</button>'}`;
        const btn = div.querySelector('[data-rollback]');
        if (btn) btn.onclick = () => InjectEngine.rollback(btn.dataset.rollback);
        body.appendChild(div);
      });
    },

    renderInject(body) {
      body.innerHTML = `
        <div class="row">目标区域：
          <select id="mm-area">${REGISTRY.filter(r => r.scope === 'chatIframe').map(r => `<option value="${r.key}">${r.name}</option>`).join('')}</select>
        </div>
        <div class="row">CSS（直接作用于所选区域类，示例 .chat-body .item.Ai { ... }）</div>
        <textarea id="mm-css" spellcheck="false" placeholder=".item.Ai .content.left {\n  background: rgba(120,60,200,.25);\n  border-radius: 12px;\n}"></textarea>
        <div class="row"><input id="mm-note" placeholder="修改备注（可选）" style="width:100%;background:#0e0b16;color:#e9e2f5;border:1px solid #3d2f5c;border-radius:6px;padding:4px;box-sizing:border-box"></div>
        <button id="mm-apply">应用（生成快照）</button>
        <div class="row" id="mm-inject-msg"></div>`;
      body.querySelector('#mm-apply').onclick = () => {
        const area = body.querySelector('#mm-area').value;
        const css = body.querySelector('#mm-css').value.trim();
        const note = body.querySelector('#mm-note').value.trim();
        const msg = body.querySelector('#mm-inject-msg');
        if (!css) { msg.innerHTML = '<span class="warn">请输入 CSS</span>'; return; }
        const r = InjectEngine.applyCss(area, css, note);
        msg.innerHTML = r.ok ? '<span class="ok">已应用，commit ' + r.commit.id + '</span>' : '<span class="err">' + r.reason + '</span>';
      };
    },

    renderLoader(body) {
      const loadedList = (window.MMLoader && window.MMLoader.loaded()) || [];
      let listHtml = loadedList.length
        ? loadedList.map(e => '<div class="row">📦 ' + escapeHtml(e.pkg) + ' <button data-unload="' + escapeHtml(e.pkg) + '">卸载</button></div>').join('')
        : '<div class="row" style="color:#9b8fb8">尚未装载任何美化包</div>';
      body.innerHTML = `
        <div class="row"><b>美化包装载（角色卡功能栏包 → 程序直注）</b></div>
        <div class="row"><input type="file" id="mm-pkg-file" accept=".json" style="color:#9b8fb8;font-size:11px"></div>
        <button id="mm-pkg-load">装载选中 JSON</button>
        <div class="row" id="mm-pkg-msg"></div>
        <div class="row" style="margin-top:8px"><b>已装载</b></div>${listHtml}
        <div class="row" style="color:#9b8fb8;font-size:10px">原理：解析 regex_scripts 包 → 剥离分节标记 → 按序注入 chatIframe（CSS/JS），全程记录快照</div>`;
      body.querySelector('#mm-pkg-load').onclick = () => {
        const msg = body.querySelector('#mm-pkg-msg');
        const fileInput = body.querySelector('#mm-pkg-file');
        if (!fileInput.files || !fileInput.files[0]) { msg.innerHTML = '<span class="warn">请先选择 JSON 文件</span>'; return; }
        if (!window.MMLoader) { msg.innerHTML = '<span class="err">MMLoader 未加载（需先注入 loader.js）</span>'; return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const r = window.MMLoader.loadPackage(reader.result);
            msg.innerHTML = r.ok
              ? '<span class="ok">已装载：注入 ' + r.injected.length + ' 项</span>'
              : '<span class="err">' + r.reason + '</span>';
            if (r.ok) setTimeout(() => Panel.render(), 300);
          } catch (e) {
            msg.innerHTML = '<span class="err">解析失败: ' + escapeHtml(e.message) + '</span>';
          }
        };
        reader.readAsText(fileInput.files[0], 'utf-8');
      };
      body.querySelectorAll('[data-unload]').forEach(b => {
        b.onclick = () => { window.MMLoader.unloadPackage(b.dataset.unload); Panel.render(); };
      });
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ============================================================
   * 9. 自检（供 mock 页/测试用）
   * ============================================================ */
  async function selfTest() {
    const report = { ts: nowISO(), registryHits: {} };
    // 区域命中
    REGISTRY.forEach(r => { report.registryHits[r.key] = !!resolveRegion(r.key); });
    // ocs 三层
    report.bridge = MiddleLayer.status.bridge;
    try {
      const ping = await MiddleLayer.pingExecutor();
      report.executor = ping.ok ? 'ok' : 'fail';
      report.executorOpaque = ping.opaque;
    } catch (e) { report.executor = 'fail:' + e.message; }
    // token / probe
    report.tokens = (TokenProbe.result || []).length;
    report.apiProbe = ApiProbe.installed;
    // CSS 往返：注入 → 校验 → 回滚
    const r = InjectEngine.applyCss('msg_list', '#msglistview{outline:1px dashed #c084fc}', 'selftest');
    report.cssRoundtrip = 'fail';
    if (r.ok) {
      const node = InjectEngine.styleNodes.get('msg_list');
      const applied = node && node.textContent.indexOf('outline') >= 0;
      const rb = InjectEngine.rollback(r.commit.id);
      report.cssRoundtrip = applied && rb.ok ? 'ok' : 'fail';
    }
    report.commits = SnapshotEngine.commits.length;
    log('info', 'selfTest:', JSON.stringify(report));
    return report;
  }

  /* ============================================================
   * 10. 启动
   * ============================================================ */
  async function boot() {
    log('info', '启动 @', location.href);
    SnapshotEngine.init();
    // 等 chatIframe 就绪（最多 15s）
    let waited = 0;
    while (!getChatDoc() && waited < 15000) { await new Promise(r => setTimeout(r, 500)); waited += 500; }
    if (getChatDoc()) {
      ApiProbe.install();
      TokenProbe.run();
    } else {
      log('error', 'chatIframe 未找到，部分功能降级');
    }
    try { await MiddleLayer.init(); } catch (e) { log('error', 'MiddleLayer 初始化失败:', e.message); }
    Panel.build();
  }

  // 对外 API（控制台/自动化可用）
  window.MMAgent = {
    CONFIG, REGISTRY, boot, selfTest,
    resolveRegion, getChatDoc,
    bus, MiddleLayer, TokenProbe, ApiProbe, Guardian,
    SnapshotEngine, InjectEngine, Panel,
    applyCss: (area, css, note) => InjectEngine.applyCss(area, css, note),
    rollback: (id) => InjectEngine.rollback(id),
    locate: (key) => InjectEngine.locate(key),
    apiFetch: (url, opts) => MiddleLayer.apiFetch(url, opts),
    logs: () => logs.slice()
  };

  boot();
})();
