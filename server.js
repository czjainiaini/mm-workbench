/* ============================================================
 * 工作台服务器：静态资源 + sexyai.ai 反向代理沙盒
 * /proxy/*  → https://sexyai.ai/*（剥离防嵌入头、Cookie 适配本地源）
 * 其余路径  → 工作区静态文件
 * ============================================================ */
const http = require('http');
const https = require('https');
const { lookup } = require('dns/promises');
const { readFile } = require('fs/promises');
const { join, resolve, relative, isAbsolute, extname } = require('path');
const { isIP } = require('net');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8793);
const LOOPBACK_HOST = '127.0.0.1';
const TARGET_HOST = 'sexyai.ai';
const MAX_LLM_BODY = 1024 * 1024;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT 必须是 1-65535 的整数');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

/* ---------- 反向代理 ---------- */
function proxyToSite(req, res, targetPath) {
  const headers = Object.assign({}, req.headers);
  headers['host'] = TARGET_HOST;
  delete headers['accept-encoding'];       // 要求未压缩，避免解压处理
  headers['accept-encoding'] = 'identity';

  const preq = https.request({
    hostname: TARGET_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers
  }, (pres) => {
    const out = Object.assign({}, pres.headers);
    // 剥离阻止 iframe 嵌入与脚本限制的头（沙盒内 CSP 实测允许内联）
    delete out['content-security-policy'];
    delete out['content-security-policy-report-only'];
    delete out['x-frame-options'];
    delete out['content-encoding'];
    delete out['content-length'];
    delete out['strict-transport-security'];
    // 重定向改写到代理路径，避免跳出沙盒
    if (out['location']) {
      out['location'] = out['location'].replace(/^https?:\/\/(www\.)?sexyai\.ai/, '');
    }
    // Cookie 适配：去掉 Domain/Secure/SameSite，使其可存于本地 http 源
    if (out['set-cookie']) {
      out['set-cookie'] = out['set-cookie'].map((c) =>
        c.split(';').filter((p) => !/^\s*(domain|secure|samesite)\b/i.test(p)).join(';')
      );
    }
    const isHtml = /text\/html/i.test(pres.headers['content-type'] || '');
    res.writeHead(pres.statusCode, out);
    if (!isHtml) return pres.pipe(res);
    // HTML 响应：自动注入工作台控制桥（每个站点页面都获得实时编辑能力）
    let buf = '';
    pres.setEncoding('utf8');
    pres.on('data', (c) => { buf += c; });
    pres.on('end', () => {
      const inj = '<script src="/wb/wb-bridge.js"></scr' + 'ipt><script src="/wb/src/loader.js"></scr' + 'ipt><script src="/wb/src/publisher.js"></scr' + 'ipt>';
      if (buf.indexOf('</body>') >= 0) buf = buf.replace('</body>', inj + '</body>');
      else buf += inj;
      res.end(buf);
    });
  });

  preq.on('error', (e) => {
    res.statusCode = 502;
    res.end('proxy error: ' + e.message);
  });
  req.pipe(preq);
}

/* ---------- 静态文件（/wb/ 命名空间，找不到时报 404） ---------- */
async function serveStatic(req, res, urlPath) {
  if (urlPath === '/wb' || urlPath === '/wb/') urlPath = '/wb/workbench.html';
  let requestedPath;
  try { requestedPath = decodeURIComponent(urlPath.slice(4)); }
  catch (e) { res.statusCode = 400; return res.end('400'); }
  const filePath = resolve(ROOT, requestedPath); // 去掉 /wb 前缀映射到工作区根
  const relativePath = relative(ROOT, filePath);
  if (relativePath === '..' || relativePath.startsWith('..\\') || relativePath.startsWith('../') || isAbsolute(relativePath)) {
    res.statusCode = 403;
    return res.end('403');
  }
  try {
    const data = await readFile(filePath);
    res.setHeader('Content-Type', TYPES[extname(filePath)] || 'application/octet-stream');
    res.end(data);
  } catch (e) {
    res.statusCode = 404;
    res.end('404: ' + urlPath);
  }
}

/* ---------- LLM 中继（解决浏览器直连模型 API 的 CORS 限制） ---------- */
function isBlockedAddress(address) {
  const normalized = String(address).replace(/^::ffff:/i, '').toLowerCase();
  if (isIP(normalized) === 4) {
    const parts = normalized.split('.').map(Number);
    const a = parts[0]; const b = parts[1];
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224;
  }
  if (isIP(normalized) === 6) {
    return normalized === '::' || normalized === '::1' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      /^fe[89a-f]/.test(normalized) || normalized.startsWith('ff');
  }
  return true;
}

async function resolvePublicTarget(baseUrl) {
  let url;
  try { url = new URL(baseUrl || 'https://api.hunyuan.cloud.tencent.com/v1'); }
  catch (e) { throw new Error('bad baseUrl'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('baseUrl 仅支持无内嵌凭据的 HTTPS 地址');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isBlockedAddress(item.address))) {
    throw new Error('baseUrl 不允许指向本机、私网或保留地址');
  }
  return { url, address: addresses[0] };
}

function pinnedLookup(address) {
  return function (_hostname, _options, callback) {
    callback(null, address.address, address.family);
  };
}

function relayLLM(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('method not allowed');
  }
  let body = '';
  let bodyBytes = 0;
  let bodyTooLarge = false;
  req.on('data', (c) => {
    bodyBytes += c.length;
    if (bodyBytes > MAX_LLM_BODY) {
      bodyTooLarge = true;
      return;
    }
    body += c;
  });
  req.on('end', async () => {
    if (bodyTooLarge) { res.statusCode = 413; return res.end('payload too large'); }
    let cfg;
    try { cfg = JSON.parse(body); } catch (e) { res.statusCode = 400; return res.end('bad json'); }
    let target;
    try { target = await resolvePublicTarget(cfg.baseUrl); }
    catch (e) { res.statusCode = 400; return res.end(e.message); }
    const u = target.url;
    const basePath = u.pathname.replace(/\/$/, '');

    /* 模型列表（OpenAI 兼容 GET /models） */
    if (cfg.action === 'models') {
      const rm = https.request({
        hostname: u.hostname, port: u.port || 443,
        path: basePath + '/models', method: 'GET',
        headers: { 'Authorization': 'Bearer ' + (cfg.apiKey || '') },
        lookup: pinnedLookup(target.address)
      }, (pres) => {
        let out = '';
        pres.setEncoding('utf8');
        pres.on('data', (c) => { out += c; });
        pres.on('end', () => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = pres.statusCode || 502;
          res.end(out);
        });
      });
      rm.on('error', (e) => { res.statusCode = 502; res.end(JSON.stringify({ error: { message: 'models 中继失败: ' + e.message } })); });
      rm.end();
      return;
    }

    const payload = JSON.stringify({
      model: cfg.model || 'hunyuan-lite',
      messages: cfg.messages || [],
      temperature: 0.4,
      max_tokens: 2500
    });
    const r2 = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: basePath + '/chat/completions',
      method: 'POST',
      lookup: pinnedLookup(target.address),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (cfg.apiKey || ''),
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (pres) => {
      let out = '';
      pres.setEncoding('utf8');
      pres.on('data', (c) => { out += c; });
      pres.on('end', () => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.statusCode = pres.statusCode || 502;
        res.end(out);
      });
    });
    r2.on('error', (e) => { res.statusCode = 502; res.end(JSON.stringify({ error: { message: 'LLM 中继失败: ' + e.message } })); });
    r2.write(payload);
    r2.end();
  });
}

http.createServer((req, res) => {
  const noQuery = req.url.split('?')[0];
  if (noQuery === '/wb/api/llm') {
    return relayLLM(req, res);
  }
  if (noQuery === '/sw.js') {
    // SW 必须从根路径注册才能拿到全站拦截作用域
    return readFile(join(ROOT, 'sw.js')).then(
      (data) => { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(data); },
      () => { res.statusCode = 404; res.end('404'); }
    );
  }
  if (noQuery === '/wb' || noQuery.startsWith('/wb/')) {
    return serveStatic(req, res, noQuery);
  }
  // 其余一切路径 = 站点代理（整个端口就是站点沙盒，
  // 保证站点 JS 构建的任何相对/hash 地址都落在代理域内）
  proxyToSite(req, res, req.url);
}).listen(PORT, LOOPBACK_HOST, () => console.log('workbench server @ http://' + LOOPBACK_HOST + ':' + PORT + '  (站点沙盒: /, 工作台: /wb/workbench.html)'));
