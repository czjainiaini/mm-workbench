'use strict';

const assert = require('assert').strict;
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const { readFileSync } = require('fs');
const { join } = require('path');

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
  assert.ok(!html.includes('本地复刻·离线（推荐）'), 'incomplete local clone must not be recommended');
}

async function main() {
  verifySource();
  const port = await reservePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(port) }),
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

    const wrongMethod = await request(port, '/wb/api/llm');
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.allow, 'POST');

    const badJson = await request(port, '/wb/api/llm', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
    assert.equal(badJson.status, 400);

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
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
