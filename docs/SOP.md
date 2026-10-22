# 开发与验收 SOP

## 每次开始

1. 阅读 agent.md、ARCHITECTURE.md、PLAN.md，确认要改的模块和验收条件。
2. 检查 Git 工作区；不覆盖未提交工作。不读取/复制生产 .env 或用户数据库到仓库。
3. 本地使用测试数据库、file mailer 和虚构账号。生产连接、真实邮件发送、数据迁移分别记录环境和结果。

## 模块地图

| 模块         | 客户端                                  | 服务端                                  | 验收重点                                             |
| ------------ | --------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| 注册登录验证 | components/AuthScreen.tsx、lib/api.ts   | routes/auth.ts、context.ts、security.ts | QQ 格式、密码哈希、验证门槛、令牌只存哈希、安全存储  |
| 忘记密码     | App.tsx reset/forgot 表单、lib/links.ts | routes/password-reset.ts                | 通用响应、令牌过期/单次使用、旧会话撤销              |
| 相册照片     | App.tsx、components/PrivateImage.tsx    | routes/albums.ts                        | 成员隔离、私有读取、图片格式大小、配额、版本冲突     |
| 邀请成员     | App.tsx members/link 表单               | routes/invitations.ts                   | 收件人匹配、过期、重复接受、editor/viewer、撤销/移除 |
| 纪念日       | App.tsx dates                           | routes/albums.ts                        | 真实日期、个人数据隔离、倒计时；不宣称系统提醒       |
| 网络会话     | lib/api.ts、lib/client.ts               | context.ts、app.ts                      | 401 清理、403 保留会话、45 秒超时、写操作不自动重试  |
| 数据持久化   | 无数据库访问                            | database.ts、postgres.ts、迁移目录      | 参数化 SQL、事务、私有 schema、TLS                   |

## 修改流程

1. 明确用户操作、输入输出、失败与权限规则；优先保持 API 协议向后兼容。
2. 服务端先实现鉴权与事务，再连接客户端；不能仅靠隐藏按钮实现权限。
3. 每个写操作都有处理中、成功、失败状态；错误保留表单。涉及同一记录的编辑携带 version，冲突时提示刷新，不静默覆盖。
4. 原生功能使用 Expo 模块；权限仅在用户主动选图时请求。深链接只解析为待确认操作，绝不打开即自动修改数据。
5. 为新增权限/认证行为补测试；调用 npm run verify。涉及 SQL 再以 TEST_DATABASE=postgres 运行服务端测试（PGlite PostgreSQL 引擎，不是云端实测）。
6. 涉及原生模块时执行 expo install --check、prebuild、双平台 export，并在 Android 与 iOS 上分别做真机测试。
7. 更新 PLAN/VERIFICATION，说明结果、命令、限制、未执行项目。提交前检查 git diff --cached、敏感文件与构建产物。

## 双账号发布验收

1. A/B 用不同 QQ 邮箱注册并验证，拒绝错误/过期验证链接；退出重启后会话恢复。
2. A 创建相册，从系统相册选取 JPEG/PNG；检查拒绝权限、取消选择、大图压缩、失败重试和缩略图。
3. A 邀请 B 为 editor；B 从邮件打开/粘贴链接后确认，能上传并修改说明；A 刷新后可见。
4. viewer 能看但不能写；非成员拿到图片 URL 仍不能查看；错收件人不能接受邀请。
5. 两设备编辑同一版本触发冲突；撤销邀请/移除成员后访问被拒绝。
6. 忘记密码邮件设置新密码后，旧密码和旧会话失效；相册数据保留。
7. 测试 Android 返回键、iOS 键盘、安全区域、后台恢复、断网、真实手机分享面板、邮件应用跳转。
8. 记录设备型号、OS、应用版本、后端环境与失败证据。全部通过后再发布商店包。

## 运维

数据库变更先备份、在隔离环境验证，新增迁移而非修改已应用迁移；SQLite import 仅允许空目标且不迁移会话/重置令牌。日志不得输出 Authorization、密码或邮件令牌。事故先撤销相关会话与邮件令牌，再修复和回归。SMTP 凭据只配置在后端托管密钥设置，移动端 EXPO_PUBLIC_* 是公开信息。
