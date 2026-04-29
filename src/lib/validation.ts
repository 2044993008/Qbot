import { z } from 'zod';

// ============================================
// 通用验证规则
// ============================================

export const qqNumberSchema = z.string()
  .min(5, 'QQ号长度必须在5-12位之间')
  .max(12, 'QQ号长度必须在5-12位之间')
  .regex(/^\d+$/, 'QQ号只能包含数字');

export const passwordSchema = z.string()
  .min(6, '密码长度至少6位')
  .max(128, '密码长度不能超过128位');

export const nicknameSchema = z.string()
  .min(1, '昵称不能为空')
  .max(50, '昵称长度不能超过50位');

export const contentSchema = z.string()
  .min(1, '内容不能为空')
  .max(5000, '内容长度不能超过5000字');

export const idSchema = z.number().int().positive('ID必须为正整数');

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================
// Auth 验证
// ============================================

export const loginSchema = z.object({
  qq_number: qqNumberSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  qq_number: qqNumberSchema,
  nickname: nicknameSchema,
  password: passwordSchema,
});

// ============================================
// Messages 验证
// ============================================

export const sendMessageSchema = z.object({
  conversation_id: idSchema,
  type: z.union([z.literal('text'), z.literal('image'), z.literal('file')]).default('text'),
  content: contentSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const getMessagesSchema = z.object({
  conversation_id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  before: z.coerce.number().int().positive().optional(),
});

// ============================================
// Moments 验证
// ============================================

export const publishMomentSchema = z.object({
  content: contentSchema,
  images: z.array(z.string().url()).max(9, '最多上传9张图片').optional(),
});

export const momentCommentSchema = z.object({
  moment_id: idSchema,
  content: z.string().min(1).max(500),
});

export const momentLikeSchema = z.object({
  moment_id: idSchema,
});

// ============================================
// Bot 验证
// ============================================

export const botMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.number().int().positive().optional(),
});

export const botToolExecuteSchema = z.object({
  execute_tool: z.literal(true),
  tool: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Tasks 验证
// ============================================

export const createTaskSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cron_expression: z.string().min(1),
  task_type: z.union([z.literal('reminder'), z.literal('send_message'), z.literal('post_moment')]),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

// ============================================
// Friends 验证
// ============================================

export const updateFriendRemarkSchema = z.object({
  remark: z.string().max(50).optional(),
});

// ============================================
// Conversations 验证
// ============================================

export const createConversationSchema = z.object({
  type: z.enum(['private', 'group']),
  target_id: idSchema,
});

// ============================================
// User 验证
// ============================================

export const updateUserSchema = z.object({
  nickname: nicknameSchema.optional(),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  signature: z.string().max(200).optional(),
  status: z.union([z.literal('online'), z.literal('offline'), z.literal('busy')]).optional(),
});

// ============================================
// Settings 验证
// ============================================

export const updateSettingsSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

// ============================================
// 辅助函数：解析并验证请求 body
// ============================================

export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.parse(body);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `输入验证失败: ${messages}` };
    }
    return { success: false, error: '无效的请求格式' };
  }
}

// ============================================
// 辅助函数：解析并验证 query params
// ============================================

export function validateQuery<T>(
  url: string,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const { searchParams } = new URL(url);
    const obj: Record<string, unknown> = {};
    searchParams.forEach((value, key) => {
      // 尝试数字转换
      const num = Number(value);
      obj[key] = !isNaN(num) && value !== '' ? num : value;
    });
    const result = schema.parse(obj);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `参数验证失败: ${messages}` };
    }
    return { success: false, error: '无效的查询参数' };
  }
}
