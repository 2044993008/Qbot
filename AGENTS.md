# 仿 QQ 网页端应用

一个完整的即时通讯网页应用，模拟 QQ 的核心功能，包括聊天、好友管理、群聊、空间动态和 AI 助手。

## 技术栈

- **前端框架**: Next.js 16 (App Router)
- **UI 组件**: React 19 + shadcn/ui
- **样式**: Tailwind CSS 4
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL (Supabase)
- **认证**: JWT Token (Cookie 存储)

## 项目结构

```
├── src/
│   ├── app/                      # Next.js App Router 页面
│   │   ├── api/                  # API 路由
│   │   │   ├── auth/             # 认证相关 API
│   │   │   ├── bot/              # QQ 管家 AI 助手 API
│   │   │   ├── conversations/    # 会话 API
│   │   │   ├── friends/          # 好友 API
│   │   │   ├── groups/           # 群组 API
│   │   │   ├── moments/           # 空间动态 API
│   │   │   ├── messages/          # 消息 API
│   │   │   ├── seed/              # 数据预置 API
│   │   │   ├── settings/          # 用户设置 API
│   │   │   ├── upload/            # 文件上传 API
│   │   │   └── user/              # 用户信息 API
│   │   ├── app/                   # 主应用页面
│   │   │   ├── chat/[id]/         # 聊天页面
│   │   │   ├── friends/           # 好友列表页面
│   │   │   ├── moments/           # 空间动态页面
│   │   │   └── profile/           # 个人资料页面
│   │   ├── login/                 # 登录注册页面
│   │   └── layout.tsx             # 根布局
│   ├── components/               # React 组件
│   │   ├── avatar.tsx            # 头像组件
│   │   ├── chat-list.tsx         # 聊天列表组件
│   │   ├── chat-window.tsx       # 聊天窗口组件
│   │   └── sidebar.tsx           # 侧边栏组件
│   ├── lib/                       # 工具库
│   │   ├── api.ts                # API 请求封装
│   │   ├── auth-context.tsx      # 认证上下文
│   │   ├── hooks.ts              # 自定义 Hooks
│   │   ├── types.ts              # TypeScript 类型定义
│   │   └── utils.ts              # 通用工具函数
│   └── storage/                   # 数据库相关
│       ├── database/
│       │   ├── shared/
│       │   │   └── schema.ts     # 数据库 Schema 定义
│       │   └── supabase-client.ts # Supabase 客户端
│       └── .env.local            # 环境变量
├── public/                       # 静态资源
├── package.json
└── tsconfig.json
```

## 主要功能

### 1. 用户认证
- 登录/注册页面
- JWT Token 认证
- 登录态持久化（Cookie）
- 刷新页面自动验证

### 2. 会话与聊天
- 会话列表（私聊/群聊）
- 实时消息发送
- 历史消息加载
- 图片和文件支持
- @ 提及功能（群聊）

### 3. 好友管理
- 好友列表（按状态分组）
- 好友搜索
- 个人资料卡片
- 好友备注

### 4. 群聊功能
- 群成员列表
- 角色标签（班长、学习委员等）
- 角色图谱识别

### 5. QQ 空间
- 动态信息流
- 发布动态（文字+图片）
- 点赞和评论
- 个人历史动态

### 6. QQ 管家 AI 助手
- 智能搜索历史消息
- 内容润色
- 代发消息
- 表情包匹配
- 发空间动态辅助
- 自定义命名

## 数据库表

| 表名 | 说明 |
|------|------|
| users | 用户信息 |
| friends | 好友关系 |
| groups | 群组信息 |
| group_members | 群成员关系 |
| conversations | 会话列表 |
| messages | 消息记录 |
| moments | 空间动态 |
| moment_comments | 动态评论 |
| moment_likes | 动态点赞 |
| user_settings | 用户设置 |
| group_role_mappings | 群角色映射 |

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `POST /api/auth/logout` - 登出
- `GET /api/auth/login` - 验证登录态

### 用户
- `GET /api/user` - 获取用户信息
- `PUT /api/user` - 更新用户信息

### 好友
- `GET /api/friends` - 获取好友列表
- `GET /api/friends/[id]` - 获取好友详情
- `PUT /api/friends/[id]` - 更新好友备注

### 会话
- `GET /api/conversations` - 获取会话列表
- `POST /api/conversations` - 创建会话

### 消息
- `GET /api/messages` - 获取消息列表
- `POST /api/messages` - 发送消息

### 群组
- `GET /api/groups` - 获取群列表
- `GET /api/groups/members` - 获取群成员

### 空间
- `GET /api/moments` - 获取动态列表
- `POST /api/moments` - 发布动态
- `POST /api/moments/like` - 点赞/取消点赞
- `POST /api/moments/comment` - 评论

### 管家
- `POST /api/bot` - 发送管家消息
- `GET /api/bot` - 获取管家配置

## 测试账号

| QQ号 | 密码 | 昵称 |
|------|------|------|
| 10001 | 123456 | DemoUser |
| 10002 | 123456 | 张小明 |
| 10003 | 123456 | 李华 |

## 运行命令

```bash
# 开发环境
pnpm dev

# 构建
pnpm build

# 生产环境
pnpm start
```

## 环境变量

需要配置 Supabase 连接信息：
- `COZE_SUPABASE_URL` - Supabase 项目 URL
- `COZE_SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `COZE_SUPABASE_SERVICE_ROLE_KEY` - Supabase 服务密钥

## 注意事项

1. 所有 API 请求都需要登录态（除登录/注册外）
2. 消息记录由后端持久化存储
3. 图片上传使用 Supabase Storage
4. AI 管家支持自然语言理解和命令执行
