/* 自绘 mock 图标生成器（替代站点抓取素材，可自由分发）
 * 风格：24x24 / 线条式 / 圆角端点 / 暗底浅色描边
 * 运行：node scripts/gen-mock-icons.js
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'mock', 'site-assets');

const C = '#cfc8e6'; // 暗色主题下的浅灰紫描边
const wrap = (inner, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color || C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>\n`;

const icons = {
  'arrow_back_dark.svg': wrap('<polyline points="15 18 9 12 15 6"/>'),
  'ico_aihelp.svg': wrap('<path d="M12 4l1.7 4.8L18.5 10.5l-4.8 1.7L12 17l-1.7-4.8L5.5 10.5l4.8-1.7z"/><circle cx="18.5" cy="5.5" r="1.2"/>'),
  'ico_comment_dark.svg': wrap('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
  'ico_share2_dark.svg': wrap('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><line x1="8.3" y1="10.8" x2="15.7" y2="6.2"/><line x1="8.3" y1="13.2" x2="15.7" y2="17.8"/>'),
  'ico_collect_dark.svg': wrap('<polygon points="12 2.5 14.9 8.6 21.5 9.5 16.7 14.1 17.9 20.7 12 17.5 6.1 20.7 7.3 14.1 2.5 9.5 9.1 8.6"/>'),
  'ico_refresh2_dark.svg': wrap('<polyline points="22 4 22 10 16 10"/><path d="M20.5 15a8.5 8.5 0 1 1-2-8.9L22 9.5"/>'),
  'ico_more_dark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${C}" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>\n`,
  'ico_setting2_dark.svg': wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  'ico_instruction_dark.svg': wrap('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="0.8"/><circle cx="4.5" cy="12" r="0.8"/><circle cx="4.5" cy="18" r="0.8"/>'),
  'ico_rechat2_dark.svg': wrap('<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 7.1 7.1 0 0 1-3.3-.8L4 20l1.7-4.9a7.1 7.1 0 0 1-.7-3.1A7.5 7.5 0 0 1 12.5 4.5 7.5 7.5 0 0 1 20 11.5z"/><line x1="12.5" y1="9" x2="12.5" y2="14"/><line x1="10" y1="11.5" x2="15" y2="11.5"/>'),
  'ico_battery2_dark.svg': wrap('<rect x="2" y="8" width="17" height="8" rx="2"/><line x1="21.5" y1="10.5" x2="21.5" y2="13.5"/><line x1="5.5" y1="10.5" x2="5.5" y2="13.5"/><line x1="9" y1="10.5" x2="9" y2="13.5"/>'),
  'ico_send_dark.svg': wrap('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>'),
  'ico_chat_set_dark.svg': wrap('<path d="M19 10.5a6.5 6.5 0 0 1-6.5 6.5 6.2 6.2 0 0 1-2.9-.7L5 18l1.5-4.3a6.2 6.2 0 0 1-.6-2.7A6.5 6.5 0 0 1 12.5 4.5 6.5 6.5 0 0 1 19 10.5z"/><line x1="9.5" y1="9.5" x2="15.5" y2="9.5"/><circle cx="11" cy="12.8" r="0.8"/><circle cx="14" cy="12.8" r="0.8"/>'),
  'ico_user_setting_dark.svg': wrap('<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 20a6 6 0 0 1 12 0"/><circle cx="17.5" cy="15.5" r="2"/><path d="M17.5 12.2v1.3M17.5 17.5v1.3M14.6 14l1.1.7M19.3 16.8l1.1.7M20.4 14l-1.1.7M15.7 16.8l-1.1.7"/>')
};

Object.entries(icons).forEach(([name, svg]) => {
  fs.writeFileSync(path.join(dir, name), svg, 'utf8');
});
console.log('已生成自绘图标:', Object.keys(icons).length, '个 →', dir);
