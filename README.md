# dsh-boot-handmade

给 DeepSeek Harness 的**冷启动动画 + 应用锁**。一个插件，两个能力：

- **六幕开机动画**：黑幕鲸鱼线描 → 过曝洗白 → 暖白「技术档案」底板 → 访问授权 → 核验 → 色散故障揭幕 → 进聊天。
- **真的应用锁**：验证环节不是演出，PIN 与 Windows Hello（指纹 / 人脸 / Hello PIN）由宿主进程校验，通过后发一枚 12 小时有效的会话 Cookie。

画面对应的是这条演示视频的视觉语言：<https://www.bilibili.com/video/BV1T7nM6xEqo>。
全部用 DOM + CSS + SVG 画出来，没有视频、没有位图、没有第三方素材，任意分辨率都清晰；音效是 WebAudio 现场合成的。

> **状态：v0.2.0，双入口模式。** 锁的 UI 旁边保留了一个「直接进入（跳过验证）」，等几个版本确认稳定后会移除。

## 安装

1. 完全退出 DeepSeek Harness（任务管理器里确认没有 `DeepSeek Harness` 进程）。
2. 双击 `安装.cmd`（它会先检查进程和 CLI 路径，再 `dsh plugin add link:<本目录>`）。
3. 重新打开客户端。

首次启动会要求**设置 4–8 位数字 PIN**；设好之后每次冷启动要过验证。

手动安装：

```powershell
& "D:\dsh\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "link:<本目录绝对路径>"
```

> 客户端运行中直接装会报 `EPERM ... package.json.lock` —— 那是 profile 的 `package.json` 被进程占着，退出客户端再装即可。

## 两种进不去时的逃生口

| 逃生口 | 怎么用 |
|---|---|
| **直接进入** | 验证界面上的文字按钮，点一下就跳过（双入口模式临时保留） |
| **急救绕过.cmd** | 创建 `%USERPROFILE%\.dsh\boot-auth-bypass`，宿主看到就直接放行；不需要界面 |

> 早期的第 3 个逃生口「无操作 45 秒后自动放行」**已移除**：它等于让「什么都不做」也成为一种进入方式，
> 和锁的本意冲突。现在停在门口不会自己开门，实在进不去用上面两条。

撤销：`恢复锁定.cmd` 删掉标记文件；想连 PIN 一起清掉，删 `%USERPROFILE%\.dsh\boot-auth.json`。

彻底卸载：双击 `卸载.cmd`。

## 安全边界（请先读这段）

- 这个锁保护的是**开机动画这一层**：没通过验证就不往下走。它**不是**对整个 Web 服务的门禁。
- 一个懂技术的人可以直接打开开发者工具把动画节点删掉，或者直接访问宿主的接口。真正的强制门禁必须做在应用外壳前面，那超出了 profile 插件的能触及的范围。
- PIN 用 scrypt（随机盐）存成哈希，落盘在 `~/.dsh/boot-auth.json`（`0600`）；会话令牌只在内存里，宿主重启即失效。
- 连续 5 次输错锁 30 秒。

换句话说：它是**仪式感 + 家用的门闩**，不是保险箱。别把唯一一份重要数据的访问权押在它身上。

## 微信 / QQ 登录

界面里留了位置，状态是「未配置」。要真接上，需要你在**腾讯开放平台**注册应用、拿到 AppID/AppSecret、配好回调域名——这一步只能账号主人自己做。接口 `/boot-auth/oauth` 已经占好位（现在返回 501 + 说明），接上 OAuth 后把回调写进这个 handler 即可。

## 目录

```
client.js          六幕动画 + 验证 UI（344 行起，无构建步骤）
lib/index.js       宿主半：/boot-auth/* 路由、PIN 校验、会话 Cookie、Hello 调用
hello.ps1          Windows Hello 的 UserConsentVerifier 封装（-CheckOnly 只探测可用性）
cordis.patch.yml   往 profile 插一行
package.json       dsh.bundle.patch + dsh.client{platform:web, immediately:true}
preview.html       浏览器直接打开就能看动画（宿主不在时会走「预览模式」）
安装.cmd / 卸载.cmd / 急救绕过.cmd / 恢复锁定.cmd
```

## 自测

```bash
node tools/test_boot_auth.mjs     # 10 项：注册/校验/锁定/绕过/哈希存储
powershell -File hello.ps1 -CheckOnly   # 只探测 Windows Hello 是否可用，不弹窗
```

## 致谢与素材来源

视觉语言参考的是以下公开作品与那条演示视频，**没有复用任何原作者的素材**，本项目所有图形都是自己画的：

| 参考 | 作者 |
|---|---|
| 最早的启动动画（按空格/回车推进的那支） | 沈宏宏 [@6shenhonghong9](https://github.com/6shenhonghong9/dsh-startup-screen) |
| 龙娘启动动画（线描研究） | [@mytjxs](https://github.com/mytjxs/codex-startup-animation) |
| 550C 启动动画（复刻学习对象） | [@yannicksong0106](https://github.com/yannicksong0106/dsh-550c-boot) |
| 演示视频 | [BV1T7nM6xEqo](https://www.bilibili.com/video/BV1T7nM6xEqo) |

喜欢这些动画的话，请去原作者的仓库点 star。

## 许可

MIT，只覆盖本项目的原创代码与文案。
