# dsh-boot-handmade

> 仓库名：`dsh-startup-auth-cn` · 包名：`dsh-boot-handmade`（两者故意不同，包名是装进 profile 的标识）

> 给 DeepSeek Harness 手搓的开机门：六幕冷启动动画，加上一把真正拦得住人的锁。
> **纯前端 + 本地宿主半，零依赖、零联网、零第三方服务。**

<!-- 放一张 GIF 或截图：把 boot.gif 放到 docs/ 下再改这里 -->
<!-- ![预览](docs/boot.gif) -->

视觉语言参考了 B 站视频《deepseek 那些豪气冲天的启动动画》（[@熟橘枯摘](https://space.bilibili.com/3546608889236009) · [BV1T7nM6xEqo](https://www.bilibili.com/video/BV1T7nM6xEqo)）——完整的出处链和三位更早的作者见图末「[参考动画与致谢](#参考动画与致谢)」。
全部用 DOM + CSS + SVG 画出来，没有视频、没有位图、没有第三方素材，任意分辨率都清晰；音效是 WebAudio 现场合成的。

## 它是什么

DeepSeek Harness 启动时先播一段六幕的开机动画（黑屏描边 → 过曝白闪 → 技术档案 → 权限门 → 核验 → 进入），
然后停在一道**验证门**前：输 PIN、按指纹、或者填验证器动态码，三者任意一个通过才进得去工作区。

它不是"开机自启个小窗"那种装饰，是**档在应用前面的最后一步**。

## 三种开门方式

| 方式 | 说明 |
|---|---|
| **访问 PIN** | 4–8 位数字，scrypt 加盐哈希存本地，连续错 5 次锁 30 秒 |
| **Windows Hello** | 调用系统凭据验证（指纹 / 人脸 / Hello PIN），并把系统窗口强制置顶，不会被应用挡住 |
| **验证器动态码** | 标准 TOTP（RFC 6238），手机扫码或手输密钥即可，**完全离线**；配 8 个一次性备用码防手机丢失 |

## 安装

```powershell
# 1. 克隆到任意目录
git clone https://github.com/zoushangkun-dev/dsh-startup-auth-cn.git

# 2. 装进 desktop profile（link 方式，改代码即时生效）
& "D:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<克隆到的路径>"

# 3. 重开客户端
```

Windows 用户也可以直接双击仓库里的 `安装.cmd`（会先检查客户端是否已退出）。

> 装在哪个路径都可以，但**不要放在会被清理的临时目录**——profile 里存的是软链。
> 客户端运行中直接装通常会成功（实测 pnpm 3.7 秒）；如果报 `EPERM ... package.json.lock`，退出客户端再装。

## 首次使用

1. 重新打开客户端，动画播完会出现验证门；
2. 先设一个 4–8 位 PIN（这一步会同时把你放进去）；
3. 之后再启动，可以直接输 PIN，也可以点「用验证器 6 位码进入」先配好验证器。

**强烈建议配置验证器**：点「设置验证器（6 位动态码）」→ 屏幕给出 32 位密钥 + 8 个备用码 →
手机装 Microsoft Authenticator / Google Authenticator，选「其他账户 → 输入代码」，把密钥粘进去。

> 那 8 个备用码**只显示一次**，请抄在纸上或存进密码管理器。手机丢了或刷机了，它是唯一退路。

## 配置与数据

全部在本机 `~/.dsh/` 下，插件不联网、不上传任何东西：

| 文件 | 内容 |
|---|---|
| `boot-auth.json` | PIN 的 scrypt 哈希 + salt（不存明文） |
| `boot-totp.json` | TOTP 密钥 + 备用码的 scrypt 哈希 |
| `boot-recover.json` | 可选的邮件救援配置（收件地址 + SMTP 授权码） |

## 逃生口与回滚

| 场景 | 怎么做 |
|---|---|
| 忘了 PIN / 被锁 30 秒 | 点「用验证器 6 位码进入」，或填备用码 |
| 手机和电脑都不在手上 | 双击 `急救绕过.cmd`，创建一个标记文件，宿主看到就直接放行 |
| 想彻底撤掉 | 双击 `卸载.cmd`，或 `dsh plugin --profile desktop remove dsh-boot-handmade` |
| 想退回旧版本 | 双击 `回滚.cmd` 选择目标提交 |

> 急救标记是一个本地文件：`%USERPROFILE%\.dsh\boot-auth-bypass`。删掉它（或双击 `恢复锁定.cmd`）即恢复验证。
> **门不会因为"等久了"自己打开**——没有倒计时放行，也没有超时自动进入。

## 安全边界（请先读这段）

**它是仪式感 + 家用门闩，不是保险箱。**

- 这个锁保护的是**动画和验证这一层**，不是整个 Web 服务：懂技术的人可以打开开发者工具删掉遮罩节点，或者直接调宿主接口。
- 真正的强制门禁必须做在应用外壳前面（Electron 主进程 / 系统级），profile 插件够不着。
- PIN 是 scrypt 加盐哈希，会话令牌只在内存，错 5 次锁 30 秒；TOTP 密钥和备用码哈希都在本机。
- 但如果有人已经能读写你的用户目录，他可以直接删掉 `boot-auth.json` 绕过一切——这是本地锁的固有边界。

换句话说：别把唯一一份重要数据的访问权押在它身上。

## 常见问题

**Q：点「Windows Hello」后系统窗口没出现，或者出现在应用后面？**
A：插件会把 `Credential Dialog Xaml Host` 那个窗口强制置顶并抢前台。仍然没出现的话，先到锁屏试试指纹是否正常；不正常说明是本机指纹驱动在用户会话里起不来，需要修驱动，和插件无关。

**Q：验证器填了码一直说不对？**
A：确认填的是 6 位、且是**当前**显示的码（30 秒一换，插件容忍前后 60 秒）。手机和电脑时间差太多也会对不上。

**Q：动画太长 / 太闪？**
A：门在约 0.8 秒后就可操作，装饰文字在门后面并行播放，不阻塞输入。频闪和撕裂效果已移除。

**Q：能改成英文界面吗？**
A：目前界面文案是中文，代码里没有硬编码依赖，欢迎 PR。

## 技术细节

- 动画：纯 DOM + CSS + SVG，**没有图片、没有字体文件、没有构建步骤**
- 宿主半：一个 cordis 插件，注册 `/boot-auth/*` 路由
- PIN / 备用码：`crypto.scryptSync` + 随机盐
- TOTP：HMAC-SHA1，与 RFC 6238 官方向量对齐（仓库内 `tools/test_totp.mjs` 可复跑）
- 邮件救援：调用 Windows 自带 `curl.exe` 走 SMTPS，不引任何依赖
- 测试：`tools/test_boot_auth.mjs`（宿主 10 项）、`tools/test_totp.mjs`（24 项）、`tools/test_recovery.mjs`（14 项）

## 已知限制

- 应用内指纹依赖本机 Windows Hello 驱动；部分老驱动只能在锁屏用，应用内验证窗会拿不到采样。
- 启动画面从点击到出现仍受 Electron 本体启动时间影响，插件只负责"出现之后"的那段。
- 「直接进入（跳过验证）」是双入口模式的临时按钮，稳定几版后会移除。

## 参考动画与致谢

本项目的**视觉语言与分幕节奏**参考了下面这条视频，并沿着它的出处一路往上追到了三位更早的作者。
**我们只做形式参考与工程重写，没有搬用任何原作者的素材或代码。**

- 《deepseek 那些豪气冲天的启动动画》— @熟橘枯摘 · [BV1T7nM6xEqo](https://www.bilibili.com/video/BV1T7nM6xEqo)

它自己标注的三条源头：

| 灵感来源 | 作者 | 原仓库 |
|---|---|---|
| 最早的启动动画（按空格/回车推进的第一幕） | 沈宏宏 | [6shenhonghong9/dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen) |
| 龙娘启动动画（线描手法） | @mytjxs | [mytjxs/codex-startup-animation](https://github.com/mytjxs/codex-startup-animation) |
| 550C 启动动画 | @yannicksong0106 | [yannicksong0106/dsh-550c-boot](https://github.com/yannicksong0106/dsh-550c-boot) |

如果这几样对你有用，请去原仓库点个 star——功劳是他们的。

## License

MIT
