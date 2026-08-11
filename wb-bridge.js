/* ============================================================
 * wb-bridge —— 注入到沙盒（代理后的 sexyai.ai）顶层窗口的桥
 * 功能：console 捕获上报工作台 / 实时 CSS、JS 注入 / chatIframe 自动挂钩
 * ============================================================ */
(function () {
  'use strict';
  if (window.__WB_BRIDGE__) return;
  window.__WB_BRIDGE__ = true;

  var TOP = window.parent;

  /* 重要：站点聊天页的 message 处理器存在缺陷（无 token 的 postMessage 会触发
   * “Assignment to constant variable”），因此同源父子窗之间改用直接函数投递，
   * 仅跨源时才降级为 postMessage（发往工作台）。 */
  function send(level, args, src) {
    var text = args.map(function (a) {
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
      return String(a);
    }).join(' ');
    try {
      if (window.parent && window.parent !== window && window.parent.__wb_receive) {
        window.parent.__wb_receive(level, src, text);
        return;
      }
    } catch (e) { /* 跨源不可达，降级 */ }
    try {
      // 仅当父窗是另一窗口（如工作台/壳页）时才投递；顶层页不给自己发
      //（给自己发 postMessage 会被站点 message 处理器捕获并触发报错→转发→报错死循环）
      if (TOP && TOP !== window) {
        TOP.postMessage({ __wb: true, kind: 'console', level: level, src: src, text: text }, '*');
      }
    } catch (e) { /* 忽略 */ }
  }

  /* 相同报错去重：防止 报错→console.error→转发→再报错 的放大环 */
  var __lastErr = '', __lastErrN = 0;
  window.__wb_reportError = function (msg) {
    if (msg === __lastErr) {
      __lastErrN++;
      if (__lastErrN === 5) send('warn', ['[wb] 同一报错已连续 ' + __lastErrN + ' 次，后续静默：' + msg], 'bridge');
      if (__lastErrN > 5) return;
    } else {
      __lastErr = msg; __lastErrN = 1;
    }
    send('error', [msg], 'page');
  };

  /* 接收子窗口（如 chatIframe）的直投日志，再向上转发给工作台 */
  window.__wb_receive = function (level, src, text) {
    send(level, [text], src);
  };

  function hookConsole(w, src) {
    if (!w || w.__wbConsoleHooked) return;
    w.__wbConsoleHooked = true;
    ['log', 'info', 'warn', 'error'].forEach(function (k) {
      var orig = w.console[k];
      w.console[k] = function () {
        send(k, Array.prototype.slice.call(arguments), src);
        orig.apply(w.console, arguments);
      };
    });
    w.addEventListener('error', function (e) {
      var msg = e.message + ' @' + (e.filename || '') + ':' + (e.lineno || '');
      if (w === window && window.__wb_reportError) window.__wb_reportError(msg);
      else send('error', [msg], src);
    });
  }

  hookConsole(window, 'top');

  function chatDoc() {
    var ifr = document.getElementById('chatIframe');
    try { return ifr && ifr.contentDocument; } catch (e) { return null; }
  }
  window.__wb_chatDoc = chatDoc;

  // chatIframe 出现后挂钩其 console
  var iv = setInterval(function () {
    var d = chatDoc();
    if (d && d.defaultView) { hookConsole(d.defaultView, 'chat'); clearInterval(iv); }
  }, 600);
  setTimeout(function () { clearInterval(iv); }, 300000);

  /* ---------- 实时注入接口（带节流保护，防止误操作导致海量节点） ---------- */
  var __cssAt = 0, __cssN = 0, __jsAt = 0, __jsN = 0;
  function throttled(at, n) { // 5 秒内最多 20 次
    var t = Date.now();
    if (t - at > 5000) return { ok: true, at: t, n: 1 };
    if (n >= 20) return { ok: false, at: at, n: n };
    return { ok: true, at: at, n: n + 1 };
  }
  window.__wb_applyCss = function (css) {
    var g = throttled(__cssAt, __cssN); __cssAt = g.at; __cssN = g.n;
    if (!g.ok) { window.__wb_reportError('[wb] CSS 注入过于频繁，已限流（5秒/20次）'); return 0; }
    var targets = [document, chatDoc()].filter(Boolean);
    targets.forEach(function (d) {
      var st = d.getElementById('wb-live-css');
      if (!st) {
        st = d.createElement('style');
        st.id = 'wb-live-css';
      }
      st.textContent = css;
      // 移除重插到 body 末尾：保证排在站点/美化包样式之后（同 !important 时顺序定胜负）
      if (st.parentNode) st.parentNode.removeChild(st);
      (d.body || d.head || d.documentElement).appendChild(st);
    });
    return targets.length;
  };

  window.__wb_applyJs = function (code) {
    var g = throttled(__jsAt, __jsN); __jsAt = g.at; __jsN = g.n;
    if (!g.ok) { window.__wb_reportError('[wb] JS 注入过于频繁，已限流（5秒/20次）'); return false; }
    var d = chatDoc() || document;
    var sc = d.createElement('script');
    sc.textContent = code;
    (d.body || d.head || d.documentElement).appendChild(sc);
    return true;
  };

  window.__wb_clearCss = function () {
    [document, chatDoc()].filter(Boolean).forEach(function (d) {
      var st = d.getElementById('wb-live-css');
      if (st) st.textContent = '';
    });
    return true;
  };

  send('info', ['wb-bridge 已注入沙盒'], 'bridge');
})();
