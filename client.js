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
      '.sc-btn{appearance:none;border:1px solid #14141a;background:#14141a;color:#f3eee4;',
      'padding:12px 22px;font-size:13px;letter-spacing:.16em;cursor:pointer;',
      'font-family:inherit;transition:transform .15s ease,background .2s ease}',
      '.sc-btn em{font-style:normal;font-size:10px;opacity:.55;margin-left:10px;letter-spacing:.2em}',
      '.sc-btn:hover{transform:translateY(-1px);background:#ff5a1f;border-color:#ff5a1f}',
      '.sc-btn:disabled{opacity:.45;cursor:default;transform:none;background:#14141a;border-color:#14141a}',
      '.bh-rows{display:flex;flex-direction:column;gap:8px;margin-top:20px;font-size:12px;',
      'letter-spacing:.12em;color:#3a3a44;min-height:84px}',
      '.bh-row{opacity:0;transform:translateY(4px);transition:opacity .3s ease,transform .3s ease}',
      '.bh-row.on{opacity:1;transform:none}',

      '.bh-auth{display:none;margin-top:22px;max-width:420px}',
      '.bh-auth.on{display:block}',
      '.bh-auth-hint{font-size:11px;letter-spacing:.22em;color:#6c675e;margin-bottom:10px}',
      '.bh-auth-row{display:flex;gap:10px;align-items:stretch}',
      '.bh-pin{flex:1;min-width:0;border:1px solid rgba(20,20,26,.3);background:#fffdf8;',
      'font-family:ui-monospace,Consolas,monospace;font-size:22px;letter-spacing:.5em;',
      'padding:10px 14px;color:#14141a;outline:none}',
      '.bh-pin:focus{border-color:#ff5a1f;box-shadow:0 0 0 3px rgba(255,90,31,.16)}',
      '.bh-hello{margin-top:10px;width:100%;border:1px dashed rgba(20,20,26,.34);background:transparent;',
      'color:#14141a;padding:10px 14px;font-family:inherit;font-size:12px;letter-spacing:.18em;',
      'cursor:pointer;transition:background .2s ease,border-color .2s ease}',
      '.bh-hello:hover{background:rgba(255,90,31,.08);border-color:#ff5a1f}',
      '.bh-recover{margin-top:6px;width:100%;border:0;background:transparent;color:#8d887e;',
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
      '.bh-direct{margin-top:10px;width:100%;border:0;background:transparent;color:#8d887e;',
      'font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.2em;',
      'cursor:pointer;padding:8px 0;text-decoration:underline;text-underline-offset:4px;',
      'text-decoration-color:rgba(20,20,26,.22);transition:color .2s ease}',
      '.bh-direct:hover{color:#ff5a1f;text-decoration-color:#ff5a1f}',
      '.bh-trial{margin-top:4px;font-size:9px;letter-spacing:.16em;color:#b3ada2}',
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
      '<div class="bh-auth-hint bh-mono" id="bh-auth-hint">输入访问 PIN</div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-pin" type="password" inputmode="numeric" maxlength="8"',
      ' autocomplete="off" spellcheck="false" aria-label="访问 PIN">',
      '<button class="sc-btn" id="bh-go" type="button">解锁</button>',
      '</div>',
      '<button class="bh-hello bh-mono" id="bh-hello" type="button">WINDOWS HELLO · 指纹 / 人脸 / PIN</button>',
      '<button class="bh-recover bh-mono" id="bh-recover" type="button">PIN 输错被锁了？用验证码跳过</button>',
      '<div class="bh-recover-box" id="bh-recover-box" style="display:none">',
      '<div class="bh-recover-hint bh-mono" id="bh-recover-hint"></div>',
      '<div class="bh-auth-row">',
      '<input class="bh-pin" id="bh-code" type="text" inputmode="numeric" maxlength="6"',
      ' autocomplete="one-time-code" spellcheck="false" aria-label="邮箱验证码">',
      '<button class="sc-btn" id="bh-code-go" type="button">验证</button>',
      '</div>',
      '</div>',
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
      '<button class="bh-recover bh-mono" id="bh-pinchange" type="button">修改访问 PIN</button>',
      '<div class="bh-recover-box" id="bh-pinchange-box" style="display:none">',
      '<div class="bh-recover-hint" id="bh-pinchange-hint">'
      + '刚验证过就不用填当前 PIN；否则先输当前 PIN。改完不会退出登录。</div>',
      '<div class="bh-auth-row"><input class="bh-pin" id="bh-pc-current" type="password"',
      ' inputmode="numeric" maxlength="8" autocomplete="current-password"',
      ' spellcheck="false" placeholder="当前 PIN（刚验证过可留空）" aria-label="当前 PIN"></div>',
      '<div class="bh-auth-row"><input class="bh-pin" id="bh-pc-next" type="password"',
      ' inputmode="numeric" maxlength="8" autocomplete="new-password"',
      ' spellcheck="false" placeholder="新 PIN（4-8 位数字）" aria-label="新 PIN"></div>',
      '<div class="bh-auth-row"><input class="bh-pin" id="bh-pc-confirm" type="password"',
      ' inputmode="numeric" maxlength="8" autocomplete="new-password"',
      ' spellcheck="false" placeholder="再输一次新 PIN" aria-label="确认新 PIN">',
      '<button class="sc-btn" id="bh-pc-go" type="button">保存</button></div>',
      '<div class="bh-recover-hint" id="bh-pc-msg"></div>',
      '</div>',
      '<button class="bh-direct bh-mono" id="bh-direct" type="button">直接进入（跳过验证）</button>',
      '<div class="bh-trial bh-mono" id="bh-trial">双入口模式 · 稳定后会把「直接进入」移除</div>',
      '<div class="bh-auth-err" id="bh-auth-err"></div>',
      '<div class="bh-alt bh-mono">微信 / QQ <span id="bh-alt-note">未配置</span></div>',
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
      function ensureEntryStyles() {
        if (document.getElementById('bh-entry-style')) return
        var style = document.createElement('style')
        style.id = 'bh-entry-style'
        style.textContent = [
          '#bh-side{display:flex;align-items:center;gap:8px;padding:7px 10px;margin:2px 6px;',
          'border-radius:8px;cursor:pointer;color:#8d887e;font-size:12px;',
          'transition:background .15s ease,color .15s ease}',
          '#bh-side:hover{background:#1d1d26;color:#f3eee4}',
          '#bh-side .bh-side-ico{font-size:13px;line-height:1;opacity:.85}',
          '#bh-menu{position:fixed;z-index:2147483646;display:none;min-width:168px;padding:6px;',
          'border:1px solid #3a3a46;border-radius:8px;background:#14141a;',
          'box-shadow:0 12px 34px rgba(0,0,0,.55)}',
          '#bh-menu button{display:block;width:100%;text-align:left;padding:8px 10px;border:0;',
          'border-radius:5px;background:transparent;color:#c9c3b8;font-size:12.5px;cursor:pointer}',
          '#bh-menu button:hover{background:#232330;color:#f3eee4}',
          '#bh-manage{position:fixed;z-index:2147483647;width:330px;display:none;padding:18px;',
          'border:1px solid #3a3a46;border-radius:10px;background:#14141a;',
          'box-shadow:0 18px 50px rgba(0,0,0,.6);color:#f3eee4}',
          '#bh-manage h4{margin:0 0 12px;font-size:13px;letter-spacing:.1em;color:#f3eee4}',
          '#bh-manage .bh-manage-row{margin-bottom:9px}',
          '#bh-manage .bh-manage-note{font-size:11px;color:#8d887e;line-height:1.65;margin-top:8px}',
          '#bh-manage .bh-manage-close{position:absolute;top:2px;right:2px;border:0;z-index:5;',
          'width:32px;height:32px;line-height:30px;text-align:center;border-radius:6px;',
          'background:transparent;color:#8d887e;font-size:17px;cursor:pointer}',
          '#bh-manage .bh-manage-close:hover{background:#232330;color:#f3eee4}',
          '#bh-manage .bh-pin{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:6px;',
          'border:1px solid #3a3a46;background:#0f0f14;color:#f3eee4;font-size:13px;outline:none}',
          '#bh-manage .bh-pin:focus{border-color:#ff5a1f}',
          '#bh-manage .sc-btn{width:100%;padding:9px;border:0;border-radius:6px;background:#ff5a1f;',
          'color:#14141a;font-weight:600;font-size:13px;cursor:pointer}',
          '#bh-manage label.bh-toggle{display:flex;align-items:center;gap:9px;font-size:12.5px;',
          'color:#c9c3b8;cursor:pointer}',
          '#bh-fab{position:fixed;right:20px;bottom:20px;z-index:2147483645;width:44px;height:44px;',
          'border-radius:50%;border:1px solid #3a3a46;background:#14141a;color:#8d887e;',
          'font-size:18px;line-height:42px;text-align:center;cursor:pointer}',
          '#bh-fab:hover{border-color:#ff5a1f;color:#ff5a1f}',
        ].join('')
        document.head.appendChild(style)
      }

      // 找到「已登录 …」那一行，插到它前面，正好夹在「新版本」和它之间。
      function insertInSidebar(node) {
        var all = document.querySelectorAll('div,span,a,button,p')
        for (var i = 0; i < all.length; i += 1) {
          var el = all[i]
          if (el.children && el.children.length) continue
          var txt = (el.textContent || '').trim()
          if (!txt || txt.length > 40) continue
          if (txt.indexOf('已登录') === -1) continue
          var row = el.parentElement
          if (!row || !row.parentElement) continue
          row.parentElement.insertBefore(node, row)
          return true
        }
        return false
      }

      function mountInAppEntry() {
        if (document.getElementById('bh-side') || document.getElementById('bh-fab')) return
        ensureEntryStyles()

        // ---- 面板 ----
        var panel = document.createElement('div')
        panel.id = 'bh-manage'
        panel.innerHTML =
          '<button class="bh-manage-close" type="button" aria-label="关闭">×</button>' +
          '<h4 id="bh-m-title">更改登录 PIN</h4>' +
          '<div class="bh-sec" id="bh-sec-login">' +
          '<div class="bh-manage-row"><input class="bh-pin" id="bh-m-current" type="password" maxlength="8" placeholder="当前 PIN" /></div>' +
          '<div class="bh-manage-row"><input class="bh-pin" id="bh-m-next" type="password" maxlength="8" placeholder="新 PIN（4-8 位数字）" /></div>' +
          '<div class="bh-manage-row"><input class="bh-pin" id="bh-m-confirm" type="password" maxlength="8" placeholder="再输一次新 PIN" /></div>' +
          '<div class="bh-manage-row"><button class="sc-btn" id="bh-m-go" type="button">保存</button></div>' +
          '<div class="bh-manage-note" id="bh-m-msg">改完不会退出登录，下次开门用新 PIN。</div>' +
          '</div>' +
          '<div class="bh-sec" id="bh-sec-splash" style="display:none">' +
          '<label class="bh-toggle"><input type="checkbox" id="bh-splash-toggle" /> 点启动器时显示小窗</label>' +
          '<div class="bh-manage-note">关掉之后点快捷方式就是直接启动，没有任何界面。<br/>' +
          '打开时会显示步骤和百分比，方便判断是不是卡住了。</div>' +
          '</div>' +
          '<div class="bh-sec" id="bh-sec-launcher" style="display:none">' +
          '<div class="bh-manage-note" id="bh-l-state">启动方式：检查中…</div>' +
          '<div class="bh-manage-row"><button class="sc-btn" id="bh-l-go" type="button">启用桌面启动器</button></div>' +
          '</div>'
        document.documentElement.appendChild(panel)

        // ---- 入口：优先侧栏，失败退回右下角 ----
        var trigger = document.createElement('div')
        trigger.id = 'bh-side'
        trigger.innerHTML = '<span class="bh-side-ico">⚙</span><span>设置</span>'
        trigger.title = '设置：登录 PIN / 启动小窗 / 桌面启动器'
        var placed = insertInSidebar(trigger)
        if (!placed) {
          trigger.remove()
          trigger = document.createElement('button')
          trigger.id = 'bh-fab'
          trigger.type = 'button'
          trigger.textContent = '⚙'
          document.documentElement.appendChild(trigger)
        }

        // ---- 悬停菜单 ----
        var menu = document.createElement('div')
        menu.id = 'bh-menu'
        menu.innerHTML =
          '<button type="button" data-what="login">更改登录 PIN</button>' +
          '<button type="button" data-what="splash">启动小窗</button>' +
          '<button type="button" data-what="launcher">桌面启动器</button>'
        document.documentElement.appendChild(menu)

        var title = panel.querySelector('#bh-m-title')
        var secs = {
          login: panel.querySelector('#bh-sec-login'),
          splash: panel.querySelector('#bh-sec-splash'),
          launcher: panel.querySelector('#bh-sec-launcher'),
        }
        var titles = { login: '更改登录 PIN', splash: '启动小窗', launcher: '桌面启动器' }

        function showSection(what) {
          Object.keys(secs).forEach(function (k) {
            if (secs[k]) secs[k].style.display = k === what ? 'block' : 'none'
          })
          if (title) title.textContent = titles[what] || ''
          var r = trigger.getBoundingClientRect()
          panel.style.left = Math.min(window.innerWidth - 350, Math.max(8, r.right + 10)) + 'px'
          panel.style.top = Math.max(8, Math.min(window.innerHeight - 320, r.top)) + 'px'
          panel.style.display = 'block'
          if (what === 'launcher') refreshLauncher()
          if (what === 'splash') refreshSplash()
        }

        function placeMenu() {
          var r = trigger.getBoundingClientRect()
          menu.style.display = 'block'
          menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 190)) + 'px'
          var top = r.top - menu.offsetHeight - 6
          menu.style.top = (top < 8 ? r.bottom + 6 : top) + 'px'
        }
        function hideMenu() { menu.style.display = 'none' }
        function hidePanel() { panel.style.display = 'none' }

        var hoverTimer = null
        trigger.addEventListener('mouseenter', function () {
          if (hoverTimer) clearTimeout(hoverTimer)
          placeMenu()
        })
        trigger.addEventListener('mouseleave', function () {
          hoverTimer = setTimeout(function () { if (!menu.matches(':hover')) hideMenu() }, 180)
        })
        trigger.addEventListener('click', function (e) {
          e.stopPropagation()
          if (menu.style.display === 'block') hideMenu()
          else placeMenu()
        })
        menu.addEventListener('mouseleave', hideMenu)
        menu.querySelectorAll('button').forEach(function (btn) {
          btn.addEventListener('click', function () {
            hideMenu()
            showSection(btn.getAttribute('data-what'))
          })
        })
        panel.querySelector('.bh-manage-close').addEventListener('click', function (e) {
          e.stopPropagation()
          hidePanel()
        })
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { hidePanel(); hideMenu() }
        })
        document.addEventListener('mousedown', function (e) {
          if (panel.style.display !== 'block') return
          if (panel.contains(e.target) || trigger.contains(e.target)) return
          hidePanel()
        }, true)

        // ---- PIN ----
        var msg = panel.querySelector('#bh-m-msg')
        function say(text) { if (msg) msg.textContent = text }
        panel.querySelector('#bh-m-go').addEventListener('click', function () {
          var cur = String(panel.querySelector('#bh-m-current').value || '').trim()
          var next = String(panel.querySelector('#bh-m-next').value || '').trim()
          var confirm_ = String(panel.querySelector('#bh-m-confirm').value || '').trim()
          if (!/^\d{4,8}$/.test(next)) return say('新 PIN 需要 4-8 位数字')
          if (next !== confirm_) return say('两次输入不一致')
          say('正在保存…')
          postJSON('/boot-auth/pin/change', { current: cur, next: next, confirm: confirm_ })
            .then(function (out) {
              var data = out.data || {}
              if (out.status === 200) {
                panel.querySelector('#bh-m-current').value = ''
                panel.querySelector('#bh-m-next').value = ''
                panel.querySelector('#bh-m-confirm').value = ''
                return say('已更新，下次开门用新 PIN。')
              }
              say(data.error || ('保存失败（HTTP ' + out.status + '）'))
            })
            .catch(function () { say('宿主没有响应') })
        })

        // ---- 启动小窗开关 ----
        var splashBox = panel.querySelector('#bh-splash-toggle')
        function refreshSplash() {
          postJSON('/boot-auth/settings', {}).then(function (out) {
            if (splashBox && out.data) splashBox.checked = out.data.splashEnabled !== false
          }).catch(function () {})
        }
        if (splashBox) {
          splashBox.addEventListener('change', function () {
            postJSON('/boot-auth/settings', { splashEnabled: !!splashBox.checked })
          })
        }

        // ---- 桌面启动器 ----
        var lState = panel.querySelector('#bh-l-state')
        var lGo = panel.querySelector('#bh-l-go')
        var installed = false
        function paintLauncher(status) {
          installed = !!(status && status.installed)
          if (!lState || !lGo) return
          if (status && status.available === false) {
            lState.textContent = '启动方式：这个版本里没有启动器文件'
            lGo.disabled = true
            return
          }
          lState.textContent = installed
            ? '启动方式：已启用（桌面有 Launcher 快捷方式）'
            : '启动方式：未启用（原来的快捷方式照旧）'
          lGo.textContent = installed ? '卸载启动器' : '启用桌面启动器'
          lGo.disabled = false
        }
        function refreshLauncher() {
          postJSON('/boot-auth/launcher', { action: 'status' })
            .then(function (out) { paintLauncher(out.data) })
            .catch(function () { if (lState) lState.textContent = '启动方式：读不到状态' })
        }
        if (lGo) {
          lGo.addEventListener('click', function () {
            lGo.disabled = true
            if (lState) lState.textContent = '启动方式：' + (installed ? '正在卸载…' : '正在创建快捷方式…')
            postJSON('/boot-auth/launcher', { action: installed ? 'uninstall' : 'install' })
              .then(function (out) { paintLauncher(out.data) })
              .catch(function () { if (lState) lState.textContent = '启动方式：宿主没有响应' })
          })
        }

        // 只补插三次：React 重渲染会顺手清掉外来节点，补几次够用，多了就是折腾它。
        var repairs = 0
        var watcher = setInterval(function () {
          repairs += 1
          if (!document.documentElement.contains(trigger) && repairs <= 3) {
            var again = document.createElement('div')
            again.id = 'bh-side'
            again.innerHTML = '<span class="bh-side-ico">⚙</span><span>设置</span>'
            if (!insertInSidebar(again)) again.remove()
          }
          if (repairs >= 3) clearInterval(watcher)
        }, 4000)
      }

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
        try { mountInAppEntry() } catch (e) {}
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
              var altNote = $('bh-alt-note')
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
                hint.textContent = '首次启动 · 设置访问 PIN（4-8 位数字）'
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

              function submit() {
                var pin = input.value.trim()
                if (!/^\d{4,8}$/.test(pin)) return fail('PIN 需要 4-8 位数字')
                if (offline) { sound.thunk(); return done('offline') }
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
                      if (recoverBtn) recoverBtn.classList.add('hot')
                      return fail('输错太多次，' + left + ' 秒后才能再试 · 也可以点「邮箱验证码跳过」')
                    }
                    fail((out.data && out.data.error) || '验证失败')
                  })
                  .catch(function () { go.disabled = false; fail('宿主没有响应') })
              }

              go.addEventListener('click', function () { sound.click(); submit() })
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
                if (altNote) altNote.textContent = '系统验证窗已置顶 · 取消则回到 PIN'
                postJSON('/boot-auth/hello', {}).then(function (out) {
                  helloBusy = false
                  hello.disabled = false
                  if (gateClosed) return
                  if (out.data && out.data.ok) { sound.thunk(); return done('hello') }
                  if (altNote) altNote.textContent = ''
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
                    if (altNote) altNote.textContent = '本机 Windows Hello 不可用（' + avail + '）· 用 PIN 进入'
                    return
                  }
                  hello.style.display = ''
                  maybeAutoHello()
                }).catch(function () {})
              }

              // Email recovery: the way back in when the PIN is forgotten. The
              // host mails a 6-digit code (5 minutes, single use, at most 3 an
              // hour), then the gate asks for a new PIN.
              var recoverBtn = $('bh-recover')
              var recoverBox = $('bh-recover-box')
              var recoverHint = $('bh-recover-hint')
              var codeInput = $('bh-code')
              var codeGo = $('bh-code-go')

              function recoveryProblem(data) {
                var code = data && data.error
                if (code === 'smtp-not-configured') return '邮件救援没配置完：还缺 SMTP 授权码'
                if (code === 'recovery-not-configured') return '邮件救援没配置完：没有收件地址'
                if (code === 'cooldown') return '刚发过一封，等一分钟再试'
                if (code === 'too-many') return '这一小时申请太多次了，稍后再试'
                if (code === 'send-failed') return '发送失败：' + ((data && data.detail) || '未知错误')
                if (code === 'expired') return '验证码过期了，重新申请一封'
                if (code === 'bad-code') {
                  return '验证码不对' + (data.remaining != null ? '，还剩 ' + data.remaining + ' 次' : '')
                }
                if (code === 'no-active-code') return '还没有申请验证码'
                if (code === 'too-many-attempts') return '试太多次了，重新申请一封'
                return '邮件救援不可用'
              }

              if (recoverBtn) {
                recoverBtn.addEventListener('click', function () {
                  sound.click()
                  if (offline || gateClosed) return
                  recoverBtn.disabled = true
                  errBox.textContent = ''
                  postJSON('/boot-auth/recover/start', {}).then(function (out) {
                    recoverBtn.disabled = false
                    if (gateClosed) return
                    var data = out.data || {}
                    if (data.ok) {
                      recoverBox.style.display = ''
                      recoverHint.textContent = (data.channel === 'sms' ? '短信验证码' : '邮件验证码') +
                        '已发往 ' + (data.masked || '你的设备') + ' · 5 分钟内有效'
                      hint.textContent = '输入邮件里的 6 位验证码'
                      try { codeInput.focus() } catch (e) {}
                      return
                    }
                    fail(recoveryProblem(data))
                  }).catch(function () {
                    recoverBtn.disabled = false
                    if (!gateClosed) fail('宿主没有响应')
                  })
                })
              }

              function verifyCode() {
                if (offline || gateClosed) return
                var code = (codeInput.value || '').trim()
                if (!/^\d{6}$/.test(code)) return fail('验证码是 6 位数字')
                codeGo.disabled = true
                errBox.textContent = ''
                postJSON('/boot-auth/recover/verify', { code: code }).then(function (out) {
                  codeGo.disabled = false
                  if (gateClosed) return
                  var data = out.data || {}
                  if (data.ok) {
                    // The code is a way in, nothing more: the PIN stays as it
                    // was. (Our PIN is a scrypt hash in boot-auth.json; it has
                    // nothing to do with the Windows Hello PIN.)
                    sound.thunk()
                    return done('recover')
                  }
                  fail(recoveryProblem(data))
                }).catch(function () { codeGo.disabled = false; if (!gateClosed) fail('宿主没有响应') })
              }

              if (codeGo) {
                codeGo.addEventListener('click', function () { sound.click(); verifyCode() })
                codeInput.addEventListener('keydown', function (e) {
                  if (e.key === 'Enter') { e.preventDefault(); verifyCode() }
                })
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

              // Change the PIN from here. The whole reason this exists: the old
              // Accounts belong to the app, not to us: this only opens the app's
              // own account UI once the gate is gone. The reason it exists at all
              // is that people cannot find that entry themselves.
              var acBtn = $('bh-account'), acBox = $('bh-account-box')
              var acGo = $('bh-account-go'), acMsg = $('bh-account-msg')
              var openAccountAfterGate = false

              if (acBtn && acBox) {
                acBtn.addEventListener('click', function () {
                  sound.click()
                  acBox.style.display = acBox.style.display === 'none' ? 'block' : 'none'
                  if (acBox.style.display === 'block' && acGo) acGo.focus()
                })
              }
              if (acGo) {
                acGo.addEventListener('click', function () {
                  sound.click()
                  openAccountAfterGate = true
                  if (acMsg) acMsg.textContent = '先完成验证，进入后自动打开账号菜单。'
                  if (acGo) acGo.disabled = true
                })
              }

              // Best effort, but harmless: if none of these match, the person is
              // already inside and the app is exactly where it started.
              onGateClosed = function () {
                if (openAccountAfterGate) openAppAccountUi()
              }

              function openAppAccountUi() {
                if (!openAccountAfterGate) return
                openAccountAfterGate = false
                var selectors = [
                  '[data-testid="account"]', '[data-testid="user-menu"]',
                  '[aria-label*="账号"]', '[aria-label*="帐号"]', '[aria-label*="account" i]',
                  '.account-chip', '.user-menu', '.avatar',
                ]
                var tries = 0
                var timer = setInterval(function () {
                  tries += 1
                  for (var i = 0; i < selectors.length; i += 1) {
                    var el = document.querySelector(selectors[i])
                    if (el) {
                      clearInterval(timer)
                      try { el.click() } catch (e) {}
                      return
                    }
                  }
                  if (tries >= 30) clearInterval(timer)   // give up after ~3 s
                }, 100)
              }

              // way meant leaving the app, and a half-finished change out there
              // could lock an account nobody can open.
              var pcBtn = $('bh-pinchange'), pcBox = $('bh-pinchange-box')
              var pcCur = $('bh-pc-current'), pcNext = $('bh-pc-next')
              var pcConfirm = $('bh-pc-confirm'), pcGo = $('bh-pc-go'), pcMsg = $('bh-pc-msg')

              function pcSay(text) { if (pcMsg) pcMsg.textContent = text }

              if (pcBtn && pcBox) {
                pcBtn.addEventListener('click', function () {
                  sound.click()
                  pcBox.style.display = pcBox.style.display === 'none' ? 'block' : 'none'
                  if (pcBox.style.display === 'block' && pcNext) pcNext.focus()
                })
              }

              if (pcGo) {
                pcGo.addEventListener('click', function () {
                  sound.click()
                  var next = String(pcNext && pcNext.value || '').trim()
                  var confirm = String(pcConfirm && pcConfirm.value || '').trim()
                  var current = String(pcCur && pcCur.value || '').trim()
                  if (!/^\d{4,8}$/.test(next)) return pcSay('新 PIN 需要 4-8 位数字')
                  if (next !== confirm) return pcSay('两次输入不一致')
                  pcGo.disabled = true
                  pcSay('正在保存…')
                  postJSON('/boot-auth/pin/change', { current: current, next: next, confirm: confirm })
                    .then(function (out) {
                      pcGo.disabled = false
                      var data = out.data || {}
                      if (out.status === 200) {
                        if (pcNext) pcNext.value = ''
                        if (pcConfirm) pcConfirm.value = ''
                        if (pcCur) pcCur.value = ''
                        sound.tick()
                        return pcSay('已更新。下次开门用新的 PIN。')
                      }
                      if (data.error === '需要先验证身份' || data.error === '当前 PIN 不对') {
                        if (pcCur) pcCur.focus()
                      }
                      pcSay(data.error || ('保存失败（HTTP ' + out.status + '）'))
                    })
                    .catch(function () { pcGo.disabled = false; pcSay('宿主没有响应') })
                })
              }

              setTimeout(function () { input.focus() }, 120)
            })
          })
      }

      async function run() {
        mark('run-start')
        counter()
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
