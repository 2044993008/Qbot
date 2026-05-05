# QQ 网页端

一个完整的即时通讯网页应用，模拟 QQ 的核心功能。

## 技术栈

- **前端框架**: Next.js 16 (App Router)
- **UI 组件**: React 19 + shadcn/ui
- **样式**: Tailwind CSS 4
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL (Supabase)
- **认证**: JWT Token (Cookie 存储)

## 主要功能

- **用户认证**: 登录/注册、JWT 认证、登录态持久化
- **会话与聊天**: 私聊/群聊、历史消息加载、图片和文件支持、@ 提及
- **好友管理**: 好友列表、搜索、个人资料卡片、备注
- **群聊功能**: 群成员列表、角色标签
- **QQ 空间**: 动态信息流、发布动态、点赞和评论
- **AI 助手**: 智能搜索、内容润色、代发消息、表情包匹配、AI 画画、定时任务

## 运行

```bash
pnpm install
pnpm dev
```

## 环境变量

需要配置 Supabase 连接信息：
- `COZE_SUPABASE_URL`
- `COZE_SUPABASE_ANON_KEY`
- `COZE_SUPABASE_SERVICE_ROLE_KEY`

## 测试账号

| QQ号 | 密码 | 昵称 |
|------|------|------|
| 10001 | 123456 | DemoUser |
| 10002 | 123456 | 张小明 |
| 10003 | 123456 | 李华 |

## 项目结构

```
src/
├── app/              # Next.js 页面与 API
├── components/       # React 组件
├── lib/              # 工具库、类型定义
└── storage/          # 数据库相关
```

详见 `AGENTS.md`。
