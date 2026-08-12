'use strict';

const assert = require('assert').strict;
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const { readFileSync, mkdtempSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const ROOT = join(__dirname, '..');
const HOST = '127.0.0.1';

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function request(port, path, options) {
  const cfg = options || {};
  const payload = cfg.body == null ? null : Buffer.from(String(cfg.body));
  const headers = Object.assign({ Connection: 'close' }, cfg.headers || {});
  if (payload && headers['Content-Length'] == null) headers['Content-Length'] = payload.length;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port, path, method: cfg.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(4000, () => req.destroy(new Error('request timeout: ' + path)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('server startup timeout\n' + output)), 6000);
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes('workbench server @')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', code => {
      if (!output.includes('workbench server @')) {
        clearTimeout(timer);
        reject(new Error('server exited early (' + code + ')\n' + output));
      }
    });
  });
}

function verifySource() {
  const jsFiles = ['server.js', 'wb-bridge.js', 'sw.js', 'src/loader.js', 'src/publisher.js', 'src/project-studio.js', 'src/style-registry.js', 'src/mm-agent.user.js'];
  jsFiles.forEach((file) => {
    const result = spawnSync(process.execPath, ['--check', join(ROOT, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, file + ' syntax error:\n' + result.stderr);
  });
  const registryCheck = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-registry.js'), '--check'], { encoding: 'utf8' });
  assert.equal(registryCheck.status, 0, 'style registry must be reproducible from tracked sources:\n' + registryCheck.stdout + registryCheck.stderr);

  const html = readFileSync(join(ROOT, 'workbench.html'), 'utf8');
  const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1]).filter(Boolean);
  scripts.forEach((source, index) => assert.doesNotThrow(() => new Function(source), 'inline script ' + index + ' should compile'));

  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const ids = Array.from(markup.matchAll(/\sid="([^"]+)"/g), match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(Array.from(new Set(duplicates)), [], 'HTML ids should be unique');
  ['wb-theme', 'btn-style-undo', 'btn-style-redo', 'btn-style-compare', 'ob-action', 'data-ob-palette', 'view-project', 'llm-context', 'llm-auto-summary', 'llm-memory-details', 'wb-chat-sessions', 'memory.turns'].forEach(token => {
    assert.ok(html.includes(token), 'workbench should include ' + token);
  });
  assert.ok(html.includes('真站·聊天页（推荐）'), 'real chat page should be the recommended mode');
  assert.ok(html.includes('Workbench v0.6.1'), 'workbench release marker should be v0.6.1');
  assert.ok(!html.includes('本地复刻·离线（推荐）'), 'incomplete local clone must not be recommended');
  assert.ok(html.includes('/wb/api/llm-secret'), 'LLM secrets should use the local server vault');
  assert.ok(!html.includes('baseUrl: cfg.baseUrl, apiKey: cfg.apiKey'), 'LLM requests must not serialize API keys');
}

function loadPublisher(fetchImpl) {
  const source = readFileSync(join(ROOT, 'src', 'publisher.js'), 'utf8');
  const factory = new Function('window', 'fetch', 'console', 'setTimeout', source + '\nreturn window.MMPublish;');
  return factory({}, fetchImpl, { log() {} }, (fn) => { fn(); return 0; });
}

function mockResponse(value) {
  return Promise.resolve({ json: () => Promise.resolve(value) });
}

async function verifyPublisherRollback() {
  const pkg = (scripts, extra) => JSON.stringify(Object.assign({ regex_scripts: scripts }, extra || {}));
  const existing = { id: 1, roleId: 7, name: '已有规则', regex: 'old', content: 'before', sort: 1 };
  let rules = [Object.assign({}, existing)];
  const publisher = loadPublisher((url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/regexp/list')) return mockResponse({ code: 200, data: rules.map((rule) => Object.assign({}, rule)) });
    if (url.endsWith('/regexp/save')) {
      const rule = body[0];
      if (rule.name === '新增失败') return mockResponse({ code: 500, message: '模拟失败' });
      const index = rules.findIndex((item) => item.id === rule.id);
      if (index >= 0) rules[index] = Object.assign({}, rule);
      else rules.push(Object.assign({ id: 20 }, rule));
      return mockResponse({ code: 200, data: { id: rule.id || 20 } });
    }
    if (url.endsWith('/regexp/delete')) {
      rules = rules.filter((rule) => rule.id !== body.id);
      return mockResponse({ code: 200 });
    }
    throw new Error('unexpected publisher URL: ' + url);
  });
  await assert.rejects(
    publisher.publishPackage(pkg([
      { scriptName: '已有规则', findRegex: 'new', replaceString: 'after' },
      { scriptName: '新增失败', findRegex: 'x', replaceString: 'x' }
    ]), 7),
    /已自动回滚/
  );
  assert.deepEqual(rules, [existing], 'failed multi-rule publish should restore updated rules');

  rules = [];
  let card = { id: 7, categoryId: 2, categoryIds: [2], statusbar: 'before', beginning: 'hello', pageDepth: 1 };
  let cardSaveCalls = 0;
  const publisherWithCard = loadPublisher((url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/regexp/list')) return mockResponse({ code: 200, data: rules.map((rule) => Object.assign({}, rule)) });
    if (url.endsWith('/regexp/save')) {
      const rule = Object.assign({ id: 30 }, body[0]);
      rules.push(rule);
      return mockResponse({ code: 200, data: { id: 30 } });
    }
    if (url.endsWith('/regexp/delete')) {
      rules = rules.filter((rule) => rule.id !== body.id);
      return mockResponse({ code: 200 });
    }
    if (url.endsWith('/role/query')) return mockResponse({ code: 200, data: Object.assign({}, card) });
    if (url.endsWith('/role/save')) {
      cardSaveCalls++;
      if (cardSaveCalls === 1) return mockResponse({ code: 500, message: '模拟卡片保存失败' });
      card = Object.assign({}, body);
      return mockResponse({ code: 200 });
    }
    throw new Error('unexpected publisher URL: ' + url);
  });
  await assert.rejects(
    publisherWithCard.publishPackage(pkg([
      { scriptName: '新增规则', findRegex: 'x', replaceString: 'x' }
    ], { statusbar: 'after' }), 7),
    /已自动回滚/
  );
  assert.deepEqual(rules, [], 'failed card update should remove newly created rules');
  assert.equal(card.statusbar, 'before', 'failed card update should restore original card fields');
}

async function main() {
  verifySource();
  await verifyPublisherRollback();
  const port = await reservePort();
  const privateDir = mkdtempSync(join(tmpdir(), 'mm-workbench-smoke-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(port), WB_PRIVATE_DIR: privateDir }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(child);

    const page = await request(port, '/wb/workbench.html', { headers: { Origin: 'https://attacker.invalid' } });
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'] || '', /^text\/html/);
    assert.equal(page.headers['access-control-allow-origin'], undefined);
    assert.ok(page.body.includes('魅魔工作台'));

    const svg = await request(port, '/wb/mock/site-assets/ico_aihelp.svg');
    assert.equal(svg.status, 200);
    assert.match(svg.headers['content-type'] || '', /^image\/svg\+xml/);

    const projectStudio = await request(port, '/wb/src/project-studio.js');
    assert.equal(projectStudio.status, 200);
    assert.match(projectStudio.headers['content-type'] || '', /javascript/);
    assert.ok(projectStudio.body.includes('wb-project-snapshots'));

    assert.equal((await request(port, '/wb/not-found.txt')).status, 404);
    assert.equal((await request(port, '/wb/%2e%2e/server.js')).status, 403);
    assert.equal((await request(port, '/wb/.mm-workbench-private/llm-secrets.json')).status, 403);

    const emptySecret = await request(port, '/wb/api/llm-secret');
    assert.equal(emptySecret.status, 200);
    assert.deepEqual(JSON.parse(emptySecret.body), { hasCurrent: false, profileIds: [] });

    const savedSecret = await request(port, '/wb/api/llm-secret', {
      method: 'PUT', body: JSON.stringify({ apiKey: 'smoke-secret' }), headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(savedSecret.status, 200);
    assert.equal(JSON.parse(savedSecret.body).hasCurrent, true);
    assert.ok(!savedSecret.body.includes('smoke-secret'), 'secret endpoint must never echo API keys');

    const badProfile = await request(port, '/wb/api/llm-secret', {
      method: 'PUT', body: JSON.stringify({ profileId: '__proto__', apiKey: 'x' }), headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(badProfile.status, 400);

    const wrongMethod = await request(port, '/wb/api/llm');
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.allow, 'POST');

    const badJson = await request(port, '/wb/api/llm', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
    assert.equal(badJson.status, 400);

    const leakedKey = await request(port, '/wb/api/llm', {
      method: 'POST', body: JSON.stringify({ apiKey: 'must-not-travel', baseUrl: 'https://example.com/v1' }), headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(leakedKey.status, 400);
    assert.match(leakedKey.body, /禁止随模型请求传输/);

    const privateTarget = await request(port, '/wb/api/llm', {
      method: 'POST',
      body: JSON.stringify({ baseUrl: 'https://127.0.0.1/v1', messages: [] }),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(privateTarget.status, 400);
    assert.match(privateTarget.body, /不允许指向本机|私网|保留地址/);

    console.log('✓ syntax, markup, static assets and local security boundaries passed');
  } finally {
    child.kill();
    rmSync(privateDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
