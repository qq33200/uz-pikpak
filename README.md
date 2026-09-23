# uz-pikpak

给 **uz影视** 的「TG搜 / TG搜²」扩展补上 **PikPak** 识别 —— 让 TG 频道里的 PikPak 网盘资源能正常搜出来。

> 第三方修改版，非官方。上游：`YYDS678/uzVideo-extensions`。

---

## 问题

上游 `vod/js/Pan_tgs.js` 和 `vod/js/Pan_tgs_api.js` 的网盘白名单是这样写的：

```js
pikpak: { name: 'PikPak', domains: ['pikpak.me'] }
```

判定逻辑是**裸字符串包含**：

```js
for (const domain of panUrlsExt) if (url.includes(domain)) return true
```

而 PikPak 官方分享链接的格式是 `https://mypikpak.com/s/XXXXXXXX`
（见 PikPak 帮助中心《如何设置分享链接的默认展示方式》）。

```
"https://mypikpak.com/s/VOIQ0QFrIMiPE8EFPZYJKKxpo1".includes("pikpak.me")  // → false
```

于是所有 PikPak 帖子被判为「没有网盘链接」，在 `if (ids && ids.length > 0) videoList.push(video)`
这一步被静默丢弃 —— 这就是「TG搜 里搜不到 PikPak」的原因。

## 改动

只动三处，约 15 行，不碰解析、翻页、去重、并发搜索等逻辑。

**1）补上真实域名**

```diff
 pikpak: {
     name: 'PikPak',
-    domains: ['pikpak.me']
+    domains: ['pikpak.me', 'mypikpak.com', 'mypikpak.net']
 }
```

**2）判定从「裸包含」改为「带域名边界」**

直接加 `mypikpak.com` 会引入新误判：`includes()` 会把 `mypikpak.com.cn`、`xxmypikpak.com`
这类不相干的域名也认成 PikPak。所以同时换成带边界的正则：

```js
function domainHitSource(domain) {
    // 左：不能紧邻 字母/数字/横线（必须放行 . 和 /，否则子域名 cloud.189.cn、www.123pan.com 会失效）
    // 右：不能紧邻 字母/数字/点/横线（挡住 mypikpak.com.cn）
    return '(?:^|[^\\w-])' + domain.replace(/\./g, '\\.') + '(?![\\w.-])';
}
const panUrlHitRegexList = panUrlsExt.map(d => new RegExp(domainHitSource(d), 'i'));
```

**3）`providerRegexMap`（决定备注里显示「夸克 / PikPak / …」）用同一套边界规则**

## 回归验证

拿三个真实公开频道页面（236 条 href）做对照：

| 检查项 | 结果 |
|---|---|
| 夸克 / UC / 百度 / 天翼 / 123 / 115 / 移动 | 原版与补丁版标签一致，无退化 |
| `mypikpak.com/s/xxx`（含 `?act=play`、`?view=flow&order=…`） | 原版「无」→ 补丁版「PikPak」 |
| `mypikpak.net/s/xxx` | 原版「无」→ 补丁版「PikPak」 |
| `mypikpak.com.cn` / `notmypikpak.com` | 补丁版正确拒绝，不误判 |
| 真实频道页命中数 | 原版 73 → 补丁版 73，双向差集为空（无退化） |

## 安装

### 第 1 步：装补丁版视频源

```
uz影视 → 设置 → 数据管理 → 视频源 → 小齿轮 → 添加源列表 → 输入下面的链接 → 确定
```

```
https://cdn.jsdelivr.net/gh/qq33200/uz-pikpak@main/uz-vod-pikpak.json
```

添加后**记得勾选**条目，否则不会启用。建议把官方那个 `[盘] TG搜` / `[盘] TG搜²` 源禁用，避免重复。

### 第 2 步：装网盘工具扩展（否则搜到了也点不开）

```
uz影视 → 设置 → 数据管理 → 网盘工具扩展 → 小齿轮 → 添加 → 输入下面的链接 → 确定 → 启用
```

```
https://github.com/YYDS678/uzVideo-extensions/releases/download/uzVideo-Extensions-main/panTools.json
```

### 第 3 步：填 `PikPakToken`

```
uz影视 → 设置 → 数据管理 → 环境变量 → 添加
```

| 名称 | 值 |
|---|---|
| `PikPakToken` | `Bearer eyJ...`（**以 `Bearer ` 开头，注意有空格**） |

取法：浏览器登录 <https://mypikpak.com/drive> → F12 → Network → 任一 `api-drive.mypikpak.com`
请求 → 复制 `authorization` 整条值。

不填也能用「公共模式」，但走「转存后取原画直链」那条路需要它，大文件（>6GB）更稳。

### 怎么确认生效

搜索任意剧名，看结果**备注**是否出现 `PikPak|频道名` ——
这些条目在原版里是完全不显示的。

## 已知限制

1. **阿里云盘 / 迅雷 同样搜不到** —— 白名单里没有 `alipan.com` / `pan.xunlei.com`。要的话按同样方式加。
2. **`%2F` 编码过的链接抓不到** —— 带边界的正则不会命中；这类链接即使命中，网盘工具也解不了，按无效处理是合理的。
3. **API 版依赖第三方服务** `https://tgsou.252035.xyz`，它挂了就换抓取版。
4. `pikpak.me` 原样保留（实测该域名当前无响应），不删更安全。

## 文件

| 文件 | 说明 |
|---|---|
| `Pan_tgs_api_pikpak.js` | 补丁版 TG搜²（走 `TG搜API地址`） |
| `Pan_tgs_pikpak.js` | 补丁版 TG搜（直接抓 `t.me/s/`） |
| `uz-vod-pikpak.json` | 视频源列表订阅文件 |

## 声明

仅供个人学习与技术研究。上游扩展版权归原作者；本仓库只做域名白名单的修正，
建议同时向 `YYDS678/uzVideo-extensions` 反馈该问题，让上游一并修复。
