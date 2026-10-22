# 原生 App 架构

mobile 是 Expo + React Native 原生组件项目，无 WebView。Android/iOS 共享 TypeScript，系统相册用 ImagePicker，压缩用 ImageManipulator，分享用 React Native Share，私密令牌用 SecureStore。网页导出仅用于开发烟雾测试，不能代替原生构建。

backend 是独立 Fastify API，复用同频业务，开发 SQLite，部署可使用私有 PostgreSQL schema。客户端只有 API 地址，数据库/SMTP 凭据仅在服务端。原生使用不透明 Bearer 令牌，服务端只存 SHA-256 哈希，7 天有效；注销、重置和过期均由服务端撤销。网站 Cookie 协议仍兼容。

邮件包含 HTTPS 链接和 together:// 深链。App 可以接收深链，也能粘贴邮件完整链接；用户确认后才验证邮箱/接受邀请/重置密码。邀请绑定收件邮箱和角色，不能通过改客户端绕过权限。

本仓库不会自动更改原网站生产环境。App 必须连接本仓库后端的部署（原网站旧版本没有原生令牌返回协议）。可由管理员把本仓库后端按部署文档部署到与网站兼容的 API，再共用同一个数据库；不要让 App 直接连接数据库。
