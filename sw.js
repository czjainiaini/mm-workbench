/* 拦截沙盒页面内所有指向 sexyai.ai 的请求（绝对地址），改道到本地同源
 * （整端口镜像模式下直接用当前源的同名路径，无需前缀）。 */
const TARGET_HOSTS = ['sexyai.ai', 'www.sexyai.ai'];
// 站点 JS 会用 location.host 动态拼 CDN 域名，沙盒内会变成 *.localhost → 映射回真实 CDN
const HOST_MAP = {
  'r2.localhost': 'https://r2.meimoai13.com'
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  let u;
  try { u = new URL(e.request.url); } catch (err) { return; }

  // CDN host 映射：直连真实 CDN（公开静态资源）
  if (HOST_MAP[u.hostname]) {
    const fixed = HOST_MAP[u.hostname] + u.pathname + u.search;
    e.respondWith(fetch(fixed).catch((err) => new Response('cdn fetch failed: ' + err, { status: 502 })));
    return;
  }

  if (!TARGET_HOSTS.includes(u.hostname)) return;

  // 整端口镜像：同源同路径即是站点镜像
  const proxied = new URL(u.pathname + u.search, self.location.origin);
  e.respondWith((async () => {
    try {
      const req = new Request(proxied, {
        method: e.request.method,
        headers: e.request.headers,
        body: e.request.body,
        credentials: 'include',
        redirect: 'follow'
      });
      return await fetch(req);
    } catch (err) {
      // 部分请求头不可复制时降级为简单请求
      try { return await fetch(proxied, { credentials: 'include' }); }
      catch (err2) { return new Response('proxy fetch failed: ' + err2, { status: 502 }); }
    }
  })());
});
