# Local debug database

本地调试数据库使用 Docker 启动 PostgreSQL + PostgREST，应用继续通过 Supabase 兼容接口访问数据。

## 1. 启动本地数据库

```bash
pnpm db:up
```

默认端口：
- PostgreSQL: `54322`
- PostgREST: `54321`

## 2. 初始化表结构

```bash
pnpm db:init
```

## 2.1 执行补充 migration

如果你的本地库是在补齐唯一约束之前初始化的，执行下面的 migration 以清理历史重复数据并补上唯一索引：

```bash
pnpm db:migrate:20260428
```

这一步会：
- 清理 `moment_likes(moment_id, user_id)` 的重复数据
- 清理 `user_settings(user_id, key)` 的重复数据
- 为两张表创建数据库级唯一索引

## 3. 写入调试数据

```bash
pnpm db:seed
```

这会生成：
- DemoUser + 多个好友 + AI 管家
- 多个群聊
- 半年以上的私聊/群聊消息
- 空间动态、评论、点赞、用户设置

## 4. 配置本地环境变量

在项目根目录创建 `.env.local`：

```bash
COZE_SUPABASE_URL=http://127.0.0.1:54321
COZE_SUPABASE_ANON_KEY=<本地 PostgREST JWT>
COZE_SUPABASE_SERVICE_ROLE_KEY=<本地 PostgREST JWT>
LOCAL_SUPABASE_URL=http://127.0.0.1:54321
LOCAL_SUPABASE_ANON_KEY=<本地 PostgREST JWT>
LOCAL_SUPABASE_SERVICE_ROLE_KEY=<本地 PostgREST JWT>
LOCAL_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/app
```

当前 docker-compose 已内置 `PGRST_JWT_SECRET=local-dev-jwt-secret-with-at-least-32-chars`，对应 JWT 可按需生成，或直接复用本地示例配置。
## 5. 启动开发服务器

```bash
pnpm dev
```

## 5.1 回归验证

修复后的建议回归清单见：

- `docs/qa-regression-checklist.md`

## 6. 停止本地数据库

```bash
pnpm db:down
```
