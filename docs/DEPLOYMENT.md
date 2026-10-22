# 构建与部署

## 先部署 API，再生成原生安装包

原网站 API 尚未支持本仓库的原生登录响应。应创建隔离测试后端和数据库，验收后才考虑升级原网站 API；不要直接迁移生产数据或把数据库凭据填进 App。App 仅配置公开的 EXPO_PUBLIC_API_URL。

### 可选：Netlify API + Supabase 私有 PostgreSQL

1. 创建自己的 Supabase 项目，取得 PostgreSQL 事务池连接串，保存在本地 backend/.env 的 DATABASE_URL。连接必须启用严格 TLS；若需要 Supabase 根 CA，把官方项目提供的证书转成 Base64 配置 DATABASE_CA_CERT_BASE64。不关闭证书验证。
2. 对新建、空的测试项目执行下列 schema 初始化。脚本检测已应用迁移的校验和，拒绝静默覆盖；不要修改已应用迁移文件。

```powershell
cd backend
node --env-file=.env scripts/cloud-database.mjs --schema
```

3. 将此 GitHub 仓库导入新 Netlify 项目，使用根目录 netlify.toml。它构建 API Functions 及一个邮件链接跳转页，不是 App 的安装包。后端环境变量仅在 Functions 私密作用域保存：

```dotenv
NODE_ENV=production
WEB_ORIGIN=https://YOUR-API-SITE.netlify.app
DATABASE_URL=postgresql://USER:PASSWORD@POOLER_HOST:6543/postgres
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=YOUR_SENDER@qq.com
SMTP_PASSWORD=YOUR_QQ_SMTP_AUTHORIZATION_CODE
MAIL_FROM=Together <YOUR_SENDER@qq.com>
```

WEB_ORIGIN 不能带末尾斜杠，它决定邮件 HTTPS 链接来源，也限定 Web 预览的跨域来源。原生 App 使用 Bearer，不依赖浏览器 Cookie/CORS。SMTP_PASSWORD 是 QQ 邮箱设置中生成的 SMTP 授权码，不是 QQ 密码。用 `npm run mail:check` 检查连接，不打印授权码；只有实际验证/邀请/重置流程才会发送业务邮件。

4. 部署成功后访问 `/api/v1/workspace`，未登录应返回空工作区；错误配置时函数返回 503。在 mobile/.env 设置 `EXPO_PUBLIC_API_URL=https://YOUR-API-SITE.netlify.app/api/v1`，重新构建 App。环境变量会编译进客户端，只有公开 API URL 可使用 EXPO_PUBLIC_ 前缀。
5. 用两个真实测试账号完成注册、收信、验证、邀请、上传、共同编辑和重置。源码仓库不表示云端已部署；本次未更改用户现有线上项目。

私有 `together` schema 对 anon/authenticated 不开放，客户端不能直接访问表。后端持有数据库连接并做成员权限判断。照片存在私有 bytea 字段，当前每张最多 3 MiB、每相册 100 张、每个所有者合计 100 MiB，PostgreSQL 部署全站 200 MiB。原生上传每次选择最多 4 张，压缩至最长边 1600、JPEG 质量 0.78，逐张提交。超过小规模好友试用应设计对象存储迁移、缩略图与 CDN 签名 URL，不应直接放大数据库配额。

免费资源的额度、休眠与邮件限制取决于供应商当前规则，本仓库不保证永久免费或无冷启动。照片/账号备份由项目所有者负责。

### 可选：独立 Node.js / Docker

```powershell
docker build -t together-api .
docker run --env-file backend/.env -p 8080:8080 together-api
```

使用 PostgreSQL 时必须先初始化 schema。SQLite 仅适合单实例，部署时需把 `/app/.data` 挂载持久卷并做备份；不能把 SQLite 放在 Netlify 临时文件系统。API 需要可信 HTTPS 反向代理；开发 HTTP 仅限本地。

## Android / iOS 原生构建

在 mobile 目录：

```powershell
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

`eas init` 将应用绑定到你自己的 Expo 项目并更新 app.json；把实际 projectId 提交，切勿把登录令牌/签名密钥提交。配置 EAS 构建环境中的 EXPO_PUBLIC_API_URL 为 HTTPS API 地址，并核对 bundleIdentifier/package 是否使用你的命名空间。当前默认 com.kismetcccc.together。

- Android preview 输出可安装 APK；production 默认 AAB 用于商店。
- iOS 真实设备分发需要 Apple 签名及相应开发者资格、设备注册/分发渠道。Windows 不能本地生成 iOS 安装包；可以用 EAS 云构建或 macOS/Xcode。不能用 APK 安装到 iPhone。
- 本地 Android 构建：安装与 Expo SDK 58 兼容的 JDK/Android SDK 后执行 `npm run android`；iOS 在 Mac 上执行 `npm run ios`。prebuild 产生的 android/ios 被忽略，配置以 app.json 和插件为准。
- 自定义 scheme 为 together，邮件内含 together://invite/...、verify/...、reset/...；若邮件客户端不允许直接跳转，可打开 HTTPS 中转页或在 App 粘贴链接。尚未配置 Universal Links / App Links 域名关联。
- 尚未实现操作系统纪念日通知、账号自助删除和应用商店隐私政策发布；公开商店发布前需补齐适用的产品及审核要求。

## 数据保留与迁移

本次未复制实际账号和相册，也未执行生产迁移。若将来复用现有网站数据库，应先备份、验证 schema 校验和与兼容性，在测试环境演练后再配置兼容的后端；不要重跑空库 import 覆盖已有内容。已有 SQLite 导入脚本仅接受空目标且不迁移会话/邮件令牌。重置密码只替换密码哈希并撤销会话，不删除账号、相册或照片。
