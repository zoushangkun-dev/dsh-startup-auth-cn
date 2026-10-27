// ═══════════════════════════════════════════════════════════════════════════
//  改动前必读：plugins/dsh-boot-handmade/维护须知.md
//
//  这份文件最容易复发的四类 bug（都修过、都复发过）：
//   1. 不要往 DSH 的 React DOM 里插节点 —— 会整窗卡死，且有定时守护时变死循环。
//   2. 不要用"屏幕外隐藏 input + 焦点"承载 PIN —— 输入会丢，切换显示像清空。
//   3. 密码框不要用 letter-spacing —— 末尾的点会被挤出可视区且不滚动。
//   4. 深色主题规则必须 `.sc.dark` 前缀 + 足够特异性 —— 曾把数字盖成白圆。
//
//  视觉：主文字 #f3eee4 / 次要 #8d887e / 强调 #ff5a1f / 危险 #ff2d55，只有这四种。
// ═══════════════════════════════════════════════════════════════════════════
// Browser half of dsh-boot-handmade: a cold-start animation drawn with DOM + CSS
// + SVG (no video, no bitmaps, no external assets), with a working app-lock gate.
//
// Acts: logo -> overexposed wash -> warm technical archive -> access gate
// (Windows Hello / PIN, verified by the host half) -> identity -> verify ->
// chromatic glitch -> chat.
//
// Hand-written in the lazy-CJS bundle protocol (window.__ModuleLoader__.load
// with a factory returning cordis-plugin exports), so there is no build step
// and no imports from dsh client packages.
window.__ModuleLoader__.load({
  id: 'dsh-boot-handmade',
  factory: function () {
    var module = { exports: {} }
    var exports = module.exports

    var DONE_KEY = 'dsh-boot-handmade:done'
    var ROOT_ID = 'boot-hm-root'
    var BH_THEME_KEY = 'bh-theme'

    var CSS = [
      '#boot-hm-root{position:fixed;inset:0;z-index:2147483640;overflow:hidden;isolation:isolate;',
      'background:#08080a;color:#f3eee4;',
      "font-family:'Microsoft YaHei','PingFang SC','Noto Sans SC',system-ui,sans-serif;",
      'opacity:1;transition:opacity .6s ease;contain:strict}',
      '#boot-hm-root.out{opacity:0;pointer-events:none}',
      '.bh-mono{font-family:ui-monospace,\'Cascadia Mono\',Consolas,\'SF Mono\',monospace}',
      '.bh-scene{position:absolute;inset:0;opacity:0;transition:opacity .5s ease}',
      '.bh-scene.on{opacity:1}',

      '.sa-grid{position:absolute;inset:-20%;background-image:',
      'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),',
      'linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);',
      'background-size:64px 64px;transform:perspective(600px) rotateX(58deg) translateY(18%);',
      'opacity:.35}',
      '.sa-center{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:18px}',
      '.sa-mark{width:132px;height:132px;overflow:visible}',
      '.sa-path,.sa-path2{fill:none;stroke:#f3eee4;stroke-width:2.4;stroke-linecap:round;',
      'stroke-dasharray:260;stroke-dashoffset:260;animation:bh-draw 1.15s cubic-bezier(.4,0,.2,1) forwards}',
      '.sa-path2{animation-delay:.18s;stroke:#ff5a1f}',
      '.sa-dot{fill:#ff5a1f;opacity:0;animation:bh-pop .4s .95s ease forwards}',
      '@keyframes bh-draw{to{stroke-dashoffset:0}}',
      '@keyframes bh-pop{to{opacity:1}}',
      '.sa-word{margin-top:6px;font-size:30px;letter-spacing:.62em;text-indent:.62em;',
      'font-weight:600;opacity:0;filter:blur(6px);animation:bh-focus .9s .55s ease forwards}',
      '@keyframes bh-focus{to{opacity:1;filter:blur(0)}}',
      '.sa-sub{margin-top:2px;font-size:12px;letter-spacing:.38em;text-indent:.38em;color:#8b867c;',
      'opacity:0;animation:bh-focus .8s .85s ease forwards}',
      '.sa-foot{position:absolute;left:50%;bottom:56px;width:min(520px,72vw);transform:translateX(-50%)}',
      '.sa-bar{height:1px;background:rgba(243,238,228,.16);overflow:hidden}',
      '.sa-bar i{display:block;height:100%;width:0;background:#ff5a1f;',
      'animation:bh-fill 2.1s .15s cubic-bezier(.3,.9,.2,1) forwards}',
      '@keyframes bh-fill{to{width:100%}}',
      '.sa-meta{display:flex;justify-content:space-between;margin-top:10px;font-size:10px;',
      'letter-spacing:.24em;color:#6f6a62}',

      '.sb-wash{position:absolute;inset:0;background:#f6f1e7;opacity:0;pointer-events:none}',
      '.sb-wash.go{animation:bh-wash 1.05s cubic-bezier(.4,0,.2,1) forwards}',
      '@keyframes bh-wash{0%{opacity:0}40%{opacity:.55}56%{opacity:.55}100%{opacity:0}}',

      // 深色模式：把这张纸换成深色，其余动画本来就是深色的。
      '.sc.dark{background:#101014;color:#f3eee4}',
      '.sc.dark::before{background-image:linear-gradient(rgba(243,238,228,.05) 1px,transparent 1px),',
      'linear-gradient(90deg,rgba(243,238,228,.05) 1px,transparent 1px)}',
      '.sc.dark .sc-frame{border-color:rgba(243,238,228,.16)}',
      '.sc.dark .sc-head{color:#8d887e}',
      '.sc.dark .sc-side{color:#6c675e}',
      '.sc.dark .sc-note{color:#a29c92}',
      '.sc.dark .bh-auth-hint{color:#8d887e}',
      '.sc.dark .bh-pin{border-color:rgba(243,238,228,.32);background:transparent;color:#f3eee4}',
      '.sc.dark .bh-pin:focus{border-bottom-color:#ff5a1f}',
      '.sc.dark .bh-pin::placeholder{color:#6c675e}',
      '.sc.dark .bh-hello{color:#c9c3b8;border-color:rgba(243,238,228,.18)}',
      '.sc.dark .bh-recover{color:#b8b2a6}',
      '.sc.dark .bh-recover-box{border-color:rgba(243,238,228,.14)}',
      '.sc.dark .bh-direct{color:#b8b2a6;border-color:rgba(243,238,228,.18)}',
      '.sc.dark .bh-rows{color:#8d887e}',
      '.sc.dark .bh-ring{border-color:rgba(243,238,228,.18)}',
      '.sc{background:#f3eee4;color:#14141a}',
      '.sc::before{content:\'\';position:absolute;inset:0;pointer-events:none;',
      'background-image:linear-gradient(rgba(20,20,26,.055) 1px,transparent 1px),',
      'linear-gradient(90deg,rgba(20,20,26,.055) 1px,transparent 1px);background-size:48px 48px}',
      '.sc-frame{position:absolute;inset:22px;border:1px solid rgba(20,20,26,.22)}',
      '.sc-head{position:absolute;left:44px;right:44px;top:44px;display:flex;',
      'justify-content:space-between;font-size:11px;letter-spacing:.26em;color:#3a3a44}',
      '.sc-side{position:absolute;left:46px;top:50%;transform:translateY(-50%) rotate(180deg);',
      'writing-mode:vertical-rl;font-size:10px;letter-spacing:.42em;color:#8d887e}',
      '.sc-main{position:absolute;left:104px;top:50%;transform:translateY(-56%);max-width:56%}',
      '.sc-zh{font-size:clamp(28px,4.4vw,52px);font-weight:600;letter-spacing:.06em;line-height:1.25}',
      '.sc-en{margin-top:14px;font-size:12px;letter-spacing:.34em;color:#ff5a1f;min-height:16px}',
      '.sc-note{margin-top:16px;font-size:12px;letter-spacing:.06em;color:#6c675e;min-height:18px}',
      '.sc-ring{position:absolute;right:96px;top:50%;transform:translateY(-50%);width:170px;height:170px}',
      '.sc-ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
      '.ring-bg{fill:none;stroke:rgba(20,20,26,.14);stroke-width:2}',
      '.ring-fg{fill:none;stroke:#ff5a1f;stroke-width:2;stroke-linecap:round;',
      'stroke-dasharray:339.29;stroke-dashoffset:339.29;transition:stroke-dashoffset .5s ease}',
      '.ring-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
      'font-size:26px;letter-spacing:.06em;font-weight:600}',
      '.sc-foot{position:absolute;left:44px;right:44px;bottom:44px;display:flex;',
      'align-items:center;justify-content:space-between;gap:24px}',
      '.sc-status{font-size:11px;letter-spacing:.24em;color:#3a3a44}',
      // 主操作按钮：实心橙色，和输入框同高。之前的"下划线文字"看不出这是按钮。
      '.sc-btn{appearance:none;border:1px solid #ff5a1f;border-radius:10px;background:#ff5a1f;',
      'color:#14141a;padding:0 26px;font-size:14px;font-weight:600;letter-spacing:.18em;',
      'cursor:pointer;font-family:inherit;min-height:56px;',
      'transition:background .18s ease,box-shadow .18s ease,transform .06s ease}',
      '.sc-btn:hover{background:#ff7038;color:#14141a;box-shadow:0 6px 18px rgba(255,90,31,.28)}',
      '.sc-btn:active{transform:translateY(1px)}',
      '.sc.dark .sc-btn{background:#ff5a1f;color:#14141a;border-color:#ff5a1f}',
      '.sc.dark .sc-btn:hover{background:#ff7038;color:#14141a}',
      '.sc-btn em{font-style:normal;font-size:10px;opacity:.55;margin-left:10px;letter-spacing:.2em}',
      '.sc-btn:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none}',
      '.bh-rows{display:flex;flex-direction:column;gap:8px;margin-top:20px;font-size:12px;',
      'letter-spacing:.12em;color:#3a3a44;min-height:84px}',
      '.bh-row{opacity:0;transform:translateY(4px);transition:opacity .3s ease,transform .3s ease}',
      '.bh-row.on{opacity:1;transform:none}',

      '.bh-auth{display:none;margin-top:22px;max-width:520px}',
      // 眼睛按钮：和输入框同高、有边框，能在浅色纸上看清（之前无框+低透明度，几乎消失）
      '.bh-eye{flex:none;display:flex;align-items:center;justify-content:center;width:52px;',
      'border:1px solid rgba(20,20,26,.28);border-radius:8px;background:#fffdf8;color:#5d584f;',
      'cursor:pointer;padding:0;transition:color .18s ease,border-color .18s ease,background .18s ease}',
      '.bh-eye:hover{color:#14141a;border-color:rgba(20,20,26,.55)}',
      '.bh-eye.on{color:#ff5a1f;border-color:#ff5a1f;background:#fff7f2}',
      '.sc.dark .bh-eye{border-color:rgba(243,238,228,.28);background:#1c1c24;color:#c9c3b8}',
      '.sc.dark .bh-eye:hover{color:#f3eee4;border-color:rgba(243,238,228,.5)}',
      '.sc.dark .bh-eye.on{color:#ff5a1f;border-color:#ff5a1f;background:#241a16}',
            // 次级入口统一成一行：之前一个靠左、两个居中，看起来像没做完。
      '.bh-sec-row{display:flex;gap:10px;align-items:stretch;margin-top:12px}',
      '.bh-sec-row > .bh-link{flex:1;margin:0;padding:11px 8px;border:1px solid rgba(20,20,26,.18);',
      'border-radius:8px;background:transparent;text-decoration:none;text-align:center;',
      'font-size:11px;letter-spacing:.14em;color:#5d584f;transition:border-color .18s ease,color .18s ease,background .18s ease}',
      '.bh-sec-row > .bh-link:hover{border-color:#ff5a1f;color:#ff5a1f;background:#fff7f2}',
      '.bh-sec-row > .bh-direct{flex:1;margin:0;padding:11px 8px;border:1px solid rgba(20,20,26,.18);',
      'border-radius:8px;text-decoration:none;text-align:center;font-size:11px;letter-spacing:.14em;',
      'color:#5d584f;display:flex;align-items:center;justify-content:center}',
      '.bh-sec-row > .bh-direct:hover{border-color:#ff5a1f;color:#ff5a1f;background:#fff7f2}',
      '.sc.dark .bh-sec-row > .bh-direct{border-color:rgba(243,238,228,.18);color:#b8b2a6}',
      '.sc.dark .bh-sec-row > .bh-direct:hover{border-color:#ff5a1f;color:#ff5a1f;background:#241a16}',
      '.sc.dark .bh-sec-row > .bh-link{border-color:rgba(243,238,228,.18);color:#b8b2a6}',
      '.sc.dark .bh-sec-row > .bh-link:hover{border-color:#ff5a1f;color:#ff5a1f;background:#241a16}',
'.bh-link{border:0;background:transparent;color:#6c675e;font-size:11px;letter-spacing:.18em;',
      'padding:10px 0 0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
      '.bh-link:hover{color:#ff5a1f}',
      '.sc.dark .bh-link{color:#b8b2a6}',
      '.sc.dark .bh-link:hover{color:#ff5a1f}',
      '.bh-inline-form{margin-top:12px;padding-top:12px;border-top:1px solid rgba(20,20,26,.18);max-width:520px}',
      '.sc.dark .bh-inline-form{border-top-color:rgba(243,238,228,.18)}',
      '.bh-inline-form .bh-auth-row{margin-bottom:10px}',
      '.bh-auth.on{display:block}',
      '.bh-auth-hint{font-size:11px;letter-spacing:.22em;color:#6c675e;margin-bottom:10px}',
      '.bh-auth-row{display:flex;gap:10px;align-items:stretch}',
      // 输入框是整个门的主角：实心底 + 边框，眼睛同高，解锁是实心按钮。
      // 注意：不要用 letter-spacing 搭配极窄宽度，末位的点会被挤出可视区（已踩过）。
      '.bh-pin{flex:1;min-width:0;border:1px solid rgba(20,20,26,.28);border-radius:10px;',
      'background:#fffdf8;',
      'font-family:ui-monospace,Consolas,monospace;font-size:24px;letter-spacing:.34em;',
      'padding:14px 16px;color:#14141a;outline:none;',
      'transition:border-color .18s ease,box-shadow .18s ease;',
      'overflow-x:auto;white-space:nowrap}',
      '.bh-pin:focus{border-color:#ff5a1f;box-shadow:0 0 0 3px rgba(255,90,31,.16)}',
      '.sc.dark .bh-pin{border-color:rgba(243,238,228,.22);background:#17171d;color:#f3eee4}',
      '.sc.dark .bh-pin:focus{border-color:#ff5a1f;box-shadow:0 0 0 3px rgba(255,90,31,.22)}',
      '.bh-hello{margin-top:12px;width:100%;border:1px solid rgba(20,20,26,.22);border-radius:8px;',
      'background:#f7f1e6;color:#2a2620;padding:12px 14px;font-family:inherit;font-size:12px;',
      'letter-spacing:.18em;cursor:pointer;',
      'transition:background .2s ease,border-color .2s ease,color .2s ease}',
      '.bh-hello:hover{background:#fff3ea;border-color:#ff5a1f;color:#14141a}',
      '.sc.dark .bh-hello{background:#1c1c24;border-color:rgba(243,238,228,.2);color:#d8d2c6}',
      '.sc.dark .bh-hello:hover{background:#241a16;border-color:#ff5a1f;color:#f3eee4}',
      '.bh-recover{margin-top:6px;width:100%;border:0;background:transparent;color:#6c675e;',
      'font-family:inherit;font-size:10px;letter-spacing:.16em;cursor:pointer;padding:6px 0;',
      'text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(20,20,26,.2)}',
      '.bh-recover:hover{color:#ff5a1f;text-decoration-color:#ff5a1f}',
      '.bh-recover.hot{color:#ff5a1f;text-decoration-color:#ff5a1f;font-weight:600}',
      '.bh-totp-secret{margin:6px 0 8px;padding:8px 10px;border:1px solid rgba(20,20,26,.2);',
      'background:rgba(255,255,255,.55);font-size:10px;line-height:1.7;letter-spacing:.06em;',
      'word-break:break-all;color:#14141a;white-space:pre-wrap;max-height:150px;overflow:auto}',
      '.bh-recover-box{margin-top:8px}',
      '.bh-recover-hint{margin-bottom:8px;font-size:10px;letter-spacing:.1em;color:#6b665c;line-height:1.5}',
      '.bh-code{width:100%;border:1px solid rgba(20,20,26,.34);background:rgba(255,255,255,.4);',
      'font-family:ui-monospace,Consolas,monospace;font-size:18px;letter-spacing:.4em;',
      'padding:9px 12px;color:#14141a;outline:none}',
      '.bh-direct{margin-top:10px;width:100%;border:0;background:transparent;color:#6c675e;',
      'font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.2em;',
      'cursor:pointer;padding:8px 0;text-decoration:underline;text-underline-offset:4px;',
      'text-decoration-color:rgba(20,20,26,.22);transition:color .2s ease}',
      '.bh-direct:hover{color:#ff5a1f;text-decoration-color:#ff5a1f}',
      '.bh-auth-err{margin-top:10px;font-size:11px;letter-spacing:.1em;color:#c2401a;min-height:14px}',
      '.bh-alt{margin-top:12px;font-size:10px;letter-spacing:.2em;color:#a29c92}',
      '.bh-alt span{color:#c0bab0;margin-left:8px}',
      '.bh-shake{animation:bh-shake .34s ease}',
      '@keyframes bh-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}',
      '50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}',
      '50%{text-shadow:-3px 0 #ff2d55,3px 0 #00e0ff;transform:translateX(2px)}',
      '100%{text-shadow:0 0 transparent;transform:none}}',
      '100%{clip-path:inset(0 0 0 0)}}'
    ].join('')

    var TEMPLATE = [
      '<div class="bh-scene sa on">',
      '<div class="sa-grid"></div>',
      '<div class="sa-center">',
      '<svg class="sa-mark" viewBox="0 0 120 120" aria-hidden="true">',
      '<path class="sa-path" d="M14 74C28 46 50 38 62 52c8 9 3 22-11 24-13 2-21-10-13-20"/>',
      '<path class="sa-path2" d="M62 52c14-12 34-8 42 8 6 12-2 26-16 28"/>',
      '<circle class="sa-dot" cx="101" cy="60" r="2.6"/>',
      '</svg>',
      '<div class="sa-word">DEEPSEEK</div>',
      '<div class="sa-sub">深 度 求 索 · 冷 启 动</div>',
      '</div>',
      '<div class="sa-foot bh-mono">',
      '<div class="sa-bar"><i></i></div>',
      '<div class="sa-meta"><span>COLD START</span><span id="bh-pct">000%</span></div>',
      '</div>',
      '</div>',

      '<div class="bh-scene sb"><div class="sb-wash" id="bh-wash"></div></div>',

      '<div class="bh-scene sc">',
      '<div class="sc-frame"></div>',
      '<div class="sc-head bh-mono"><span>DEEPSEEK HARNESS OS</span><span id="bh-clock">VER 6.0.16</span></div>',
      '<div class="sc-side bh-mono">TECHNICAL ARCHIVE / 技术档案</div>',
      '<div class="sc-main">',
      '<div class="sc-zh" id="bh-zh">需要访问许可</div>',
      '<div class="sc-en bh-mono" id="bh-en"></div>',
      '<div class="sc-note" id="bh-note"></div>',
      '<div class="bh-rows bh-mono" id="bh-rows"></div>',
      '<div class="bh-auth" id="bh-auth">',
      '<div class="bh-auth-hint bh-mono" id="bh-auth-hint">输入登录密码</div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-pin" type="password" inputmode="numeric" maxlength="32"',
      ' autocomplete="off" spellcheck="false" aria-label="登录密码">',
      '<button class="bh-eye" id="bh-eye" type="button" aria-pressed="false"',
      ' aria-label="显示密码" title="显示密码">',
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">',
      '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"',
      ' fill="none" stroke="currentColor" stroke-width="1.6"/>',
      '<circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      '</svg>',
      '</button>',
      '<button class="sc-btn" id="bh-go" type="button">解锁</button>',
      '</div>',
      '<button class="bh-hello bh-mono" id="bh-hello" type="button">WINDOWS HELLO · 指纹 / 人脸 / PIN</button>',
      '<button class="bh-recover bh-mono" id="bh-totp-setup" type="button" style="display:none">用验证器 6 位码进入</button>',
      '<div class="bh-recover-box" id="bh-totp-box" style="display:none">',
      '<div class="bh-recover-hint" id="bh-totp-hint"></div>',
      '<div class="bh-totp-secret bh-mono" id="bh-totp-secret"></div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-totp-code" type="text" inputmode="numeric" maxlength="9"',
      ' autocomplete="one-time-code" spellcheck="false" aria-label="验证器动态码">',
      '<button class="sc-btn" id="bh-totp-go" type="button">验证</button>',
      '</div>',
      '</div>',
      '<button class="bh-recover bh-mono" id="bh-account" type="button">DeepSeek 账号</button>',
      '<div class="bh-recover-box" id="bh-account-box" style="display:none">',
      '<div class="bh-recover-hint" id="bh-account-hint">'
      + '账号的登录与切换由 DSH 自带界面负责。通过验证后进入，会自动帮你打开账号菜单。</div>',
      '<div class="bh-auth-row"><button class="sc-btn" id="bh-account-go" type="button">验证后进入并打开</button></div>',
      '<div class="bh-recover-hint" id="bh-account-msg"></div>',
      '</div>',
      '<div class="bh-sec-row">',
      '<button class="bh-link bh-mono" id="bh-pinchange" type="button">更改登录 PIN</button>',
      '<div class="bh-inline-form" id="bh-pinchange-box" style="display:none">',
      '<div class="bh-auth-hint bh-mono">更改登录 PIN · 需要当前 PIN，改完立刻生效</div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-pc-current" type="password" inputmode="numeric" maxlength="32"',
      ' autocomplete="current-password" spellcheck="false" aria-label="当前 PIN" placeholder="当前 PIN">',
      '</div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-pc-next" type="password" inputmode="numeric" maxlength="32"',
      ' autocomplete="new-password" spellcheck="false" aria-label="新 PIN" placeholder="新 PIN（4-32 位）">',
      '</div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-pc-confirm" type="password" inputmode="numeric" maxlength="32"',
      ' autocomplete="new-password" spellcheck="false" aria-label="确认新 PIN" placeholder="再输一次新 PIN">',
      '<button class="sc-btn" id="bh-pc-go" type="button">保存</button>',
      '</div>',
      '<div class="bh-auth-hint bh-mono" id="bh-pc-msg"></div>',
      '</div>',
      '<button class="bh-direct bh-mono" id="bh-direct" type="button">直接进入（跳过验证）</button>',
      '</div>',
      '<div class="bh-auth-err" id="bh-auth-err"></div>',
      '</div>',
      '</div>',
      '<div class="sc-ring">',
      '<svg viewBox="0 0 140 140"><circle class="ring-bg" cx="70" cy="70" r="54"/>',
      '<circle class="ring-fg" id="bh-ring" cx="70" cy="70" r="54"/></svg>',
      '<div class="ring-num bh-mono" id="bh-ringnum">00</div>',
      '</div>',
      '<div class="sc-foot bh-mono">',
      '<div class="sc-status" id="bh-status">00 / 08 | STANDBY</div>',
      '<button class="sc-btn" id="bh-btn" type="button" style="display:none">继续<em>ENTER</em></button>',
      '</div>',
      '</div>'
    ].join('')

    function $(id) { return document.getElementById(id) }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

    function typeInto(node, text, perChar) {
      node.textContent = ''
      var i = 0
      return new Promise(function (resolve) {
        var timer = setInterval(function () {
          i += 1
          node.textContent = text.slice(0, i)
          if (i >= text.length) { clearInterval(timer); resolve() }
        }, perChar || 28)
      })
    }

    function Beep() {
      var ctx = null
      function ensure() {
        if (ctx) return ctx
        var C = window.AudioContext || window.webkitAudioContext
        if (!C) return null
        try { ctx = new C() } catch (e) { ctx = null }
        return ctx
      }
      function hit(freq, dur, gain) {
        var ac = ensure()
        if (!ac) return
        try {
          var osc = ac.createOscillator()
          var g = ac.createGain()
          osc.type = 'triangle'
          osc.frequency.value = freq
          g.gain.value = 0
          osc.connect(g).connect(ac.destination)
          var t = ac.currentTime
          g.gain.linearRampToValueAtTime(gain, t + 0.01)
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
          osc.start(t)
          osc.stop(t + dur + 0.02)
        } catch (e) { /* decoration only */ }
      }
      return { tick: function () { hit(880, 0.06, 0.05) }, thunk: function () { hit(160, 0.22, 0.09) }, nope: function () { hit(120, 0.18, 0.08) }, click: function () { hit(1480, 0.035, 0.055); hit(990, 0.03, 0.02) } }
    }

    function postJSON(url, body) {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(function (r) {
        return r.json().catch(function () { return {} }).then(function (data) {
          return { status: r.status, data: data }
        })
      })
    }

    function mount() {
      // Already mounted (HMR reload or a second apply): keep the one overlay.
      if (document.getElementById(ROOT_ID)) return
      var style = document.createElement('style')
      style.id = 'boot-hm-style'
      style.textContent = CSS
      document.head.appendChild(style)

      var root = document.createElement('div')
      root.id = ROOT_ID
      root.innerHTML = TEMPLATE
      document.documentElement.appendChild(root)

      // 主题：auto 跟随系统，其余照设置来。
      function resolveTheme() {
        var saved = 'auto'
        try { saved = localStorage.getItem(BH_THEME_KEY) || 'auto' } catch (e) {}
        if (saved === 'light' || saved === 'dark') return saved
        try {
          return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light'
        } catch (e) { return 'dark' }
      }

      // 门（那张纸）按主题决定深浅；动画其余部分本来就是深色。
      try {
        var scEl = root.querySelector('.sc')
        if (scEl && resolveTheme() === 'dark') scEl.classList.add('dark')
      } catch (e) {}

      var sound = Beep()
      var finished = false
      var watchdog = null
      var onGateClosed = null   // 门前选过“打开账号界面”的话，进门后执行它

      // Cheap timeline so "it hangs" can be pinpointed instead of guessed.
      function mark(stage) {
        var ms = Math.round(performance.now())
        try { console.debug('[boot-handmade]', stage, ms + 'ms') } catch (e) {}
        // 也送到宿主留档：不出问题也能看出哪一段慢。
        try { postJSON('/boot-auth/timing', { stage: stage, ms: ms }) } catch (e) {}
      }

      // 进门后的设置入口。放在左侧「已登录 DeepSeek」那一块的上面一格，
      // 因为人找设置就往那儿看，不会去翻右下角。
      //
      // 但这块是 React 管的 DOM：只插一次，最多补插三次就当放弃，绝不装定时重排——
      // 之前每 2 秒重挂一次，直接把界面卡死过。
      function finish() {
        if (finished) return
        finished = true
        if (watchdog) { clearTimeout(watchdog); watchdog = null }
        mark('finish')
        try { sessionStorage.setItem(DONE_KEY, '1') } catch (e) { /* private mode */ }
        root.classList.add('out')
        setTimeout(function () {
          try { root.remove() } catch (e) {}
          try { style.remove() } catch (e) {}
        }, 700)
        // 门的样式被移除了，常驻入口要自己带一份。
      }

      // No auto-dismiss: a gate that removes itself after 90 seconds is just
      // another way to get in by waiting. The overlay leaves only when the gate
      // is actually resolved (PIN / Hello / code / 直接进入).

      function ring(pct) {
        var c = 339.29
        var el = $('bh-ring')
        if (el) el.style.strokeDashoffset = String(c - (c * pct) / 100)
        var num = $('bh-ringnum')
        if (num) num.textContent = (pct < 100 ? '0' : '') + Math.round(pct)
      }

      function setScene(name) {
        var all = root.querySelectorAll('.bh-scene')
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i].classList.contains(name))
      }

      function counter() {
        var start = Date.now()
        var timer = setInterval(function () {
          var pct = Math.min(99, ((Date.now() - start) / 1800) * 100)
          var el = $('bh-pct')
          if (el) el.textContent = String(Math.round(pct)).padStart(3, '0') + '%'
          if (pct >= 99) clearInterval(timer)
        }, 60)
      }

      function addRow(text) {
        var rows = $('bh-rows')
        if (!rows) return Promise.resolve()
        var row = document.createElement('div')
        row.className = 'bh-row'
        row.textContent = text
        rows.appendChild(row)
        requestAnimationFrame(function () { row.classList.add('on') })
        return wait(220)
      }

      function shake(node) {
        node.classList.remove('bh-shake')
        void node.offsetWidth
        node.classList.add('bh-shake')
      }

      // Maps the host's /boot-auth/hello result onto text a person can act on.
      // On some sensors (e.g. Goodix with an OEM driver whose private sensor
      // adapter fails at boot) the Windows Security prompt appears, says
      // "需要指纹验证", and then never starts a capture session: the dialog never
      // moves. That is a driver limitation, not a wrong finger, so say so.
      function helloReasonText(reason, availability) {
        var avail = String(availability || '')
        if (avail && avail !== 'Available') {
          return '本机没有可用的 Windows Hello（' + avail + '），请输入 PIN'
        }
        switch (reason) {
          case 'Canceled':
            return 'Windows Hello 已取消。若按了指纹却没反应，说明本机指纹在应用内不可用（驱动层未提供采样），请输入 PIN'
          case 'DeviceNotPresent':
            return '本机指纹 / 人脸在应用内不可用，请输入 PIN'
          case 'DeviceBusy':
            return '传感器正被其它程序占用，稍后再试或直接用 PIN'
          case 'Retry':
            return '这次没读出来，再试一次，或直接输入 PIN'
          case 'helper-missing':
            return '缺少 hello.ps1，无法调用 Windows Hello，请输入 PIN'
          case 'no-result':
            return 'Windows Hello 没有返回结果，请输入 PIN'
          case 'Error':
            return 'Windows Hello 调用出错，请输入 PIN'
          default:
            return 'Windows 验证未通过（' + (reason || '已取消') + '），请输入 PIN'
        }
      }

      // The gate: host-verified PIN (first run: enrolment), Windows Hello as the
      // primary shortcut, WeChat/QQ left as declared-but-unconfigured slots.
      function authGate() {
        return fetch('/boot-auth/status', { credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('no status')) })
          .catch(function () { return { offline: true } })
          .then(function (status) {
            return new Promise(function (resolve) {
              var box = $('bh-auth')
              var hint = $('bh-auth-hint')
              var input = $('bh-pin')
              var go = $('bh-go')
              var hello = $('bh-hello')
              var errBox = $('bh-auth-err')
              var direct = $('bh-direct')
              if (!box) return resolve('no-ui')
              // Escape hatch #1: the host-side flag file says the lock is off.
              if (status && status.bypass) return resolve('bypass')
              box.classList.add('on')
              box.addEventListener('pointerdown', function () { gateTouched = true }, true)
              box.addEventListener('keydown', function () { gateTouched = true }, true)

              var offline = !!status.offline
              var setup = !offline && status.configured === false
              if (offline) {
                hint.textContent = '预览模式 · 任意 4 位数字'
                altNote.textContent = '宿主未连接'
                hello.style.display = 'none'
              } else if (setup) {
                hint.textContent = '为了让这把锁生效，请先为它设置一个 PIN（4-32 位数字）'
                hello.style.display = 'none'
              } else if (status.hello === 'unavailable') {
                hello.style.display = 'none'
              }

              var gateClosed = false
              var helloBusy = false
              var autoHelloTried = false

              function done(how) {
                gateClosed = true
                box.classList.remove('on')
                input.value = ''
                resolve(how)
              }

              // Escape hatch #2: the visible "直接进入" entry, deliberately kept
              // next to the lock for the first releases and removed once the
              // gate has proven itself.
              if (direct) {
                direct.addEventListener('click', function () {
                  sound.click()
                  done('direct')
                })
              }

              function fail(text) {
                errBox.textContent = text
                shake(input)
                sound.nope()
                input.value = ''
                input.focus()
              }

              // 首次设置：第一次只是记住，第二次核对一致才真正落盘。
              // 单次输入就生效的话，一个手滑就把自己永久锁在外面。
              var pendingSetupPin = null

              function submit() {
                var pin = input.value.trim()
                if (!new RegExp('^\\d{' + PIN_MIN + ',' + PIN_MAX + '}$').test(pin)) {
                  return fail('PIN 需要 ' + PIN_MIN + '-' + PIN_MAX + ' 位数字')
                }
                if (offline) { sound.thunk(); return done('offline') }

                if (setup && pendingSetupPin === null) {
                  pendingSetupPin = pin
                  input.value = ''
                    paintCount()
                  hint.textContent = '请再输一次这个 PIN，确认没有按错'
                  errBox.textContent = ''
                  sound.tick()
                  try { input.focus() } catch (e) {}
                  return
                }
                if (setup && pendingSetupPin !== pin) {
                  pendingSetupPin = null
                  input.value = ''
                    paintCount()
                  hint.textContent = '为了让这把锁生效，请先为它设置一个 PIN（4-32 位数字）'
                  return fail('两次输入不一致，请重新设置')
                }
                if (setup) pendingSetupPin = null

                var target = setup ? '/boot-auth/enroll' : '/boot-auth/pin'
                go.disabled = true
                errBox.textContent = ''
                postJSON(target, { pin: pin })
                  .then(function (out) {
                    go.disabled = false
                    if (out.data && out.data.ok) { sound.thunk(); return done('pin') }
                    if (out.status === 429) {
                      // Not a forgotten PIN -- just too many wrong tries. Point
                      // at the code that skips the cooldown.
                      var until = out.data && out.data.lockedUntil
                      var left = until ? Math.max(1, Math.ceil((until - Date.now()) / 1000)) : 30
                      return fail('输错太多次，' + left + ' 秒后才能再试 · 也可以点「邮箱验证码跳过」')
                    }
                    // 输错时把“你实际输了几位”说出来：位数被截断或按错时，
                    // 一句话就能看出来，不用怀疑自己记错。
                    var why = (out.data && out.data.error) || '验证失败'
                    if (/PIN/.test(why)) why += '（这次输入 ' + pin.length + ' 位）'
                    fail(why)
                  })
                  .catch(function () { go.disabled = false; fail('宿主没有响应') })
              }

              go.addEventListener('click', function () { sound.click(); submit() })
              // 位数一律从这个函数算，不在别处硬编码任何长度。
              // 输入框本身是浏览器原生密码框：打字几位就几个点，点由浏览器画，
              // 我们只负责把"已输入几位 / 最多几位 / 还差几位"算出来给人看。
              var PIN_MIN = 4
              var PIN_MAX = 32
              var baseHint = '输入登录密码'

              function pinInfo(value) {
                var len = String(value || '').length
                return {
                  length: len,
                  tooShort: len > 0 && len < PIN_MIN,
                  okRange: len >= PIN_MIN && len <= PIN_MAX,
                  remaining: Math.max(0, PIN_MIN - len),
                  room: Math.max(0, PIN_MAX - len),
                }
              }

              function paintPin() {
                var info = pinInfo(input.value)
                if (info.length === 0) {
                  hint.textContent = baseHint + '（' + PIN_MIN + '-' + PIN_MAX + ' 位）'
                  return info
                }
                var tail = info.tooShort ? (' · 还差 ' + info.remaining + ' 位')
                                         : (' · 已输入 ' + info.length + ' 位')
                hint.textContent = baseHint + tail
                return info
              }
              var paintCount = paintPin   // 旧名字保留，避免漏改调用点
              // 眼睛只做一件事：把 input 的 type 在 password / text 之间切。
              // 数据始终在 input 里，切换不碰它的值，所以不可能“把 PIN 弄没”。
              var revealed = false
              var eyeBtn = $('bh-eye')
              var EYE_OPEN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
                '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" ' +
                'stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.8" ' +
                'fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
              var EYE_SHUT = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
                '<path d="M3 10s3.4 5 9 5 9-5 9-5" fill="none" stroke="currentColor" ' +
                'stroke-width="1.6" stroke-linecap="round"/>' +
                '<path d="M6.5 13.5l-1.2 2.2M12 15v2.4M17.5 13.5l1.2 2.2" fill="none" ' +
                'stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
              if (eyeBtn) {
                eyeBtn.addEventListener('click', function () {
                  revealed = !revealed
                  input.type = revealed ? 'text' : 'password'
                  eyeBtn.classList.toggle('on', revealed)
                  eyeBtn.setAttribute('aria-pressed', revealed ? 'true' : 'false')
                  eyeBtn.setAttribute('aria-label', revealed ? '隐藏密码' : '显示密码')
                  eyeBtn.innerHTML = revealed ? EYE_OPEN : EYE_SHUT
                  sound.click()
                  try { input.focus() } catch (e) {}
                })
              }

              input.addEventListener('input', paintCount)
              paintCount()

              input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); submit() }
              })

              // Windows Hello. The system dialog is the only fingerprint path
              // this sensor's driver supports (a user-session WinBio capture
              // access-violates inside winbio.dll), so the host raises that
              // dialog above everything and we announce it here: the dialog is
              // hosted by CredentialUIBroker and would otherwise sit behind us.
              function startHello(auto) {
                if (offline || helloBusy || gateClosed) return
                helloBusy = true
                errBox.textContent = ''
                hello.disabled = true
                hint.textContent = auto ? '等待指纹 / 人脸…' : '等待 Windows 验证…'
                postJSON('/boot-auth/hello', {}).then(function (out) {
                  helloBusy = false
                  hello.disabled = false
                  if (gateClosed) return
                  if (out.data && out.data.ok) { sound.thunk(); return done('hello') }
                  // Only a real rejection is a PIN error. A cancelled or broken
                  // Windows Hello prompt must not clear the PIN field or steal
                  // the focus from whatever the person was typing.
                  errBox.textContent = helloReasonText(
                    out.data && out.data.reason, out.data && out.data.availability)
                  sound.nope()
                }).catch(function () {
                  helloBusy = false
                  hello.disabled = false
                  if (!gateClosed) fail('无法调用 Windows Hello')
                })
              }

              hello.addEventListener('click', function () { sound.click(); startHello(false) })

              // Ask the host what this machine can do right now: the flag stored
              // at enrolment time goes stale as soon as a driver gets fixed.
              var helloAvailability = null

              // First-run onboarding must not be interrupted: while the
              // authenticator has not been set up yet, the gate waits for the
              // click instead of throwing the Hello dialog in the way.
              var gateTouched = false

              function maybeAutoHello() {
                if (helloAvailability !== 'Available' || !totpConfigured || autoHelloTried) return
                autoHelloTried = true
                // Give the person a beat to pick the code entry first: if they
                // touch the gate at all, do not throw the system dialog at them.
                setTimeout(function () {
                  if (gateTouched || gateClosed) return
                  startHello(true)
                }, 1500)
              }

              if (!offline && !setup) {
                postJSON('/boot-auth/hello/probe', {}).then(function (out) {
                  var avail = (out.data && out.data.availability) || 'unknown'
                  if (gateClosed) return
                  helloAvailability = avail
                  if (avail !== 'Available') {
                    hello.style.display = 'none'
                    return
                  }
                  hello.style.display = ''
                  maybeAutoHello()
                }).catch(function () {})
              }

              // Authenticator app (TOTP): a local secret, no provider at all.
              var totpSetupBtn = $('bh-totp-setup')
              var totpBox = $('bh-totp-box')
              var totpHint = $('bh-totp-hint')
              var totpSecretBox = $('bh-totp-secret')
              var totpInput = $('bh-totp-code')
              var totpGo = $('bh-totp-go')
              var totpConfigured = false

              function paintTotpStatus() {
                if (offline || gateClosed) return
                postJSON('/boot-auth/totp/status', {}).then(function (out) {
                  if (gateClosed || !totpSetupBtn) return
                  var data = out.data || {}
                  totpConfigured = !!data.configured
                  totpSetupBtn.style.display = ''
                  totpSetupBtn.textContent = totpConfigured
                    ? '用验证器 6 位码进入'
                    : '设置验证器（6 位动态码）'
                  maybeAutoHello()
                }).catch(function () {})
              }
              paintTotpStatus()

              if (totpSetupBtn) {
                totpSetupBtn.addEventListener('click', function () {
                  sound.click()
                  if (offline || gateClosed) return
                  if (totpConfigured) {
                    totpBox.style.display = ''
                    totpHint.textContent = '打开验证器 App，输入当前 6 位码（30 秒一换，过期就重输最新的）'
                    totpSecretBox.style.display = 'none'
                    try { totpInput.focus() } catch (e) {}
                    return
                  }
                  totpSetupBtn.disabled = true
                  errBox.textContent = ''
                  postJSON('/boot-auth/totp/setup', {}).then(function (out) {
                    totpSetupBtn.disabled = false
                    if (gateClosed) return
                    var data = out.data || {}
                    if (data.ok) {
                      totpConfigured = true
                      totpBox.style.display = ''
                      totpHint.textContent = '验证器 App →「其他账户」→「输入代码」，名称随意，密钥粘贴下面这串。备份码只显示这一次，抄下来收好：'
                      totpSecretBox.style.display = ''
                      totpSecretBox.textContent = [
                        data.secret,
                        '',
                        '备用码（每个只能用一次）：',
                        (data.backupCodes || []).join('  '),
                      ].join(String.fromCharCode(10))
                      totpSetupBtn.textContent = '用验证器 6 位码进入'
                      try { totpInput.focus() } catch (e) {}
                      return
                    }
                    if (data.error === 'totp-already-configured') {
                      totpConfigured = true
                      paintTotpStatus()
                      return
                    }
                    fail('验证器设置失败')
                  }).catch(function () { totpSetupBtn.disabled = false; fail('宿主没有响应') })
                })
              }

              function failTotp(text) {
                errBox.textContent = text
                shake(totpInput)
                sound.nope()
                totpInput.value = ''
                try { totpInput.focus() } catch (e) {}
              }

              function submitTotp() {
                if (offline || gateClosed) return
                var code = (totpInput.value || '').trim()
                if (!code) return failTotp('先填 6 位码或备用码')
                totpGo.disabled = true
                errBox.textContent = ''
                postJSON('/boot-auth/totp/verify', { code: code }).then(function (out) {
                  totpGo.disabled = false
                  if (gateClosed) return
                  var data = out.data || {}
                  if (data.ok) { sound.thunk(); return done('totp') }
                  if (out.status === 429) {
                    var until = data.lockedUntil
                    var left = until ? Math.max(1, Math.ceil((until - Date.now()) / 1000)) : 30
                    return failTotp('输错太多次，' + left + ' 秒后再试')
                  }
                  if (data.error === 'totp-not-configured') {
                    totpConfigured = false
                    paintTotpStatus()
                    return failTotp('验证器还没设置')
                  }
                  if (!data.error || out.status >= 500) {
                    // A body-less 400/500 means the host threw, not that the
                    // code was wrong. Do not tell people their code is bad.
                    return failTotp('宿主返回异常（HTTP ' + out.status + '）——这不是码的问题，把这条发我')
                  }
                  failTotp('码不对' + (data.remaining != null ? '，还剩 ' + data.remaining + ' 次' : ''))
                }).catch(function () { totpGo.disabled = false; if (!gateClosed) failTotp('宿主没有响应') })
              }

              if (totpGo) {
                totpGo.addEventListener('click', function () { sound.click(); submitTotp() })
                totpInput.addEventListener('input', function () {
                  // Backup codes carry letters, so only auto-fire on pure digits.
                  if (/^\d{6}$/.test(String(totpInput.value || ''))) submitTotp()
                })
                totpInput.addEventListener('keydown', function (e) {
                  if (e.key === 'Enter') { e.preventDefault(); submitTotp() }
                })
              }

              // 门上内嵌的「更改登录 PIN」：就在这页纸上展开，不是浮层。
              var pcLink = $('bh-pinchange')
              var pcBox = $('bh-pinchange-box')
              var pcCur = $('bh-pc-current')
              var pcNext = $('bh-pc-next')
              var pcConfirm = $('bh-pc-confirm')
              var pcGo = $('bh-pc-go')
              var pcMsg = $('bh-pc-msg')
              function pcSay(text, isError) {
                if (!pcMsg) return
                pcMsg.textContent = text
                pcMsg.style.color = isError ? '#ff2d55' : ''
              }
              if (pcLink && pcBox) {
                pcLink.addEventListener('click', function () {
                  sound.click()
                  var open = pcBox.style.display === 'none'
                  pcBox.style.display = open ? 'block' : 'none'
                  pcLink.textContent = open ? '收起' : '更改登录 PIN'
                  if (open) { try { pcCur.focus() } catch (e) {} }
                })
              }
              if (pcGo) {
                pcGo.addEventListener('click', function () {
                  var current = String(pcCur.value || '').trim()
                  var next = String(pcNext.value || '').trim()
                  var again = String(pcConfirm.value || '').trim()
                  if (!/^\d{4,32}$/.test(next)) return pcSay('新 PIN 需要 4-32 位数字', true)
                  if (next !== again) return pcSay('两次输入不一致', true)
                  if (!current) return pcSay('请先输入当前 PIN', true)
                  pcGo.disabled = true
                  pcSay('正在保存…')
                  postJSON('/boot-auth/pin/change', { current: current, next: next, confirm: again })
                    .then(function (out) {
                      pcGo.disabled = false
                      var data = out.data || {}
                      if (out.status === 200) {
                        pcCur.value = ''
                        pcNext.value = ''
                        pcConfirm.value = ''
                        sound.thunk()
                        return pcSay('已更新，下次开门用新 PIN')
                      }
                      pcSay(data.error || ('保存失败（HTTP ' + out.status + '）'), true)
                    })
                    .catch(function () { pcGo.disabled = false; pcSay('宿主没有响应', true) })
                })
              }

              setTimeout(function () { input.focus() }, 120)
            })
          })
      }

      // 宿主的设置页里改了外观，这里要能读到：
      // 门是每次启动重建的，所以每次开播前同步一次即可。
      async function syncHostSettings() {
        try {
          var out = await Promise.race([
            fetch('/boot-auth/settings', { credentials: 'same-origin' }),
            new Promise(function (r) { setTimeout(function () { r(null) }, 800) }),
          ])
          if (!out || !out.ok) return
          var data = await out.json()
          if (data && (data.theme === 'auto' || data.theme === 'light' || data.theme === 'dark')) {
            try { localStorage.setItem(BH_THEME_KEY, data.theme) } catch (e) {}
          }
        } catch (e) { /* 读不到就用本地记录，不影响开门 */ }
      }

      async function run() {
        mark('run-start')
        counter()
        await syncHostSettings()
        // The click must be acknowledged fast. Waiting 4.5 s in silence is what
        // makes people think the launch failed and click again (which starts
        // more processes). The gate is usable after ~1 s; the decorative beats
        // play *behind* it instead of blocking it.
        await wait(140)
        setScene('sb')
        $('bh-wash').classList.add('go')
        await wait(260)
        setScene('sc')
        sound.tick()

        ring(18)
        var zh = $('bh-zh'), en = $('bh-en'), note = $('bh-note'), st = $('bh-status')
        if (st) st.textContent = '01 / 08 | ACCESS'

        // Do not await: this is decoration, the gate does not depend on it.
        var dressing = typeInto(en, 'ACCESS PERMISSION REQUIRED', 18)
          .then(function () {
            if (note) note.textContent = '读取访问需求，建立可信通道。'
            ring(34)
          })
          .catch(function () {})

        st.textContent = '02 / 08 | GRANT'
        mark('gate-ready')
        await authGate()
        mark('unlocked')
        await dressing

        // The decoration below is theatre, so it must never be able to keep
        // somebody out. If anything in it stalls (a thrown typeInto, a tab that
        // throttles timers), this closes the gate anyway.
        watchdog = setTimeout(function () { watchdog = null; finish() }, 4000)

        zh.textContent = '身份资料确认'
        en.textContent = 'IDENTITY VERIFICATION'
        if (note) note.textContent = '核验操作者身份与权限等级。'
        ring(58)
        st.textContent = '05 / 08 | IDENTITY'

        // Decoration only — the unlock already happened. Rows land in a
        // staggered wave so the verification reads as work being done, instead
        // of a 0.6 s blink, without going back to one-await-per-row.
        typeInto(en, 'IDENTITY VERIFICATION', 14).catch(function () {})
        addRow('身份名称  OPERATOR').catch(function () {})
        setTimeout(function () { addRow('证件编号  DSH-0027-6.0.16').catch(function () {}) }, 200)
        setTimeout(function () { addRow('权限等级  LEVEL-3 · 已授权').catch(function () {}) }, 400)
        setTimeout(function () { ring(72); addRow('会话令牌  已签发 · TTL 12h').catch(function () {}) }, 600)
        setTimeout(function () { ring(86); addRow('审计记录  已落盘').catch(function () {}) }, 800)

        await wait(1150)

        zh.textContent = '读取完毕 · 核验通过'
        en.textContent = 'READ COMPLETE · VERIFIED'
        if (note) note.textContent = '权限已授予，正在进入工作区。'
        ring(100)
        st.textContent = '08 / 08 | VERIFY'
        await wait(380)
        sound.tick()
        await wait(420)

        finish()
        // The overlay is gone at this point; the app is interactive again.
        setTimeout(function () { if (onGateClosed) onGateClosed() }, 500)
        // 应用内不再放我们自己的入口：那块 UI 属于 DSH，插进去只会显得突兀。
        setTimeout(function () { try { maybeAnnounce() } catch (e) {} }, 1200)
      }

      run().catch(function (err) {
        try { console.error('[boot-handmade]', err) } catch (e) {}
        finish()
      })
    }

    exports.name = 'bootHandmade'
    exports.inject = []
    exports.apply = function () {
      if (typeof document === 'undefined') return
      // Ctrl+Alt+B replays the cold start without restarting the app. Replaying
      // the animation is not a way in: the gate still asks for PIN / Hello.
      try {
        document.addEventListener('keydown', function (e) {
          var k = String(e.key || '').toLowerCase()
          if ((e.ctrlKey && e.altKey && k === 'b') || (e.ctrlKey && e.shiftKey && k === 'b')) {
            try { sessionStorage.removeItem(DONE_KEY) } catch (err) { /* private mode */ }
            location.reload()
          }
        })
      } catch (e) { /* no document */ }
      try {
        if (sessionStorage.getItem(DONE_KEY) === '1') return
      } catch (e) { /* private mode: play it anyway */ }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { try { mount() } catch (e) { console.error(e) } }, { once: true })
      } else {
        mount()
      }
    }

    return module.exports
  }
})
