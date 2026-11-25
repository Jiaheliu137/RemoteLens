# RemoteLens

[English](README.md) | **中文**

一个 [Eagle](https://eagle.cool) 插件：用手机远程浏览 Eagle 里当前打开的素材库。只读，随处可用，不需要把素材库拷到手机上。

Eagle 没有手机端。RemoteLens 在 Eagle 内部运行一个小型网页服务，提供一个手机网页：扫一下二维码，就能翻看你的素材库。

## 功能

- **只暴露当前打开的素材库。** 不扫描、也访问不到电脑上的其他内容。在 Eagle 里切换素材库，手机端自动跟随。
- **只读。** 服务不接受任何写入请求，也不会改动素材库文件夹。
- **你打开才生效。** 插件窗口里一个开关。关闭时不开放任何端口。
- **沿用 Eagle 的组织方式。** 文件夹树、标签与标签分组、未分类 / 未标签、按名称、标签、备注、链接搜索、排序、类型筛选。
- **手机上流畅。** 网格使用虚拟滚动，直接用 Eagle 已有的缩略图；全屏看图支持左右滑动、双指缩放、双击放大；视频可拖动进度播放。
- **省流量的预览图。** 大图按需缩小并缓存在素材库之外，手机用流量时不必拉取几 MB 的原图。HEIC 和 RAW 在系统能解码时会自动转换。
- **尊重你的隐藏设置。** 回收站里的内容、带密码的文件夹里的内容一律不提供。

## 访问方式与隐私

RemoteLens 按经由 [Tailscale](https://tailscale.com) 使用来设计。Tailscale 是只连接你自己设备的私有网络：

| 方式 | 谁能连接 | 说明 |
|---|---|---|
| Tailscale 加密地址（可用时默认） | 登录了你 Tailscale 网络的设备 | 通过 `tailscale serve` 发布，服务本身只监听 `127.0.0.1` |
| Tailscale 直连地址 | 登录了你 Tailscale 网络的设备 | Tailscale 网络没开 HTTPS 证书时使用 |
| 局域网（需手动开启） | 同一 Wi-Fi 下的设备 | 默认关闭。公共 Wi-Fi 下不要打开 |

在网络限制之外，每台设备还需要**访问口令**（二维码里已带上）。来自公网地址的请求在校验口令之前就会被拒绝。重置口令会让所有设备退出登录。

没有云服务，也没有账号：图片从你的电脑直接传到你的手机，由 Tailscale 加密。

## 安装

1. 下载或克隆本仓库。
2. 在 Eagle 中：**插件 → 开发者选项 → 导入本地项目**，选择里层的 `RemoteLens` 文件夹（包含 `manifest.json` 的那个）。
3. 打开插件，打开**远程访问**开关，用手机扫描二维码。

要在家庭网络之外访问，需要在电脑和手机上都安装 Tailscale 并登录同一个账号。要使用加密地址，需要在 Tailscale 管理后台开启 HTTPS 证书（DNS → HTTPS Certificates）。

环境要求：Eagle 4.x，Windows 或 macOS。

## 使用须知

- 电脑要开着，Eagle 要在运行。插件是后台服务：关掉它的窗口不会停止服务，关开关才会。
- 速度上限取决于电脑所在网络的上行带宽。在同一 Wi-Fi 下，Tailscale 会让两台设备直连。
- 端口：服务使用窗口里显示的端口（默认 `41800`），Tailscale 加密地址使用它的下一个端口（`41801`）。
- 设置和缓存保存在 `~/.remotelens/`，不会往素材库里写任何东西。
- 不包含：编辑、智能文件夹、颜色搜索 / 以图找图 / 语义搜索。

## 开发

服务端核心是不带依赖的纯 Node 代码，可以脱离 Eagle 运行：

```bash
node tools/dev-server.js "/path/to/My.library" 41800   # 打印登录地址，只监听 127.0.0.1
npm test                                                # node:test，无需安装依赖
```

```
RemoteLens/            插件本体（导入 Eagle 时选这个文件夹）
  manifest.json
  index.html, styles.css, js/   插件窗口：开关、二维码、设置
  server/                       HTTP 服务、素材库索引、口令校验、Tailscale 对接
  web/                          手机网页端（无构建步骤）
tests/                 node:test 测试，使用生成的示例素材库
tools/dev-server.js    脱离 Eagle 单独运行服务
```

## 致谢

二维码由 Kazuhiko Arase 的 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT）生成。

RemoteLens 是独立项目，与 Eagle 官方无关。

## 许可证

[MIT](LICENSE)
