# Together App 实施约定

目标：Android / iOS 共用 React Native + Expo 客户端，独立 Fastify API，QQ 邮箱注册、验证、登录、找回密码及共享相册。

1. 先读 docs/PLAN.md、docs/ARCHITECTURE.md，按顺序执行；完成项必须附验证证据，阻塞项必须说明。
2. TypeScript strict；移动端只调用 API，不直连数据库。原生会话用 SecureStore，服务端只保存令牌哈希。
3. 不提交 .env、SMTP 授权码、数据库连接串、用户数据、会话、签名文件、node_modules 或构建目录。
4. 权限由服务端判断：owner 管理邀请，editor 编辑上传，viewer 只读；过期/撤销令牌和版本冲突必须测试。
5. 保持现有网站兼容；本仓库复制的是源码，不修改或迁移线上数据。上线 API、EAS 云构建和应用商店发布单独记录，不能把源码导出称为真机验收。
6. 修改后运行 npm run verify；新功能增加行为测试。不可通过跳过测试或削弱权限来完成计划。
7. Git 提交前检查暂存文件和敏感信息；不强推、不覆盖远端已有工作。
