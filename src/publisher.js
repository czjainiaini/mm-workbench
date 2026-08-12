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
  function errorText(error) {
    return error && error.message ? error.message : String(error || '未知错误');
  }
  function savedId(response) {
    var data = response && response.data;
    if (Array.isArray(data)) data = data[0];
    return data && data.id != null ? data.id : null;
  }
  function originalRulePayload(rule, roleId) {
    return {
      id: rule.id,
      roleId: rule.roleId || roleId,
      name: rule.name,
      regex: rule.regex,
      content: rule.content,
      sort: typeof rule.sort === 'number' ? rule.sort : undefined
    };
  }

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

    async saveRoleCard(card) {
      var merged = Object.assign({}, card);
      if (!merged.categoryId) merged.categoryId = 1;
      if (!Array.isArray(merged.categoryIds) || !merged.categoryIds.length) merged.categoryIds = [merged.categoryId];
      var response = await post('/api/role/save', merged);
      if (response.code !== 200 && /分类/.test(response.message || '')) {
        var cats = await post('/api/role/category/list', {});
        if (cats.code !== 200) throw new Error('读取角色分类失败: ' + (cats.message || ''));
        var list = Array.isArray(cats.data) ? cats.data : (cats.data && cats.data.list) || [];
        var valid = list.find(function (item) { return item.id != null; });
        if (valid) {
          merged.categoryId = valid.id;
          merged.categoryIds = [valid.id];
          response = await post('/api/role/save', merged);
        }
      }
      if (response.code !== 200) throw new Error('卡片字段保存失败: ' + (response.message || ''));
      return true;
    },

    async rollbackPublication(roleId, journal) {
      var failures = [];
      var restored = 0;
      var removed = 0;
      if (journal.cardAttempted && journal.cardBefore) {
        try {
          var currentCard = await this.queryRole(roleId);
          journal.cardFields.forEach(function (field) {
            currentCard[field] = Object.prototype.hasOwnProperty.call(journal.cardBefore, field)
              ? journal.cardBefore[field]
              : (field === 'pageDepth' ? null : '');
          });
          await this.saveRoleCard(currentCard);
          restored++;
        } catch (error) { failures.push('卡片字段: ' + errorText(error)); }
      }
      for (var index = journal.rules.length - 1; index >= 0; index--) {
        var entry = journal.rules[index];
        try {
          if (entry.before) {
            var restoredRule = await post('/api/role/regexp/save', [originalRulePayload(entry.before, roleId)]);
            if (restoredRule.code !== 200) throw new Error(restoredRule.message || '恢复失败');
            restored++;
          } else {
            var ids = entry.savedId != null ? [entry.savedId] : [];
            if (!ids.length) {
              var currentRules = await this.listRegexp(roleId);
              var beforeIds = journal.beforeIds;
              ids = currentRules.filter(function (rule) {
                return rule.name === entry.name && !beforeIds[String(rule.id)];
              }).map(function (rule) { return rule.id; });
            }
            for (var idIndex = 0; idIndex < ids.length; idIndex++) {
              await this.deleteRegexp(ids[idIndex]);
              removed++;
              await wait(350);
            }
          }
        } catch (error) { failures.push(entry.name + ': ' + errorText(error)); }
        if (index > 0) await wait(350);
      }
      return { ok: failures.length === 0, restored: restored, removed: removed, failures: failures };
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
      roleId = Number(roleId);
      if (!Number.isSafeInteger(roleId) || roleId <= 0) throw new Error('角色 ID 必须是正整数');
      const norm = this.normalizePackage(pkgJson);
      const rules = this.prepareRules(norm, roleId);
      const before = await this.listRegexp(roleId);
      const hasCardFields = !!norm.statusbar || !!norm.beginning || norm.pageDepth != null;
      const cardBefore = hasCardFields ? await this.queryRole(roleId) : null;
      const journal = {
        beforeIds: before.reduce(function (map, rule) { map[String(rule.id)] = true; return map; }, {}),
        rules: [], cardBefore: cardBefore, cardAttempted: false,
        cardFields: ['statusbar', 'beginning', 'pageDepth'].filter(function (field) {
          return field === 'statusbar' ? !!norm.statusbar : field === 'beginning' ? !!norm.beginning : norm.pageDepth != null;
        })
      };
      const results = [];
      let cardUpdated = false;
      try {
        for (const rule of rules) {
          const existed = before.find(function (item) { return item.name === rule.name; });
          const entry = { name: rule.name, before: existed || null, savedId: null };
          journal.rules.push(entry); // 请求超时也可能已落库，先记账再写
          const payload = existed ? Object.assign({ id: existed.id }, rule) : rule;
          const saved = await post('/api/role/regexp/save', [payload]);
          if (saved.code !== 200) throw new Error('保存失败(' + rule.name + '): ' + (saved.message || ''));
          entry.savedId = savedId(saved);
          results.push({ name: rule.name, id: entry.savedId, updated: !!existed });
          await wait(350);
        }
        if (hasCardFields) {
          const merged = Object.assign({}, cardBefore);
          if (norm.statusbar) merged.statusbar = norm.statusbar;
          if (norm.beginning) merged.beginning = norm.beginning;
          if (norm.pageDepth != null) merged.pageDepth = norm.pageDepth;
          journal.cardAttempted = true;
          await this.saveRoleCard(merged);
          cardUpdated = true;
        }
        const after = await this.listRegexp(roleId);
        return { ok: true, rollbackProtected: true, rules: results, cardUpdated: cardUpdated, beforeCount: before.length, afterCount: after.length };
      } catch (error) {
        const rollback = await this.rollbackPublication(roleId, journal);
        const notice = rollback.ok
          ? '；已自动回滚本次写入（恢复 ' + rollback.restored + ' 项，移除 ' + rollback.removed + ' 条新增规则）'
          : '；自动回滚不完整：' + rollback.failures.join('；');
        const wrapped = new Error(errorText(error) + notice);
        wrapped.rollback = rollback;
        throw wrapped;
      }
    }
  };
  console.log('[MMPublish] 发布模块就绪（query/save/regexp list/save/delete 契约已内置）');
})();
