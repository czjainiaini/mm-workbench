/* 全位置样式注册表生成器
 * 解析 mock/beauty-package.json 参考包的日间主题 CSS，
 * 把每个选择器 + 可主题化属性抽成注册表条目，并合并 src/live-patch.json 实点补丁 → src/style-registry.js
 * 运行：node scripts/build-registry.js
 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mock', 'beauty-package.json'), 'utf8'));
const dayRule = raw.regex_scripts.find(s => /共享|日间|day/i.test(s.scriptName)) || raw.regex_scripts[0];

let css = dayRule.replaceString;
const start = css.indexOf('>');
css = css.slice(start + 1);
const end = css.indexOf('</style>');
if (end >= 0) css = css.slice(0, end);
css = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* 变量 → 调色板角色 映射（参考包主题变量体系） */
function roleOf(prop, val) {
  const v = val.toLowerCase();
  if (v.includes('transparent') || v === 'none' || v === '0' || v === 'initial') return null;
  if (/var\(--b\)/.test(v)) return 'bg';
  if (/var\(--c\)/.test(v)) return 'surface';
  if (/var\(--n\)/.test(v)) return 'inputBg';
  if (/var\(--a\)\s*$|var\(--a\)[!\s]/.test(v)) return 'accent';
  if (/var\(--ar\)/.test(v)) return 'accentSoft';
  if (/var\(--f\)/.test(v)) return 'text';
  if (/var\(--p\)/.test(v)) return 'muted';
  if (/var\(--d\)/.test(v)) return 'border';
  if (/var\(--h\)/.test(v)) return 'heading';
  if (/var\(--s\)|var\(--e\)/.test(v)) return 'shadow';
  if (/var\(--i\)/.test(v)) return 'icon';
  if (/var\(--l\)/.test(v)) return 'overlay';
  if (/^#fff\b|^#ffffff\b|^rgb\(255,\s*255,\s*255\)/.test(v)) return 'onAccent';
  return null;
}

function groupOf(sel) {
  if (/::-?webkit-scrollbar|scrollbar/.test(sel)) return '滚动条';
  if (/topTabbar|header-box|header-roleName|header-center|header-role-img|icon-back/.test(sel)) return '顶栏';
  if (/content\.right|\.self|self-select/.test(sel)) return '用户气泡';
  if (/content\.left|\.item\.Ai|\.Ai\b/.test(sel)) return 'AI气泡';
  if (/shortcut|instruction|sb-text|back-btn/.test(sel)) return '快捷栏';
  if (/chat-input|textarea|\.input|chatMsgTextarea|uni-input|picker-field|depth-input/.test(sel)) return '输入区';
  if (/u-picker|u-popup|u-toolbar|u-switch|uni-radio|corner-check/.test(sel)) return '弹窗与控件';
  if (/model-|mp-/.test(sel)) return '模型选择';
  if (/share-chat|share_/.test(sel)) return '分享页';
  if (/role-profile|role-setting|role-extra|custom-instruction|cs-|conv-style|gender-item/.test(sel)) return '设置面板';
  if (/prologue/.test(sel)) return '开场白';
  if (/msg-option|option-item|option-box|option-separator/.test(sel)) return '消息操作菜单';
  if (/vditor|modify-/.test(sel)) return '编辑区';
  if (/beta-badge|success-badge|token|battery|perm|badge/.test(sel)) return '徽章标记';
  if (/body|#app|\.chat\b|chat-body|chat-bottom|\.hdm/.test(sel)) return '页面基础';
  return '其他';
}

const entries = [];
const skipped = { noRole: 0, empty: 0 };
const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
let m, idx = 0;
while ((m = ruleRe.exec(css))) {
  const selector = m[1].trim();
  const declStr = m[2].trim();
  if (!selector || !declStr) { skipped.empty++; continue; }
  const props = {};      // prop -> role
  const literals = {};   // prop -> 字面值（圆角/阴影等结构值）
  declStr.split(';').forEach(d => {
    const ci = d.indexOf(':');
    if (ci < 0) return;
    const p = d.slice(0, ci).trim().toLowerCase();
    const v = d.slice(ci + 1).trim().replace(/!important/gi, '').trim();
    let key = null;
    if (p === 'background' || p === 'background-color') key = 'background';
    else if (p === 'color' || p === '-webkit-text-fill-color') key = 'color';
    else if (p === 'border' || p === 'border-color' || p === 'border-top' || p === 'border-bottom') key = 'borderColor';
    else if (p === 'border-radius') key = 'borderRadius';
    else if (p === 'box-shadow') key = 'boxShadow';
    else if (p === 'filter') key = 'filter';
    else if (p === 'caret-color') key = 'caret';
    else return;
    const role = roleOf(p, v);
    if (role) {
      if (key === 'color' && props.color) return; // 已有 color 不重复
      props[key] = role;
    } else if (key === 'borderRadius' && /^[\d.]/.test(v)) {
      literals[key] = v;
    } else if (key === 'boxShadow' && !props.boxShadow) {
      // 无法映射角色的阴影保留为不可主题化标记
    } else if (key === 'filter') {
      props.filter = 'icon'; // 图标滤镜：注册但主题引擎跳过
    }
  });
  const hasThemeProp = Object.keys(props).some(k => props[k] !== 'icon') || Object.keys(literals).length > 0;
  if (!hasThemeProp) { skipped.noRole++; continue; }
  // 避免同选择器重复条目合并
  const exist = entries.find(e => e.selector === selector);
  if (exist) { Object.assign(exist.props, props); Object.assign(exist.literals, literals); continue; }
  idx++;
  entries.push({
    id: 'r' + idx,
    name: selector.split(',')[0].trim().slice(0, 46),
    selector,
    group: groupOf(selector),
    props,
    literals
  });
}

/* 合并实点补丁（src/live-patch.json）：实点弹窗抓取的选择器，补全非驻留内容覆盖 */
try {
  const patch = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'live-patch.json'), 'utf8'));
  let merged = 0, added = 0;
  patch.forEach(p => {
    const exist = entries.find(e => e.selector === p.selector);
    if (exist) {
      Object.assign(exist.props, p.props || {});
      if (p.literals) Object.assign(exist.literals, p.literals);
      merged++;
      return;
    }
    idx++;
    entries.push({ id: 'p' + idx, name: p.name, selector: p.selector, group: p.group || '其他', props: p.props || {}, literals: p.literals || {} });
    added++;
  });
  console.log('live-patch：新增', added, '条，合并', merged, '条');
} catch (e) { console.log('live-patch 跳过:', e.message); }

const groups = {};
entries.forEach(e => { groups[e.group] = (groups[e.group] || 0) + 1; });

const out = `/* 全位置样式注册表（自动生成，勿手改；重新生成：node scripts/build-registry.js）
 * 共 ${entries.length} 条 / ${Object.keys(groups).length} 组
 * props 值为调色板角色：bg/surface/accent/accentSoft/text/muted/border/heading/shadow/inputBg/overlay/onAccent/icon
 * literals 为结构常量（圆角等），主题引擎原样输出 */
window.MM_REGISTRY = {
  version: 1,
  groups: ${JSON.stringify(groups, null, 2).replace(/\n/g, '\n  ')},
  entries: ${JSON.stringify(entries, null, 2).replace(/\n/g, '\n  ')}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'style-registry.js'), out, 'utf8');
console.log('条目总数:', entries.length);
console.log('跳过(无可主题化属性):', skipped.noRole, '空规则:', skipped.empty);
console.log('分组:', JSON.stringify(groups, null, 1));
