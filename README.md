# 同频 Together · Android / iOS App

为情侣与好友制作的原生共享相册。使用 React Native + Expo，同一份 TypeScript 客户端构建 Android 和 iOS；界面为原生组件，没有 WebView。网页版仅提供视觉和业务参考。

## 功能

- QQ 邮箱注册、验证、登录、重发验证邮件、忘记密码和邮件重置。
- 原生安全存储会话；注销及重置密码撤销服务端会话。
- 相册分类、搜索、创建和修改；手机相册多选、压缩、上传、私有图片查看、照片描述编辑和收藏。
- QQ 邮箱邀请、复制链接、系统分享、接受邀请；owner / editor / viewer 权限、移除成员和撤销邀请。
- 纪念日列表、倒计时、创建及删除；尚未接入操作系统通知。
- 冲突提示、错误重试、上传进度、防重复提交、前台定期与手动刷新。

## 架构与目录

```text
mobile/       Expo 原生客户端、SecureStore、系统选图与分享
backend/      独立 Fastify API、认证、邮件、数据库和权限
backend/test/  SQLite / PostgreSQL 行为与权限测试
mobile/test/   API 会话和链接测试
netlify.toml  可选的 API 函数部署（不托管原生 App）
Dockerfile    可选的独立 Node.js API 容器
agent.md      开发约定
AGENTS.md     约定入口
```

客户端只通过 HTTP API 通信，不包含数据库密码或 SMTP 授权码。本地使用 SQLite，云端支持 Supabase 私有 PostgreSQL schema。照片保存在私有数据库，由 API 鉴权读取；这是小规模好友试用方案，当前配额见 [部署说明](docs/DEPLOYMENT.md)。

## 本地启动

需要 Node.js 22.13+、npm，以及手机上的兼容 Expo Go 或开发构建。首次安装：

```powershell
npm ci
npm run install:all
Copy-Item backend/.env.example backend/.env
Copy-Item mobile/.env.example mobile/.env
```

修改 `mobile/.env`，将 `YOUR_COMPUTER_LAN_IP` 替换为电脑局域网 IPv4 地址，例如 `http://192.168.1.20:8080/api/v1`。手机与电脑在同一网络；手机的 localhost 指手机自身。仅在可信本地网络调试 HTTP，正式包必须使用 HTTPS。

分别开两个终端：

```powershell
npm run dev:api
npm run dev:app
```

Expo 开发服务器默认使用 development build；若使用 Expo Go，可在 `mobile` 运行 `npx expo start --go`。Expo Go 版本必须兼容 SDK 58；自定义 `together://` 链接需要安装开发/正式构建，Expo Go 测试时使用粘贴邮件链接。

开发默认 `MAIL_TRANSPORT=file`，邮件写入 `backend/.data/mail`。注册后执行 `npm --prefix backend run mail` 查看验证链接，在 App「打开邀请 / 验证链接」中粘贴。这里的文件模式不会向真实邮箱发信。

需要真实 QQ 邮件时，按 [部署说明](docs/DEPLOYMENT.md) 配置 SMTP，再运行 `npm --prefix backend run mail:check`。使用本站自设密码注册，不是 QQ 登录密码或 SMTP 授权码。

## 验证和构建

```powershell
npm run verify
$env:TEST_DATABASE='postgres'
npm --prefix backend test
Remove-Item Env:TEST_DATABASE
npm run export:app
```

`export:app` 导出 Android/iOS Hermes JS 资源和辅助 Web 预览，**不是 APK/IPA**。原生开发工程由 Expo prebuild 生成，不手工维护；原生模块配置放在 `mobile/app.json`。

构建可安装包：参见 [Android / iOS 构建与部署](docs/DEPLOYMENT.md)。Android 本地编译需要 JDK/Android SDK，iOS 本地编译需要 macOS/Xcode；EAS 云构建需要自己的 Expo 项目与适当签名凭据。

## 当前交付边界

这是完整客户端与独立后端源码仓库，不是已经上架的商店应用。尚未将新 API 部署到生产，也未迁移或改动原网站账号、相册和数据库。原网站旧 API 没有原生 Bearer 登录响应，不能只填原网址就认为已接通；应先部署本仓库后端，再配置 App 的 API 地址。

原生工程生成和 JS 打包不等于真机验收。签名 APK/IPA、两台真机协作、真实 QQ SMTP 收信和后台/弱网测试仍是发布前检查项。Expo 工具链的已知上游安全公告详见 [验收记录](docs/VERIFICATION.md)。

- [实施计划](docs/PLAN.md)
- [架构与权限](docs/ARCHITECTURE.md)
- [模块开发 SOP](docs/SOP.md)
- [构建与部署](docs/DEPLOYMENT.md)
- [测试证据与剩余事项](docs/VERIFICATION.md)
