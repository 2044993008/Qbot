import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, serial, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 用户表
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey().notNull(),
    qq_number: varchar("qq_number", { length: 20 }).notNull().unique(),
    nickname: varchar("nickname", { length: 64 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    avatar_color: varchar("avatar_color", { length: 7 }).default("#3b82f6"),
    signature: varchar("signature", { length: 255 }).default("这个人很懒，什么都没写"),
    status: varchar("status", { length: 20 }).default("offline").notNull(), // online, offline, busy
    last_seen: timestamp("last_seen", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("users_qq_number_idx").on(table.qq_number),
    index("users_status_idx").on(table.status),
  ]
);

// 好友关系表
export const friends = pgTable(
  "friends",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    friend_id: integer("friend_id").notNull().references(() => users.id),
    remark: varchar("remark", { length: 64 }).default(""),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("friends_user_id_idx").on(table.user_id),
    index("friends_friend_id_idx").on(table.friend_id),
  ]
);

// 群组表
export const groups = pgTable(
  "groups",
  {
    id: serial("id").primaryKey().notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    avatar_color: varchar("avatar_color", { length: 7 }).default("#10b981"),
    description: varchar("description", { length: 255 }).default(""),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("groups_name_idx").on(table.name),
  ]
);

// 群成员表
export const group_members = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey().notNull(),
    group_id: integer("group_id").notNull().references(() => groups.id),
    user_id: integer("user_id").notNull().references(() => users.id),
    role: varchar("role", { length: 32 }).default("普通成员"), // 班长、学习委员、老师、活跃等
    joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("group_members_group_id_idx").on(table.group_id),
    index("group_members_user_id_idx").on(table.user_id),
    index("group_members_group_user_idx").on(table.group_id, table.user_id),
  ]
);

// 会话表
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey().notNull(),
    type: varchar("type", { length: 20 }).notNull(), // private, group
    user_id: integer("user_id").notNull().references(() => users.id),
    target_id: integer("target_id").notNull(), // friend_id or group_id
    last_message: text("last_message").default(""),
    last_message_time: timestamp("last_message_time", { withTimezone: true }),
    unread_count: integer("unread_count").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_user_id_idx").on(table.user_id),
    index("conversations_user_target_idx").on(table.user_id, table.target_id),
    index("conversations_last_message_time_idx").on(table.last_message_time),
  ]
);

// 消息表
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey().notNull(),
    conversation_id: integer("conversation_id").notNull().references(() => conversations.id),
    sender_id: integer("sender_id").notNull().references(() => users.id),
    type: varchar("type", { length: 20 }).notNull(), // text, image, file, system
    content: text("content").notNull(),
    metadata: jsonb("metadata").default({}), // 存储文件URL、文件名等
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversation_id),
    index("messages_sender_id_idx").on(table.sender_id),
    index("messages_created_at_idx").on(table.created_at),
  ]
);

// 空间动态表
export const moments = pgTable(
  "moments",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    images: jsonb("images").default([]), // 图片URL数组
    like_count: integer("like_count").default(0),
    comment_count: integer("comment_count").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("moments_user_id_idx").on(table.user_id),
    index("moments_created_at_idx").on(table.created_at),
  ]
);

// 动态评论表
export const moment_comments = pgTable(
  "moment_comments",
  {
    id: serial("id").primaryKey().notNull(),
    moment_id: integer("moment_id").notNull().references(() => moments.id),
    user_id: integer("user_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("moment_comments_moment_id_idx").on(table.moment_id),
    index("moment_comments_user_id_idx").on(table.user_id),
  ]
);

// 动态点赞表
export const moment_likes = pgTable(
  "moment_likes",
  {
    id: serial("id").primaryKey().notNull(),
    moment_id: integer("moment_id").notNull().references(() => moments.id),
    user_id: integer("user_id").notNull().references(() => users.id),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("moment_likes_moment_id_idx").on(table.moment_id),
    index("moment_likes_user_id_idx").on(table.user_id),
    index("moment_likes_moment_user_idx").on(table.moment_id, table.user_id),
    uniqueIndex("moment_likes_moment_user_unique_idx").on(table.moment_id, table.user_id),
  ]
);

// 用户设置表
export const user_settings = pgTable(
  "user_settings",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    key: varchar("key", { length: 64 }).notNull(),
    value: text("value").default(""),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_settings_user_id_idx").on(table.user_id),
    index("user_settings_user_key_idx").on(table.user_id, table.key),
    uniqueIndex("user_settings_user_key_unique_idx").on(table.user_id, table.key),
  ]
);

// 管家角色映射表（存储群的特殊角色）
export const group_role_mappings = pgTable(
  "group_role_mappings",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    group_id: integer("group_id").notNull().references(() => groups.id),
    role_type: varchar("role_type", { length: 32 }).notNull(), // class_monitor, study_leader, teacher, active
    role_name: varchar("role_name", { length: 32 }).notNull(), // 班长、学习委员、老师、活跃
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("group_role_mappings_user_idx").on(table.user_id),
    index("group_role_mappings_group_idx").on(table.group_id),
  ]
);

// 定时任务表
export const scheduled_tasks = pgTable(
  "scheduled_tasks",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description").default(""),
    cron_expression: varchar("cron_expression", { length: 64 }).notNull(),
    task_type: varchar("task_type", { length: 64 }).notNull(), // 'reminder', 'send_message', 'post_moment'
    config: jsonb("config").default({}),
    enabled: boolean("enabled").default(true),
    last_run_at: timestamp("last_run_at", { withTimezone: true }),
    next_run_at: timestamp("next_run_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scheduled_tasks_user_id_idx").on(table.user_id),
    index("scheduled_tasks_enabled_idx").on(table.enabled),
    index("scheduled_tasks_next_run_at_idx").on(table.next_run_at),
  ]
);

// 任务执行日志表
export const task_execution_logs = pgTable(
  "task_execution_logs",
  {
    id: serial("id").primaryKey().notNull(),
    task_id: integer("task_id").notNull().references(() => scheduled_tasks.id),
    status: varchar("status", { length: 20 }).notNull(), // 'running', 'success', 'failed'
    output: text("output").default(""),
    error_message: text("error_message").default(""),
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("task_execution_logs_task_id_idx").on(table.task_id),
    index("task_execution_logs_status_idx").on(table.status),
    index("task_execution_logs_started_at_idx").on(table.started_at),
  ]
);

// Bot 审计日志表
export const bot_audit_logs = pgTable(
  "bot_audit_logs",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    session_id: varchar("session_id", { length: 64 }).default(""),
    request: text("request").notNull(),
    plan: jsonb("plan").default({}),
    tool_calls: jsonb("tool_calls").default([]),
    response: text("response").default(""),
    latency_ms: integer("latency_ms").default(0),
    tokens_used: integer("tokens_used").default(0),
    model: varchar("model", { length: 64 }).default(""),
    status: varchar("status", { length: 20 }).notNull().default("success"), // success, failed, rejected
    error: text("error").default(""),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bot_audit_logs_user_id_idx").on(table.user_id),
    index("bot_audit_logs_status_idx").on(table.status),
    index("bot_audit_logs_created_at_idx").on(table.created_at),
  ]
);

// 类型导出
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof group_members.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Moment = typeof moments.$inferSelect;
export type MomentComment = typeof moment_comments.$inferSelect;
export type MomentLike = typeof moment_likes.$inferSelect;
export type UserSetting = typeof user_settings.$inferSelect;
export type GroupRoleMapping = typeof group_role_mappings.$inferSelect;
export type ScheduledTask = typeof scheduled_tasks.$inferSelect;
export type TaskExecutionLog = typeof task_execution_logs.$inferSelect;
export type BotAuditLog = typeof bot_audit_logs.$inferSelect;

// 向量记忆表（需要 pgvector 扩展）
export const memory_embeddings = pgTable(
  "memory_embeddings",
  {
    id: serial("id").primaryKey().notNull(),
    user_id: integer("user_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    embedding: text("embedding").notNull(), // 存储为 JSON 数组字符串，或使用 pgvector 的 vector 类型
    category: varchar("category", { length: 50 }).default("fact"), // preference, fact, event, relationship, goal
    confidence: integer("confidence").default(80), // 0-100
    source: text("source").default(""), // 记忆来源（如用户对话、系统提取）
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memory_embeddings_user_id_idx").on(table.user_id),
    index("memory_embeddings_category_idx").on(table.category),
    index("memory_embeddings_created_at_idx").on(table.created_at),
  ]
);

export type MemoryEmbedding = typeof memory_embeddings.$inferSelect;
