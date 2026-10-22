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
      '#boot-hm-root{position:fixed;inset:0;z-index:2147483000;overflow:hidden;',
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
      '@keyframes bh-wash{0%{opacity:0}38%{opacity:1}52%{opacity:1}100%{opacity:0}}',

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
      '.bh-glitch .sc-zh{animation:bh-aberr 90ms steps(2,end) 6}',
      '.bh-glitch .sc-frame{animation:bh-tear .42s steps(3,end) 2}',
      '@keyframes bh-aberr{0%{text-shadow:2px 0 #ff2d55,-2px 0 #00e0ff}',
      '50%{text-shadow:-3px 0 #ff2d55,3px 0 #00e0ff;transform:translateX(2px)}',
      '100%{text-shadow:0 0 transparent;transform:none}}',
      '@keyframes bh-tear{0%{clip-path:inset(0 0 92% 0)}50%{clip-path:inset(38% 0 42% 0)}',
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
      return { tick: function () { hit(880, 0.06, 0.05) }, thunk: function () { hit(160, 0.22, 0.09) }, nope: function () { hit(120, 0.18, 0.08) } }
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

      function finish() {
        if (finished) return
        finished = true
        try { sessionStorage.setItem(DONE_KEY, '1') } catch (e) { /* private mode */ }
        root.classList.add('out')
        setTimeout(function () {
          try { root.remove() } catch (e) {}
          try { style.remove() } catch (e) {}
        }, 700)
      }

      setTimeout(finish, 90000)

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
              var trial = $('bh-trial')
              if (!box) return resolve('no-ui')
              // Escape hatch #1: the host-side flag file says the lock is off.
              if (status && status.bypass) return resolve('bypass')
              box.classList.add('on')

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

              var idleTimer = null
              var countTimer = null

              function done(how) {
                if (idleTimer) clearTimeout(idleTimer)
                if (countTimer) clearInterval(countTimer)
                box.classList.remove('on')
                input.value = ''
                resolve(how)
              }

              // Escape hatch #2: the visible "直接进入" entry, deliberately kept
              // next to the lock for the first releases and removed once the
              // gate has proven itself.
              if (direct) {
                direct.addEventListener('click', function () {
                  sound.thunk()
                  done('direct')
                })
              }

              // Escape hatch #3: no input at all. Waiting is not a way in during
              // normal use, but a stuck gate must not become a stuck app.
              idleTimer = setTimeout(function () {
                var left = 10
                if (trial) trial.textContent = '长时间无操作 · ' + left + ' 秒后跳过'
                countTimer = setInterval(function () {
                  left -= 1
                  if (trial) trial.textContent = '长时间无操作 · ' + left + ' 秒后跳过'
                  if (left <= 0) done('idle-timeout')
                }, 1000)
              }, 45000)

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
                go.disabled = true
                errBox.textContent = ''
                postJSON(setup ? '/boot-auth/enroll' : '/boot-auth/pin', { pin: pin })
                  .then(function (out) {
                    go.disabled = false
                    if (out.data && out.data.ok) { sound.thunk(); return done('pin') }
                    fail((out.data && out.data.error) || '验证失败')
                  })
                  .catch(function () { go.disabled = false; fail('宿主没有响应') })
              }

              go.addEventListener('click', submit)
              input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); submit() }
              })

              hello.addEventListener('click', function () {
                if (offline) return
                errBox.textContent = ''
                hello.disabled = true
                hint.textContent = '等待 Windows 验证…'
                postJSON('/boot-auth/hello', {}).then(function (out) {
                  hello.disabled = false
                  if (out.data && out.data.ok) { sound.thunk(); return done('hello') }
                  hint.textContent = '输入访问 PIN'
                  fail('Windows 验证未通过（' + ((out.data && out.data.reason) || '已取消') + '）')
                }).catch(function () {
                  hello.disabled = false
                  fail('无法调用 Windows Hello')
                })
              })

              setTimeout(function () { input.focus() }, 120)
            })
          })
      }

      async function run() {
        counter()
        await wait(2300)
        setScene('sb')
        $('bh-wash').classList.add('go')
        await wait(760)
        setScene('sc')
        sound.tick()

        ring(18)
        var zh = $('bh-zh'), en = $('bh-en'), note = $('bh-note'), st = $('bh-status')
        if (st) st.textContent = '01 / 08 | ACCESS'
        await wait(420)
        await typeInto(en, 'ACCESS PERMISSION REQUIRED', 34)
        if (note) note.textContent = '读取访问需求，建立可信通道。'
        ring(34)
        await wait(200)

        st.textContent = '02 / 08 | GRANT'
        await authGate()

        zh.textContent = '身份资料确认'
        en.textContent = 'IDENTITY VERIFICATION'
        if (note) note.textContent = '核验操作者身份与权限等级。'
        ring(58)
        st.textContent = '05 / 08 | IDENTITY'
        await typeInto(en, 'IDENTITY VERIFICATION', 26)
        await addRow('身份名称  OPERATOR')
        await addRow('证件编号  DSH-0027-6.0.16')
        await addRow('权限等级  LEVEL-3 · 已授权')

        zh.textContent = '读取完毕 · 核验通过'
        en.textContent = 'READ COMPLETE · VERIFIED'
        if (note) note.textContent = '权限已授予，正在进入工作区。'
        ring(100)
        st.textContent = '08 / 08 | VERIFY'
        await wait(420)
        root.classList.add('bh-glitch')
        sound.tick()
        await wait(520)
        root.classList.remove('bh-glitch')

        await wait(320)
        finish()
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
