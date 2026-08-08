/* 全位置样式注册表（自动生成，勿手改；重新生成：node scripts/build-registry.js）
 * 共 97 条 / 15 组
 * props 值为调色板角色：bg/surface/accent/accentSoft/text/muted/border/heading/shadow/inputBg/overlay/onAccent/icon
 * literals 为结构常量（圆角等），主题引擎原样输出 */
window.MM_REGISTRY = {
  version: 1,
  groups: {
    "页面基础": 1,
    "顶栏": 8,
    "快捷栏": 6,
    "模型选择": 14,
    "弹窗与控件": 26,
    "输入区": 6,
    "其他": 3,
    "AI气泡": 2,
    "用户气泡": 2,
    "开场白": 2,
    "消息操作菜单": 4,
    "编辑区": 2,
    "滚动条": 1,
    "设置面板": 15,
    "分享页": 5
  },
  entries: [
    {
      "id": "r1",
      "name": ":root",
      "selector": ":root,body",
      "group": "页面基础",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r2",
      "name": ".topTabbar",
      "selector": ".topTabbar,.send-msg,.u-popup__content,.u-safe-bottom,.header-scope,.more-options-scope,.modify-scope,.custom-instruction-scope,.role-setting,.u-picker,.model-setting-scope,.shortcut-bar-wrapper,.chat-bottom-wapper,.msg-option-scope,.preset-intro-scope,.mp-preset-scope,.role-extra-setting,.role-extra-setting .setting-top,.cs-modal-header,.cs-modal-header>*,.share-chat-page,.share-chat-scope,.share-chat-content,.share-chat-wrapper,.share-chat-topbar,.share-chat-btn-scope",
      "group": "顶栏",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r3",
      "name": ".custom-instruction-scope .item",
      "selector": ".custom-instruction-scope .item,.shortcut-btn,.instruction-chip,.chat-input-tool-btn,.item-icon,:is(.role-extra-setting,.role-setting,.custom-instruction-scope) .card,.switch-card,.cs-group-card,.model-item,.conversation-item,.modify-item,.option-item,.prologue-content,.mp-preset-card,.mp-preset-item,.preset-intro-content,.mp-card,.mp-switch-row,.mp-token-btn,.card.textarea-wrapper,.input-wrapper",
      "group": "快捷栏",
      "props": {
        "background": "surface",
        "borderColor": "border",
        "color": "text",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r4",
      "name": ".model-battery",
      "selector": ".model-battery,.model-perm,.success-badge,.mp-preset-help",
      "group": "模型选择",
      "props": {
        "background": "bg",
        "borderColor": "border",
        "color": "text"
      },
      "literals": {
        "borderRadius": "6px"
      }
    },
    {
      "id": "r5",
      "name": ".model-battery *",
      "selector": ".model-battery *,.model-perm *,.success-badge *,.role-extra-setting :is(.depth-desc,.label,.picker-value)",
      "group": "模型选择",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r6",
      "name": ".u-toolbar",
      "selector": ".u-toolbar",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "r7",
      "name": ".chat-input-scope",
      "selector": ".chat-input-scope,.textarea-wrapper,.token-scope,.token-scope .item,.value.input-scope,.value.custom-textarea-box,.cs-custom-input,.token,.model-filter-tab,.role-setting :is(.input-dark,.textarea-dark,.input-scope,.custom-textarea-box),.custom-instruction-scope :is(.input-scope,.custom-textarea-box)",
      "group": "快捷栏",
      "props": {
        "background": "inputBg",
        "borderColor": "border",
        "color": "text"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r8",
      "name": "input.vig-native-input__el.input-dark",
      "selector": "input.vig-native-input__el.input-dark,textarea.vig-native-textarea__el.textarea-dark",
      "group": "输入区",
      "props": {
        "background": "inputBg",
        "color": "text",
        "borderColor": "border",
        "boxShadow": "inputBg",
        "filter": "icon"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r9",
      "name": ".depth-input",
      "selector": ".depth-input",
      "group": "输入区",
      "props": {
        "background": "inputBg",
        "borderColor": "border",
        "color": "text"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r10",
      "name": ".depth-input input",
      "selector": ".depth-input input,.depth-input .uni-input-input,.depth-input .vig-native-input__el",
      "group": "输入区",
      "props": {
        "color": "text",
        "filter": "icon"
      },
      "literals": {}
    },
    {
      "id": "r11",
      "name": "input",
      "selector": "input,textarea,uni-input.input-dark,uni-textarea.textarea-dark,.uni-input-input,.uni-textarea-textarea,.chatMsgTextarea,.chat-input-collapsed-text",
      "group": "输入区",
      "props": {
        "color": "text",
        "caret": "accent"
      },
      "literals": {}
    },
    {
      "id": "r12",
      "name": ".uni-input-placeholder",
      "selector": ".uni-input-placeholder,.uni-textarea-placeholder,.limit,.char-count,.char-count span,.count-text,.count-text span,input::placeholder,textarea::placeholder,.role-extra-setting .input-placeholder",
      "group": "输入区",
      "props": {
        "color": "muted"
      },
      "literals": {}
    },
    {
      "id": "r13",
      "name": ":is(.u-popup__content",
      "selector": ":is(.u-popup__content,.shortcut-bar-wrapper,.instruction-bar,.topTabbar,.chat-input-scope,.chat-bottom-wapper,.modify-scope,.custom-instruction-scope,.role-setting,.u-picker,.model-setting-scope,.msg-option-scope,.preset-intro-scope) *",
      "group": "顶栏",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r14",
      "name": ".header-roleName",
      "selector": ".header-roleName,.title,.card-title,.cs-header-title,.model-title,.prologue-title,.complete-btn,.page-title,.confirm-title",
      "group": "顶栏",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r15",
      "name": "uni-text.u-toolbar__wrapper__cancel",
      "selector": "uni-text.u-toolbar__wrapper__cancel,.u-toolbar__wrapper__cancel span,.model-intro,.sub-title,.des-scope,.tips,.card-desc,.icon-back",
      "group": "顶栏",
      "props": {
        "color": "muted"
      },
      "literals": {}
    },
    {
      "id": "r16",
      "name": ".token-scope .selected",
      "selector": ".token-scope .selected,.ok-btn,.bottom .btn,.modify-btn,.gen-link-btn,.u-switch--on,.beta-badge,.token.selected,.header-badge,.mp-token-btn.selected",
      "group": "弹窗与控件",
      "props": {
        "background": "accent",
        "color": "onAccent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "r17",
      "name": ".token-scope .selected *",
      "selector": ".token-scope .selected *,.ok-btn *,.bottom .btn *,.beta-badge *,.header-badge *,.mp-token-btn.selected *",
      "group": "模型选择",
      "props": {
        "color": "onAccent"
      },
      "literals": {}
    },
    {
      "id": "r18",
      "name": ".model-filter-tab.active",
      "selector": ".model-filter-tab.active,.model-filter-tab.active-dark",
      "group": "模型选择",
      "props": {
        "background": "accent",
        "color": "onAccent",
        "borderColor": "accent",
        "boxShadow": "accentSoft",
        "filter": "icon"
      },
      "literals": {}
    },
    {
      "id": "r19",
      "name": ":is(.header-scope",
      "selector": ":is(.header-scope,.header-box) .complete-btn,.u-toolbar__wrapper__confirm,.save-btn,:is(.confirm-scope,.confirm-bottom,.alert-scope,.alert-bottom,.confirm-edit-scope,.confirm-edit-bottom) .ok-btn,:is(.cs-modal-header,.cs-header-right) .confirm-btn,.btn-scope .save-btn,.mp-energy-pill",
      "group": "顶栏",
      "props": {
        "background": "surface",
        "color": "accent",
        "borderColor": "accent",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "999px"
      }
    },
    {
      "id": "r20",
      "name": ":is(.header-scope",
      "selector": ":is(.header-scope,.header-box) .complete-btn *,.u-toolbar__wrapper__confirm *,.save-btn *,:is(.confirm-scope,.confirm-bottom,.alert-scope,.alert-bottom,.confirm-edit-scope,.confirm-edit-bottom) .ok-btn *,:is(.cs-modal-header,.cs-header-right) .confirm-btn *,.btn-scope .save-btn *,.mp-energy-pill *",
      "group": "顶栏",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r21",
      "name": ".u-popup__content:has(.u-picker)",
      "selector": ".u-popup__content:has(.u-picker),.u-picker.u-picker,.u-toolbar.u-toolbar,.u-picker__view.u-picker__view,.uni-picker-view-wrapper,.u-picker__view__column,.uni-picker-view-group,.uni-picker-view-content,.u-popup__content:has(.share-chat-btn-scope),.u-popup__content:has(.share-chat-btn-scope) .u-safe-bottom",
      "group": "弹窗与控件",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r22",
      "name": ".u-picker .uni-picker-view-mask",
      "selector": ".u-picker .uni-picker-view-mask",
      "group": "弹窗与控件",
      "props": {
        "background": "bg"
      },
      "literals": {}
    },
    {
      "id": "r23",
      "name": ".u-picker .uni-picker-view-indicator",
      "selector": ".u-picker .uni-picker-view-indicator",
      "group": "弹窗与控件",
      "props": {
        "background": "accentSoft",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "r24",
      "name": ".u-picker .u-picker__view__column__item",
      "selector": ".u-picker .u-picker__view__column__item,.u-picker .u-picker__view__column__item.u-line-1",
      "group": "弹窗与控件",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r25",
      "name": ".u-picker .u-picker__view__column__item--selec",
      "selector": ".u-picker .u-picker__view__column__item--selected",
      "group": "弹窗与控件",
      "props": {
        "color": "accent",
        "background": "accentSoft"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r26",
      "name": ".u-picker .u-toolbar__wrapper__cancel",
      "selector": ".u-picker .u-toolbar__wrapper__cancel,.u-picker .u-toolbar__wrapper__cancel *",
      "group": "弹窗与控件",
      "props": {
        "color": "muted"
      },
      "literals": {}
    },
    {
      "id": "r27",
      "name": ".u-picker .u-toolbar__wrapper__confirm",
      "selector": ".u-picker .u-toolbar__wrapper__confirm,.u-picker .u-toolbar__wrapper__confirm *",
      "group": "弹窗与控件",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r28",
      "name": ".uni-radio-input",
      "selector": ".uni-radio-input",
      "group": "弹窗与控件",
      "props": {
        "background": "bg",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "r29",
      "name": ".uni-radio-input:has(svg)",
      "selector": ".uni-radio-input:has(svg),.corner-check,.u-switch:has(.u-switch__node--on),.radio-item:has(svg) .uni-radio-input,.mp-preset-item.selected .mp-pi-radio",
      "group": "弹窗与控件",
      "props": {
        "background": "accent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "r30",
      "name": ".model-item.model-item-active",
      "selector": ".model-item.model-item-active,.model-item:has(.corner-check)",
      "group": "弹窗与控件",
      "props": {
        "boxShadow": "accentSoft"
      },
      "literals": {}
    },
    {
      "id": "r31",
      "name": ".css-check",
      "selector": ".css-check",
      "group": "其他",
      "props": {
        "borderColor": "onAccent"
      },
      "literals": {}
    },
    {
      "id": "r32",
      "name": ".chat-body .content.left",
      "selector": ".chat-body .content.left",
      "group": "AI气泡",
      "props": {
        "background": "surface",
        "color": "text",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r33",
      "name": ".chat-body .content.left :is(.msg-content-box",
      "selector": ".chat-body .content.left :is(.msg-content-box,.msg-options-box,.msg-mask)",
      "group": "AI气泡",
      "props": {
        "background": "surface"
      },
      "literals": {}
    },
    {
      "id": "r34",
      "name": ".chat-body .content.right",
      "selector": ".chat-body .content.right,.chat-body .content.right *",
      "group": "用户气泡",
      "props": {
        "background": "accent",
        "color": "onAccent",
        "borderColor": "accent"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r35",
      "name": ".chat-body .content.right :is(.msg-content-box",
      "selector": ".chat-body .content.right :is(.msg-content-box,.msg-options-box,.msg-mask)",
      "group": "用户气泡",
      "props": {
        "background": "accent"
      },
      "literals": {}
    },
    {
      "id": "r36",
      "name": ".shortcut-bar-wrapper",
      "selector": ".shortcut-bar-wrapper",
      "group": "快捷栏",
      "props": {
        "background": "overlay"
      },
      "literals": {}
    },
    {
      "id": "r37",
      "name": ".instruction-bar .back-btn",
      "selector": ".instruction-bar .back-btn",
      "group": "快捷栏",
      "props": {
        "background": "surface",
        "borderColor": "border",
        "filter": "icon",
        "color": "accent"
      },
      "literals": {
        "borderRadius": "50%"
      }
    },
    {
      "id": "r38",
      "name": ".instruction-bar .back-arrow",
      "selector": ".instruction-bar .back-arrow,.instruction-bar .back-arrow span",
      "group": "快捷栏",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r39",
      "name": ":is(.topTabbar",
      "selector": ":is(.topTabbar,.more-options-scope,.chat-bottom-wapper,.chat-input-scope,.shortcut-bar-wrapper,.msg-option-scope,.model-setting-scope) :is(svg,svg *)",
      "group": "顶栏",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r40",
      "name": ".avatar img",
      "selector": ".avatar img,.character-avatar",
      "group": "其他",
      "props": {
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "50%"
      }
    },
    {
      "id": "r41",
      "name": ".prologue-title",
      "selector": ".prologue-title",
      "group": "开场白",
      "props": {
        "background": "surface",
        "borderColor": "border",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "20px"
      }
    },
    {
      "id": "r42",
      "name": ".prologue-title span",
      "selector": ".prologue-title span",
      "group": "开场白",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r43",
      "name": ".msg-option-scope",
      "selector": ".msg-option-scope",
      "group": "消息操作菜单",
      "props": {
        "background": "overlay"
      },
      "literals": {}
    },
    {
      "id": "r44",
      "name": ".msg-option-scope :is(.msg-content-box",
      "selector": ".msg-option-scope :is(.msg-content-box,.msg-options-box)",
      "group": "消息操作菜单",
      "props": {
        "background": "surface",
        "borderColor": "border",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "12px"
      }
    },
    {
      "id": "r45",
      "name": ".msg-option-scope .option-separator",
      "selector": ".msg-option-scope .option-separator",
      "group": "消息操作菜单",
      "props": {
        "background": "border"
      },
      "literals": {}
    },
    {
      "id": "r46",
      "name": ".modify-input-box",
      "selector": ".modify-input-box",
      "group": "编辑区",
      "props": {
        "background": "bg",
        "borderColor": "border",
        "color": "text",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "10px"
      }
    },
    {
      "id": "r47",
      "name": ".vditor",
      "selector": ".vditor",
      "group": "编辑区",
      "props": {
        "borderColor": "border"
      },
      "literals": {
        "borderRadius": "10px"
      }
    },
    {
      "id": "r48",
      "name": ":is(.role-setting",
      "selector": ":is(.role-setting,.custom-instruction-scope) :is(input,textarea)",
      "group": "快捷栏",
      "props": {
        "background": "inputBg",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "r49",
      "name": "::-webkit-scrollbar-thumb",
      "selector": "::-webkit-scrollbar-thumb",
      "group": "滚动条",
      "props": {
        "background": "accent"
      },
      "literals": {
        "borderRadius": "4px"
      }
    },
    {
      "id": "r50",
      "name": ".role-extra-setting :is(.textarea-wrapper",
      "selector": ".role-extra-setting :is(.textarea-wrapper,.textarea-dark,.uni-textarea-wrapper,textarea)",
      "group": "输入区",
      "props": {
        "background": "inputBg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r51",
      "name": ".u-switch",
      "selector": ".u-switch",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "r52",
      "name": ".u-switch__node",
      "selector": ".u-switch__node",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "borderColor": "accent",
        "boxShadow": "shadow"
      },
      "literals": {}
    },
    {
      "id": "r53",
      "name": ".u-switch__node--on",
      "selector": ".u-switch__node--on",
      "group": "弹窗与控件",
      "props": {
        "borderColor": "surface"
      },
      "literals": {}
    },
    {
      "id": "r54",
      "name": ".radio-item:has(svg)",
      "selector": ".radio-item:has(svg)",
      "group": "其他",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r55",
      "name": ".role-profile-modal",
      "selector": ".role-profile-modal,.role-profile-modal :is(.header-scope,.role-setting,.card),.conv-style-modal,.conv-style-modal :is(.cs-modal-content,.outer-scroll-view)",
      "group": "设置面板",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r56",
      "name": ".role-profile-modal .gender-item",
      "selector": ".role-profile-modal .gender-item,.conv-style-modal .cs-style-item",
      "group": "设置面板",
      "props": {
        "background": "surface",
        "borderColor": "border",
        "color": "text",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "r57",
      "name": ".role-profile-modal .gender-item.active",
      "selector": ".role-profile-modal .gender-item.active,.conv-style-modal .cs-style-item.active",
      "group": "设置面板",
      "props": {
        "background": "accent",
        "borderColor": "accent",
        "color": "onAccent"
      },
      "literals": {}
    },
    {
      "id": "r58",
      "name": ".role-profile-modal .gender-item.active *",
      "selector": ".role-profile-modal .gender-item.active *,.conv-style-modal .cs-style-item.active *",
      "group": "设置面板",
      "props": {
        "color": "onAccent"
      },
      "literals": {}
    },
    {
      "id": "r59",
      "name": ".share-chat-topbar :is(.cancel-btn",
      "selector": ".share-chat-topbar :is(.cancel-btn,.toggle-chat-history-btn,.header-roleName)",
      "group": "顶栏",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "r60",
      "name": ".share-chat-btn-scope .btn-item",
      "selector": ".share-chat-btn-scope .btn-item",
      "group": "分享页",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r61",
      "name": ".share-chat-btn-scope .btn-item-icon",
      "selector": ".share-chat-btn-scope .btn-item-icon",
      "group": "分享页",
      "props": {
        "background": "surface",
        "borderColor": "border",
        "boxShadow": "shadow"
      },
      "literals": {
        "borderRadius": "50%"
      }
    },
    {
      "id": "r62",
      "name": ".share-chat-btn-scope .btn-item-title",
      "selector": ".share-chat-btn-scope .btn-item-title",
      "group": "分享页",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "r63",
      "name": ".mp-pi-radio",
      "selector": ".mp-pi-radio",
      "group": "模型选择",
      "props": {
        "borderColor": "border",
        "background": "surface"
      },
      "literals": {
        "borderRadius": "50%"
      }
    },
    {
      "id": "r64",
      "name": ".mp-preset-item.selected .mp-pi-radio::after",
      "selector": ".mp-preset-item.selected .mp-pi-radio::after",
      "group": "模型选择",
      "props": {
        "background": "onAccent"
      },
      "literals": {
        "borderRadius": "50%"
      }
    },
    {
      "id": "p65",
      "name": "弹窗外壳",
      "selector": ".u-popup__content",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p66",
      "name": "弹窗外壳(人设)",
      "selector": ".role-profile-outer-popup,.role-profile-inner-popup",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p67",
      "name": "模型设置根",
      "selector": ".model-setting-scope",
      "group": "模型选择",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p68",
      "name": "模型弹窗顶栏",
      "selector": ".mp-top,.mp-info-bar",
      "group": "模型选择",
      "props": {
        "background": "surface",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p69",
      "name": "模型弹窗标题",
      "selector": ".mp-title,.mp-card-title,.mp-sw-title,.mp-model-name",
      "group": "模型选择",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p70",
      "name": "模型卡片",
      "selector": ".mp-card",
      "group": "模型选择",
      "props": {
        "background": "surface",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {
        "borderRadius": "8px"
      }
    },
    {
      "id": "p71",
      "name": "模型弹窗说明文字",
      "selector": ".mp-card-hint,.mp-sw-desc,.mp-el,.mp-ev",
      "group": "模型选择",
      "props": {
        "color": "muted"
      },
      "literals": {}
    },
    {
      "id": "p72",
      "name": "能量胶囊",
      "selector": ".mp-energy-pill",
      "group": "模型选择",
      "props": {
        "background": "bg",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p73",
      "name": "token按钮",
      "selector": ".mp-token-btn",
      "group": "模型选择",
      "props": {
        "background": "surface",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p74",
      "name": "token按钮选中",
      "selector": ".mp-token-btn.selected",
      "group": "模型选择",
      "props": {
        "background": "accent",
        "color": "onAccent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "p75",
      "name": "开关",
      "selector": ".u-switch,.u-switch__bg",
      "group": "弹窗与控件",
      "props": {
        "background": "bg",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "p76",
      "name": "开关开启态",
      "selector": ".u-switch--on,.u-switch__node--on",
      "group": "弹窗与控件",
      "props": {
        "background": "accent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "p77",
      "name": "弹窗底部确认按钮",
      "selector": ".bottom .btn,.u-popup__content .btn",
      "group": "弹窗与控件",
      "props": {
        "background": "accent",
        "color": "onAccent"
      },
      "literals": {}
    },
    {
      "id": "p78",
      "name": "人设页根",
      "selector": ".role-profile-modal",
      "group": "设置面板",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p79",
      "name": "人设页顶栏",
      "selector": ".role-profile-modal .header-box,.role-profile-modal .header-scope",
      "group": "设置面板",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p80",
      "name": "人设页标题",
      "selector": ".page-title",
      "group": "设置面板",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p81",
      "name": "人设保存按钮",
      "selector": ".complete-btn",
      "group": "设置面板",
      "props": {
        "background": "surface",
        "color": "accent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "p82",
      "name": "人设卡片",
      "selector": ".role-setting .card,.switch-card,.input-wrapper",
      "group": "设置面板",
      "props": {
        "background": "surface",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p83",
      "name": "卡片标题",
      "selector": ".card-title,.card-header",
      "group": "设置面板",
      "props": {
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p84",
      "name": "单选项",
      "selector": ".radio-item",
      "group": "设置面板",
      "props": {
        "background": "surface",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p85",
      "name": "单选按钮",
      "selector": ".uni-radio-input,.uni-radio-wrapper",
      "group": "设置面板",
      "props": {
        "background": "bg",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p86",
      "name": "单选选中",
      "selector": ".radio-item.selected .uni-radio-input,.uni-radio-input-checked",
      "group": "设置面板",
      "props": {
        "background": "accent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "p87",
      "name": "人设输入框",
      "selector": ".role-profile-modal input,.role-profile-modal textarea,.input-dark,.vig-native-input__el",
      "group": "设置面板",
      "props": {
        "background": "inputBg",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p88",
      "name": "字数限制/标签",
      "selector": ".limit,.tag-text,.forbidden-tag",
      "group": "设置面板",
      "props": {
        "color": "muted"
      },
      "literals": {}
    },
    {
      "id": "p89",
      "name": "对话风格弹窗",
      "selector": ".conv-style-modal,.cs-modal-header,.cs-modal-content",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p90",
      "name": "风格分组卡",
      "selector": ".cs-group-card,.cs-style-item",
      "group": "弹窗与控件",
      "props": {
        "background": "bg",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p91",
      "name": "风格选中项",
      "selector": ".cs-style-item.active",
      "group": "弹窗与控件",
      "props": {
        "background": "accent",
        "color": "onAccent",
        "borderColor": "accent"
      },
      "literals": {}
    },
    {
      "id": "p92",
      "name": "自定义指令输入",
      "selector": ".cs-custom-input,.cs-custom-textarea",
      "group": "弹窗与控件",
      "props": {
        "background": "inputBg",
        "color": "text",
        "borderColor": "border"
      },
      "literals": {}
    },
    {
      "id": "p93",
      "name": "选择器滚轮",
      "selector": ".u-picker,.u-picker__view,.u-picker__view__column,.uni-picker-view-content,.u-picker__view__column__item",
      "group": "弹窗与控件",
      "props": {
        "background": "surface",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p94",
      "name": "选择器选中项",
      "selector": ".u-picker__view__column__item--selected",
      "group": "弹窗与控件",
      "props": {
        "color": "accent"
      },
      "literals": {}
    },
    {
      "id": "p95",
      "name": "消息菜单项",
      "selector": ".msg-option-scope .option-item",
      "group": "消息操作菜单",
      "props": {
        "background": "surface",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p96",
      "name": "分享页",
      "selector": ".share-chat-page,.share-chat-wrapper,.share-chat-content,.share-chat-topbar",
      "group": "分享页",
      "props": {
        "background": "bg",
        "color": "text"
      },
      "literals": {}
    },
    {
      "id": "p97",
      "name": "分享按钮",
      "selector": ".share-chat-btn-scope .btn-item,.share-chat-btn-scope .btn-item-title",
      "group": "分享页",
      "props": {
        "color": "text"
      },
      "literals": {}
    }
  ]
};
