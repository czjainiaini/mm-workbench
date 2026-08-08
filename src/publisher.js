/* ============================================================
 * MMPublish —— 工作台 → 角色卡一键发布模块
 * 契约（2026-08-05 实测）：
 *   POST /api/role/query          {id}                → 读取整卡
 *   POST /api/role/save           {整卡对象}           → 全量保存（必填 roleDesc/personality 等）
 *   POST /api/role/regexp/list    {roleId}            → 正则规则列表
 *   POST /api/role/regexp/save    [Regexp]            → 追加/upsert（带 id=更新，不带=新增；空数组被拒）
 *   POST /api/role/regexp/delete  {id}                → 删除单条规则
 *   Regexp = {id?, roleId, name(≤20), regex(≤1000), content(≤20000), sort?}
 *   站点风控：429=操作过快；403=内容审核拦截
 * ============================================================ */
(function () {
  'use strict';
  if (window.__MM_PUBLISHER__) return;
  window.__MM_PUBLISHER__ = true;

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.MMPublish = {
    LIMITS: { name: 20, regex: 1000, content: 20000 },

    async queryRole(id) {
      const r = await post('/api/role/query', { id: id });
      if (r.code !== 200 || !r.data) throw new Error('读取角色卡失败: ' + (r.message || ''));
      return r.data;
    },

    async listRegexp(roleId) {
      const r = await post('/api/role/regexp/list', { roleId: roleId });
      if (r.code !== 200) throw new Error('读取正则列表失败: ' + (r.message || ''));
      return Array.isArray(r.data) ? r.data : [];
    },

    async deleteRegexp(id) {
      const r = await post('/api/role/regexp/delete', { id: id });
      if (r.code !== 200) throw new Error('删除规则失败: ' + (r.message || ''));
      return true;
    },

    /**
     * 归一化两种导出格式（参考 github.com/yofengi/tavern-mmd 交付规范）：
     *   格式A：MMD 导入 JSON（pageDepth/statusbar/beginning/regex_scripts 四字段）
     *   格式B：本地酒馆正则 JSON（纯数组，含 placement/markdownOnly 等全字段；
     *          或角色卡内嵌 data.extensions.regex_scripts）
     */
    normalizePackage(pkgJson) {
      const pkg = typeof pkgJson === 'string' ? JSON.parse(pkgJson) : pkgJson;
      if (pkg && Array.isArray(pkg.regex_scripts)) {
        return {
          statusbar: pkg.statusbar, beginning: pkg.beginning, pageDepth: pkg.pageDepth,
          scripts: pkg.regex_scripts.map(function (s) {
            return { scriptName: s.scriptName, findRegex: s.findRegex, replaceString: s.replaceString };
          })
        };
      }
      let arr = null;
      if (Array.isArray(pkg)) arr = pkg;
      else if (pkg && pkg.data && pkg.data.extensions && Array.isArray(pkg.data.extensions.regex_scripts)) arr = pkg.data.extensions.regex_scripts;
      if (arr) {
        return {
          statusbar: undefined, beginning: undefined, pageDepth: undefined,
          scripts: arr.filter(function (s) { return !s.disabled; }).map(function (s) {
            return { scriptName: s.scriptName || '未命名规则', findRegex: s.findRegex, replaceString: s.replaceString };
          })
        };
      }
      throw new Error('无法识别的包格式：支持 MMD 导入 JSON / SillyTavern 正则数组 / 卡内嵌 regex_scripts');
    },

    /** 校验并规范化包内规则 */
    prepareRules(norm, roleId) {
      const scripts = norm.scripts || [];
      if (!scripts.length) return [];
      if (scripts.length > 130) throw new Error('规则超出平台上限: ' + scripts.length + '/130');
      return scripts.map(function (s) {
        const rule = {
          roleId: roleId,
          name: String(s.scriptName || '').trim() || '未命名规则',
          regex: String(s.findRegex || ''),
          content: String(s.replaceString || ''),
          sort: typeof s.sort === 'number' ? s.sort : undefined
        };
        if (rule.name.length > 20) throw new Error('规则名超长(≤20): ' + rule.name);
        if (rule.regex.length > 1000) throw new Error('正则超长(≤1000): ' + rule.name);
        if (rule.content.length > 20000) throw new Error('替换内容超长(≤20000): ' + rule.name);
        try { new RegExp(rule.regex); } catch (e) { throw new Error('正则无效(' + rule.name + '): ' + e.message); }
        return rule;
      });
    },

    /**
     * 一键发布功能栏导出包 → 角色卡
     * 规则：同名 upsert、其余追加（接口语义实测为追加式，不会误删已有规则）
     * 卡片字段（statusbar/beginning/pageDepth）：整卡 query→merge→save
     */
    async publishPackage(pkgJson, roleId) {
      const norm = this.normalizePackage(pkgJson);
      const rules = this.prepareRules(norm, roleId);
      const before = await this.listRegexp(roleId);
      const results = [];
      for (const rule of rules) {
        const existed = before.find(function (b) { return b.name === rule.name; });
        const payload = existed ? Object.assign({ id: existed.id }, rule) : rule;
        const s = await post('/api/role/regexp/save', [payload]);
        if (s.code !== 200) throw new Error('保存失败(' + rule.name + '): ' + (s.message || ''));
        results.push({ name: rule.name, id: s.data && s.data.id, updated: !!existed });
        await wait(350); // 防 429
      }
      let cardUpdated = false;
      const hasCardFields = !!norm.statusbar || !!norm.beginning || norm.pageDepth != null;
      if (hasCardFields) {
        const card = await this.queryRole(roleId);
        const merged = Object.assign({}, card);
        // 分类兑底：实测卡片 categoryId=0 会被服务端拒（角色分类不存在）
        if (!merged.categoryId) merged.categoryId = 1;
        if (!Array.isArray(merged.categoryIds) || !merged.categoryIds.length) merged.categoryIds = [merged.categoryId];
        // 仅写入非空值：避免把卡的开场白/状态栏模板误清空
        if (norm.statusbar) merged.statusbar = norm.statusbar;
        if (norm.beginning) merged.beginning = norm.beginning;
        if (norm.pageDepth != null) merged.pageDepth = norm.pageDepth;
        let s2 = await post('/api/role/save', merged);
        // 分类兑底：分类 ID 不连续（实测无 1），报错时动态取有效分类重试
        if (s2.code !== 200 && /分类/.test(s2.message || '')) {
          const cats = await post('/api/role/category/list', {});
          const arr = Array.isArray(cats.data) ? cats.data : (cats.data && cats.data.list) || [];
          const valid = arr.find(function (c) { return c.id != null; });
          if (valid) {
            merged.categoryId = valid.id;
            merged.categoryIds = [valid.id];
            s2 = await post('/api/role/save', merged);
          }
        }
        if (s2.code !== 200) throw new Error('卡片字段保存失败: ' + (s2.message || ''));
        cardUpdated = true;
      }
      const after = await this.listRegexp(roleId);
      return { ok: true, rules: results, cardUpdated: cardUpdated, beforeCount: before.length, afterCount: after.length };
    }
  };
  console.log('[MMPublish] 发布模块就绪（query/save/regexp list/save/delete 契约已内置）');
})();
