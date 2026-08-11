# 维护与风险记录

更新时间：2026-08-11

扫描基线：`93691f9af3d3cd7551ddc8c765b772fcc61dfb3e`

范围：仓库跟踪文件、历史提交、启动链路、工作台内联脚本、发布模块与本地 HTTP 服务。

## 当前结论

- 项目是零第三方运行时依赖的 Node.js 本地工作台；本次未新增依赖。
- 常见密钥模式历史扫描未发现已提交的 API Key 或 Token。
- 本次修复保持默认角色 `204786`、美化包格式、站点 API 契约和沙盒注入流程不变。
- 未执行真实模型请求、站点登录、角色卡发布或线上部署。

## 风险登记

| 编号 | 优先级 | 状态 | 风险与处理 |
| --- | --- | --- | --- |
| R-001 | P0 | 待架构修复 | 工作台、反向代理页面和未沙箱化 iframe 共用同一 `localhost` 源；工作台又把模型密钥保存在 `localStorage`。被代理页面脚本理论上可读取密钥并控制父页。彻底修复需要把控制台与预览拆到不同 origin，并用受限消息桥通信；直接加 iframe sandbox 会破坏现有实时注入，因此本次不冒险修改。 |
| R-002 | P1 | 已修复 | AI 全自动模式原先可直接执行模型生成的 JS，修正轮也能引入高风险动作。现在 `run_js/js/load_package/publish/clear_css` 都必须人工确认，修正轮遇到高风险动作会停止。 |
| R-003 | P1 | 已修复 | 聊天、创作和发布目标写死为角色 `204786`。设备栏现可配置角色 ID，默认值不变；非法 ID 在请求前拒绝。 |
| R-004 | P1 | 已缓解 | 本地服务原先监听所有网卡并发送通配 CORS；LLM 中继接受任意目标。现在仅监听 `127.0.0.1`、移除通配 CORS、仅接受 POST/HTTPS、限制 1 MiB 请求，并在连接前拒绝本机、私网和保留地址且固定已校验 DNS 地址。 |
| R-005 | P1 | 已修复 | 模型服务返回的模型 ID 被拼进 `innerHTML`，可形成 DOM 注入。现在全部使用 `textContent` 和 DOM API 渲染。 |
| R-006 | P2 | 已修复 | bridge 触发限流时调用未定义的 `reportError`。现改为已定义的 `window.__wb_reportError`。 |
| R-007 | P2 | 已缓解 | 发布多条规则不是事务，中途失败可能留下部分写入。平台接口没有可确认的事务/回滚契约，本次先让错误明确报告已写入数量并说明安全重试语义；后续应增加发布前快照和显式回滚工具。 |
| R-008 | P2 | 待处理 | `workbench.html` 超过 200 KiB 且功能集中在单个内联脚本；仓库无自动测试和 CI。先补行为测试，再拆模块，避免无保护重构。 |
| R-009 | P2 | 待处理 | `src/style-registry.js` 的重建依赖被忽略的 `mock/beauty-package.json`，新维护者无法仅凭仓库复现生成结果。应提供可公开的最小输入或把生成器改为读取已跟踪规范。 |
| R-010 | P3 | 待确认 | `启动工作台.bat` 与 `启动工作台.bat.txt` 内容相同。可能是下载平台兼容副本；未确认发布用途前不删除。 |
| R-011 | P2 | 待决策 | 帮助文案举例“本地 Ollama”，但原中继始终用 HTTPS/443，请求本地 HTTP 端点实际不可用；本次安全边界又明确拒绝私网。后续应在隔离 origin 后设计显式的“可信本地端点”开关，或移除该文案，不能默认放开 SSRF。 |

## 同类项目对比与借鉴边界

| 项目 | 许可证/状态 | 可借鉴项 | 适配建议 |
| --- | --- | --- | --- |
| [Stylebot](https://github.com/ankit/stylebot) | MIT；成熟浏览器扩展 | 点选元素、即时保存、CSS 编辑器、内容脚本隔离 | 可参考控制面与页面注入分层；允许复用 MIT 思路或代码，但引入时仍保留版权说明。 |
| [Stylus](https://github.com/openstyles/stylus) | GPL-3.0；成熟且持续维护 | CSS lint、JSON 备份、样式版本/更新、轻量内容脚本 | 本项目为 MIT，不直接复制 GPL 代码；只借鉴产品与架构概念，自行实现。 |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | BSD-3-Clause；持续发布 | command bus、可拦截动作、状态化命令、版本化 project data、autosave/dirty count | 不建议现在整体引入大框架；先把现有操作统一成命令契约，再拆分存储层。 |
| [tavern-mmd](https://github.com/yofengi/tavern-mmd) | MIT；小型垂直项目 | 零依赖 JSON 校验、平台差异矩阵、预览构建、交付检查清单 | 优先借鉴验证器与检查清单；不要把未验证的平台实测结论当稳定 API。 |
| [SillyTavern Regex](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/extensions/Regex.md) | 官方文档 | scoped/global 范围、导入导出、实时 Test Mode | 给包增加作用域、启用状态、测试输入/输出和发布前 diff。 |
| [browser-use](https://github.com/browser-use/browser-use) | MIT；活跃 | `allowed_domains`、`prohibited_domains`、IP 地址阻断、敏感数据域约束 | 为 AI 动作和包清单增加域名/能力白名单，默认拒绝网络与发布权限。 |

## 建议路线

1. P0：拆分控制台 origin 与站点预览 origin；密钥移出被代理页面可访问的 Web Storage，建立带 token、来源校验和能力白名单的消息桥。
2. P1：为美化包增加 `schemaVersion` 与 `capabilities`（如 `css`、`dom`、`script`、`network`、`publish`），导入时静态校验并展示权限差异。
3. P1：增加发布前快照、规则 diff、Test Mode 和可选择回滚；发布结果记录角色 ID、成功项与失败点。
4. P2：加入 Node 内置测试与 GitHub Actions，覆盖静态资源、路径隔离、LLM 中继边界、包校验和角色 ID；测试稳定后再拆分 `workbench.html`。
5. P2：把 localStorage 数据收敛为可版本迁移的 project data，并提供一键 JSON 备份/恢复。

## 本次离线验证

- Node 语法检查：全部独立 JS 与 2 个 HTML 内联脚本通过。
- JSON 解析：除明确忽略的私有 mock 输入外全部通过。
- 本地 HTTP：工作台 200、缺失文件 404、编码路径穿越 403、错误方法 405、坏 JSON 400、超限请求 413。
- 网络边界：监听地址确认为 `127.0.0.1`；恶意 Origin 无通配 CORS；私网 LLM 目标在连接前返回 400。
- 离线单元式检查：角色 ID 默认/持久化/非法回退、危险动作门禁、修正轮门禁、模型 ID 纯文本渲染、发布部分失败提示均通过。
