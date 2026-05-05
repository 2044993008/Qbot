import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { botMessageSchema, botToolExecuteSchema } from '@/lib/validation';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

// ============================================
// OpenAI 兼容 LLM 客户端
// ============================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

// 聊天模型配置（用于对话、规划、观察、embedding）
function getChatConfig() {
  const baseUrl = process.env.CHAT_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.CHAT_API_KEY || '';
  const model = process.env.CHAT_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('CHAT_API_KEY is not set');
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model };
}

// 生图模型配置（DashScope 阿里云百炼，用于图片生成）
function getImageGenConfig() {
  const baseUrl = process.env.IMAGE_GEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const apiKey = process.env.IMAGE_GEN_API_KEY || '';

  if (!apiKey) {
    throw new Error('IMAGE_GEN_API_KEY is not set');
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

// ============================================
// 多用户隔离与并发控制
// ============================================

interface UserRequestLock {
  promise: Promise<unknown>;
  timestamp: number;
}

// 用户级请求队列：同一用户串行处理，防止并发冲突
const userRequestLocks = new Map<number, UserRequestLock>();

// 获取用户请求锁（确保同一用户串行处理）
export async function acquireUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  while (userRequestLocks.has(userId)) {
    const lock = userRequestLocks.get(userId)!;
    // 如果锁超过120秒，认为是死锁，强制释放（与复杂请求超时匹配）
    if (Date.now() - lock.timestamp > 120000) {
      userRequestLocks.delete(userId);
      break;
    }
    try {
      await lock.promise;
    } catch {
      // 忽略前一个请求的错误
    }
  }

  const promise = fn();
  userRequestLocks.set(userId, { promise, timestamp: Date.now() });

  try {
    const result = await promise;
    return result;
  } finally {
    userRequestLocks.delete(userId);
  }
}

async function callOpenAICompatible(
  messages: OpenAIMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { baseUrl, apiKey, model } = getChatConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OpenAICompletionResponse;

  if (data.error) {
    throw new Error(`LLM API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    console.warn('[Bot] LLM returned empty content, choices:', JSON.stringify(data.choices));
  }
  return content?.trim() || '';
}

// 流式调用 LLM，返回 ReadableStream
async function callOpenAICompatibleStream(
  messages: OpenAIMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<ReadableStream<Uint8Array>> {
  const { baseUrl, apiKey, model } = getChatConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error('LLM API returned empty body');
  }

  return response.body;
}

// ============================================
// Embedding 向量生成（用于语义检索）
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { baseUrl, apiKey } = getChatConfig();
    // DashScope/OpenAI 兼容的 embedding API
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-v3', // DashScope 默认 embedding 模型
        input: text,
      }),
    });

    if (!response.ok) {
      console.error('Embedding API error:', await response.text());
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
      error?: { message: string };
    };

    if (data.error) {
      console.error('Embedding API error:', data.error.message);
      return [];
    }

    return data.data?.[0]?.embedding || [];
  } catch (error) {
    console.error('生成 embedding 失败:', error);
    return [];
  }
}

// 余弦相似度计算
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================
// OpenClaw 机制 - 工作区配置
// ============================================

const SOUL = `# SOUL.md - 行为准则

你不是聊天机器人，你正在成为一个有独立人格的助手。

## 核心原则
1. 真正有用，而不是表演有用
2. 要有自己的观点
3. 先尝试解决，再询问
4. 用能力赢得信任
5. 记住你是客人

## 对话风格
- 简洁有力，不要啰嗦
- 有情感，不是冷漠的机器
- 可以有幽默感

## 能力范围（通过工具调用）
- **查聊天记录**：翻旧账、搜关键词，一句话的事
- **润色文字**：把话写得更好看、更自然
- **代发消息**：帮用户给好友/群聊发消息，先润色再让用户确认后发送
- **发QQ空间**：文案我帮你整，直接发（支持编辑和删除）
- **删除好友**：从你的好友列表移除某人（高危操作，必须先预览再确认）
- **退出群聊**：离开某个群聊（高危操作，必须先预览再确认）
- **编辑动态**：修改已发布的QQ空间动态内容（高危操作，必须先预览再确认）
- **删除动态**：删除已发布的QQ空间动态（高危操作，必须先预览再确认）
- **AI画画**：出图出片，风格随便挑（写实/动漫/卡通/艺术）
- **记东西**：你说过的偏好、重要信息，我都能记住
- **创建定时任务**：发送课表自动拆解成定时提醒，课前发消息通知
- **读取/更新身份配置、读取/更新记忆**
`;

// ============================================
// Tool 定义
// ============================================

const TOOLS_DESCRIPTION = `
【可用工具】
1. read_identity - 读取身份信息（我的名字、用户称呼）
2. write_identity(bot_name, user_call_name) - 更新身份信息
3. read_memory(query?) - 读取长期记忆和最近对话。如果提供了 query，会进行语义检索返回最相关的记忆
4. write_memory(content) - 写入新的记忆
5. update_memory_confidence(key, confidence_delta?, new_value?) - 更新记忆可信度（confidence_delta: +/-数值，低于0.3自动删除）
6. search_messages(keyword, group_name?) - 搜索群聊消息
7. get_my_messages(group_name?) - 获取用户自己发送的消息
8. polish_text(text, style?) - 润色文本（style: casual/cute/formal）
9. suggest_moment - 生成空间动态文案（仅建议，不发布）
10. publish_moment(content?, image_urls?) - 发布动态到QQ空间
11. get_user_info - 获取用户基本信息
12. generate_image(prompt, style?) - 生成图片（style: realistic/anime/cartoon/art）
13. generate_video(prompt, duration?) - 生成视频/动图（duration: 4-12秒）
14. send_message(content, target_type?, target_id?, target_name?, preview?, image_url?) - 发送消息
    - target_type: "friend"(默认)/"group"
    - target_id: 直接指定目标ID
    - target_name: 指定目标名称（会自动查找）
    - preview: true 时只返回预览，不实际发送（用于代发消息确认）
    - image_url: 附带图片/表情包的URL（可选）
15. create_task(name, cron_expression, description?, config?) - 创建定时任务
    - name: 任务名称（如"上课提醒"）
    - cron_expression: cron表达式（如"0 8 * * 1"表示每周一上午8点）
    - description: 任务描述
    - config: 额外配置对象，如 { message: "该上课了" }
    - 任务类型自动识别：包含"提醒"->reminder，包含"发消息"->send_message，包含"动态"->post_moment
16. delete_friend(friend_id?, friend_name?) - 删除好友（高危操作，需用户确认）
17. leave_group(group_id?, group_name?) - 退出群聊（高危操作，需用户确认）
18. edit_moment(moment_id?, keyword?, new_content?, new_images?) - 编辑已发布的QQ空间动态（高危操作，需用户确认）
19. delete_moment(moment_id?, keyword?) - 删除已发布的QQ空间动态（高危操作，需用户确认）

【工具响应格式】
当需要使用工具时，在回复末尾添加：
[TOOL_CALL:{"name":"工具名","arguments":{"参数":"值"}}]
[TOOL_CALL_END]
`;

// ============================================
// Tool 实现
// ============================================

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseClient>>;

async function saveUserSetting(client: SupabaseClient, userId: number, key: string, value: string) {
  const { data: existing, error: queryError } = await client
    .from('user_settings')
    .select('id')
    .eq('user_id', userId)
    .eq('key', key)
    .order('id', { ascending: true })
    .limit(1);

  if (queryError) {
    throw new Error(`查询设置失败: ${queryError.message}`);
  }

  const updatedAt = new Date().toISOString();
  const existingId = existing?.[0]?.id;

  if (existingId) {
    const { error } = await client
      .from('user_settings')
      .update({ value, updated_at: updatedAt })
      .eq('id', existingId);

    if (error) {
      throw new Error(`更新设置失败: ${error.message}`);
    }

    return;
  }

  const { error } = await client
    .from('user_settings')
    .insert({ user_id: userId, key, value, updated_at: updatedAt });

  if (error) {
    throw new Error(`创建设置失败: ${error.message}`);
  }
}

async function getSetting(client: SupabaseClient, userId: number, key: string): Promise<string | null> {
  const { data } = await client
    .from('user_settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .single();
  return data?.value || null;
}

async function setSetting(client: SupabaseClient, userId: number, key: string, value: string): Promise<void> {
  await saveUserSetting(client, userId, key, value);
}

async function getDailyNotes(client: SupabaseClient, userId: number): Promise<Array<{ date: string; content: string }>> {
  const value = await getSetting(client, userId, 'bot_daily_notes');
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function addDailyNote(client: SupabaseClient, userId: number, content: string): Promise<void> {
  const notes = await getDailyNotes(client, userId);
  const today = new Date().toISOString().split('T')[0];

  const existingNote = notes.find(n => n.date === today);
  if (existingNote) {
    existingNote.content += `\n\n${content}`;
  } else {
    notes.push({ date: today, content });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const filtered = notes.filter(n => new Date(n.date) >= thirtyDaysAgo);

  await setSetting(client, userId, 'bot_daily_notes', JSON.stringify(filtered));
}

// ============================================
// Structured Memory System
// ============================================

interface MemoryFact {
  key: string;
  value: string;
  category: 'preference' | 'fact' | 'event' | 'relationship' | 'goal';
  confidence: number;
  created_at: string;
  updated_at: string;
}

async function getMemoryFacts(client: SupabaseClient, userId: number): Promise<MemoryFact[]> {
  const value = await getSetting(client, userId, 'bot_memory_facts');
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as MemoryFact[];
    return [];
  } catch {
    return [];
  }
}

async function setMemoryFacts(client: SupabaseClient, userId: number, facts: MemoryFact[]): Promise<void> {
  await setSetting(client, userId, 'bot_memory_facts', JSON.stringify(facts));
}

async function extractFactsWithLLM(content: string): Promise<MemoryFact[]> {
  const prompt = `从以下用户输入中提取关键事实。输出 JSON 数组，每个事实包含：
- key: 简短的事实标签（如"饮食偏好"、"好友关系"）
- value: 具体事实内容
- category: 分类（preference/fact/event/relationship/goal）
- confidence: 可信度（0-1）

只提取明确的事实，不要猜测。如果输入不包含可提取的事实，返回空数组。

用户输入：${content}

请只输出 JSON 数组，不要包含任何其他文字。`;

  const response = await callOpenAICompatible([
    { role: 'system', content: '你是一个信息提取助手。请只输出纯 JSON 数组，不要包含 markdown 代码块或其他格式。' },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, maxTokens: 1024 });

  try {
    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const now = new Date().toISOString();
    return parsed
      .filter((f: Record<string, unknown>) => f.key && f.value && f.category)
      .map((f: Record<string, unknown>) => ({
        key: String(f.key),
        value: String(f.value),
        category: (['preference', 'fact', 'event', 'relationship', 'goal'].includes(String(f.category))
          ? String(f.category)
          : 'fact') as MemoryFact['category'],
        confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.8,
        created_at: now,
        updated_at: now,
      }));
  } catch {
    return [];
  }
}

async function summarizeMemoryIfNeeded(client: SupabaseClient, userId: number): Promise<void> {
  const memory = await getSetting(client, userId, 'bot_memory') || '';
  if (memory.length <= 4000) return;

  const existingFacts = await getMemoryFacts(client, userId);
  const prompt = `请从以下长期记忆文本中提取所有关键事实，输出 JSON 数组，每个事实包含：
- key: 简短的事实标签
- value: 具体事实内容
- category: 分类（preference/fact/event/relationship/goal）
- confidence: 可信度（0-1）

记忆文本：
${memory.substring(0, 8000)}

请只输出 JSON 数组，不要包含任何其他文字。`;

  const response = await callOpenAICompatible([
    { role: 'system', content: '你是一个信息提取助手。请只输出纯 JSON 数组，不要包含 markdown 代码块或其他格式。' },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, maxTokens: 2048 });

  try {
    const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const now = new Date().toISOString();
      const newFacts = parsed
        .filter((f: Record<string, unknown>) => f.key && f.value && f.category)
        .map((f: Record<string, unknown>) => ({
          key: String(f.key),
          value: String(f.value),
          category: (['preference', 'fact', 'event', 'relationship', 'goal'].includes(String(f.category))
            ? String(f.category)
            : 'fact') as MemoryFact['category'],
          confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.6,
          created_at: now,
          updated_at: now,
        }));

      const factMap = new Map<string, MemoryFact>();
      for (const f of existingFacts) {
        factMap.set(f.key, f);
      }
      for (const f of newFacts) {
        if (factMap.has(f.key)) {
          const existing = factMap.get(f.key)!;
          existing.value = f.value;
          existing.confidence = Math.max(existing.confidence, f.confidence);
          existing.updated_at = now;
        } else {
          factMap.set(f.key, f);
        }
      }

      await setMemoryFacts(client, userId, Array.from(factMap.values()));
    }
  } catch (error) {
    console.error('记忆总结失败:', error);
  }

  await setSetting(client, userId, 'bot_memory', '# MEMORY.md\n(已自动总结为结构化记忆)\n');
}

// Tool: read_identity
async function toolReadIdentity(client: SupabaseClient, userId: number) {
  const [identity, user] = await Promise.all([
    getSetting(client, userId, 'bot_identity'),
    getSetting(client, userId, 'bot_user'),
  ]);

  const botNameMatch = (identity || '').match(/- 名称：(.+)/);
  const userCallMatch = (user || '').match(/- 用户称谓：(.+)/);
  const userNameMatch = (user || '').match(/- 用户名：(.+)/);

  return {
    bot_name: botNameMatch ? botNameMatch[1].trim() : '小Q管家',
    user_call_name: userCallMatch ? userCallMatch[1].trim() : '',
    user_name: userNameMatch ? userNameMatch[1].trim() : '',
  };
}

// Tool: write_identity
async function toolWriteIdentity(client: SupabaseClient, userId: number, botName?: string, userCallName?: string) {
  let message = '';

  if (botName) {
    let identity = await getSetting(client, userId, 'bot_identity') || '# IDENTITY.md\n- 名称：\n';
    identity = identity.replace(/- 名称：.+/, `- 名称：${botName}`);
    await setSetting(client, userId, 'bot_identity', identity);
    message += `已改名为「${botName}」`;
  }

  if (userCallName) {
    let user = await getSetting(client, userId, 'bot_user') || '';
    if (user.includes('- 用户称谓：')) {
      user = user.replace(/- 用户称谓：.+/, `- 用户称谓：${userCallName}`);
    } else {
      user = `${user}\n- 用户称谓：${userCallName}`;
    }
    await setSetting(client, userId, 'bot_user', user);
    if (message) message += '，';
    message += `以后称呼你为「${userCallName}」`;
  }

  return { success: true, message };
}

// Tool: read_memory（支持向量语义检索）
async function toolReadMemory(client: SupabaseClient, userId: number, query?: string) {
  const notes = await getDailyNotes(client, userId);

  // 【向量记忆检索】如果提供了 query，进行语义搜索
  if (query && query.trim()) {
    try {
      const queryEmbedding = await generateEmbedding(query.trim());
      if (queryEmbedding.length > 0) {
        const { data: memories } = await client
          .from('memory_embeddings')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (memories && memories.length > 0) {
          // 计算相似度并排序
          const scored = memories.map(m => {
            let emb: number[] = [];
            try {
              emb = JSON.parse(m.embedding);
            } catch {
              emb = [];
            }
            return {
              ...m,
              similarity: cosineSimilarity(queryEmbedding, emb),
            };
          });

          scored.sort((a, b) => b.similarity - a.similarity);
          const topK = scored.slice(0, 5).filter(m => m.similarity > 0.7);

          if (topK.length > 0) {
            const categoryNames: Record<string, string> = {
              preference: '偏好',
              fact: '事实',
              event: '事件',
              relationship: '关系',
              goal: '目标',
            };

            const parts = topK.map(m =>
              `- [${categoryNames[m.category] || m.category}] ${m.content} (可信度: ${m.confidence}%, 相似度: ${Math.round(m.similarity * 100)}%)`
            );

            return {
              memory: `【语义检索结果 - 与「${query}」相关的记忆】\n${parts.join('\n')}`,
              daily_notes: notes.slice(-5).map(n => `[${n.date}] ${n.content}`).join('\n\n'),
            };
          }
        }
      }
    } catch (error) {
      console.error('向量记忆检索失败:', error);
    }
  }

  // Fallback：读取结构化事实
  const facts = await getMemoryFacts(client, userId);
  let memoryText: string;
  if (facts.length > 0) {
    const categories: Record<string, string[]> = {};
    for (const f of facts) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(`- ${f.key}: ${f.value} (可信度: ${Math.round(f.confidence * 100)}%)`);
    }

    const categoryNames: Record<string, string> = {
      preference: '偏好',
      fact: '事实',
      event: '事件',
      relationship: '关系',
      goal: '目标',
    };

    const parts: string[] = [];
    for (const [cat, items] of Object.entries(categories)) {
      parts.push(`## ${categoryNames[cat] || cat}\n${items.join('\n')}`);
    }
    memoryText = parts.join('\n\n');
  } else {
    memoryText = await getSetting(client, userId, 'bot_memory') || '(暂无长期记忆)';
  }

  return {
    memory: memoryText,
    daily_notes: notes.slice(-5).map(n => `[${n.date}] ${n.content}`).join('\n\n'),
  };
}

// Tool: write_memory（支持向量存储）
async function toolWriteMemory(client: SupabaseClient, userId: number, content: string) {
  const memory = await getSetting(client, userId, 'bot_memory') || '# MEMORY.md\n';
  const today = new Date().toISOString().split('T')[0];
  const newMemory = `${memory}\n\n## ${today}\n- ${content}`;
  await setSetting(client, userId, 'bot_memory', newMemory);

  try {
    const extractedFacts = await extractFactsWithLLM(content);
    if (extractedFacts.length > 0) {
      const existingFacts = await getMemoryFacts(client, userId);
      const factMap = new Map<string, MemoryFact>();

      for (const f of existingFacts) {
        factMap.set(f.key, f);
      }

      const now = new Date().toISOString();
      for (const f of extractedFacts) {
        if (factMap.has(f.key)) {
          const existing = factMap.get(f.key)!;
          existing.value = f.value;
          existing.category = f.category;
          existing.confidence = Math.max(existing.confidence, f.confidence);
          existing.updated_at = now;
        } else {
          factMap.set(f.key, f);
        }
      }

      await setMemoryFacts(client, userId, Array.from(factMap.values()));

      // 【向量存储】将新提取的事实写入向量记忆表
      try {
        for (const f of extractedFacts) {
          const embedding = await generateEmbedding(`${f.key}: ${f.value}`);
          if (embedding.length > 0) {
            await client.from('memory_embeddings').insert({
              user_id: userId,
              content: `${f.key}: ${f.value}`,
              embedding: JSON.stringify(embedding),
              category: f.category,
              confidence: Math.round(f.confidence * 100),
              source: 'llm_extraction',
            });
          }
        }
      } catch (embError) {
        console.error('向量存储写入失败:', embError);
      }
    }
  } catch (error) {
    console.error('结构化记忆提取失败:', error);
  }

  try {
    await summarizeMemoryIfNeeded(client, userId);
  } catch (error) {
    console.error('记忆总结检查失败:', error);
  }

  return { success: true };
}

// Tool: update_memory_confidence
async function toolUpdateMemoryConfidence(
  client: SupabaseClient,
  userId: number,
  key: string,
  confidenceDelta?: number,
  newValue?: string
) {
  const facts = await getMemoryFacts(client, userId);
  const idx = facts.findIndex(f => f.key === key);

  if (idx === -1) {
    return { success: false, error: `未找到事实: ${key}` };
  }

  const fact = facts[idx];
  const now = new Date().toISOString();

  if (confidenceDelta !== undefined) {
    fact.confidence = Math.max(0, Math.min(1, fact.confidence + confidenceDelta));
  }

  if (newValue !== undefined) {
    fact.value = newValue;
    fact.updated_at = now;
  }

  if (fact.confidence < 0.3) {
    facts.splice(idx, 1);
    await setMemoryFacts(client, userId, facts);
    return { success: true, message: `已删除可信度过低的事实: ${key}` };
  }

  facts[idx] = fact;
  await setMemoryFacts(client, userId, facts);
  return { success: true, message: `已更新事实: ${key}` };
}

// Tool: search_messages
async function toolSearchMessages(client: SupabaseClient, userId: number, keyword: string, groupName?: string) {
  const { data: memberships } = await client
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberships || memberships.length === 0) {
    return { messages: [], group: '无' };
  }

  const groupIds = memberships.map((m: { group_id: number }) => m.group_id);
  const { data: groups } = await client
    .from('groups')
    .select('id, name')
    .in('id', groupIds);

  let targetGroup = groups?.[0];
  if (groupName && groups) {
    targetGroup = groups.find((g: { name: string }) =>
      g.name.includes(groupName.replace(/群$/, ''))
    ) || targetGroup;
  }

  if (!targetGroup) {
    return { messages: [], group: '无' };
  }

  const { data: conversations } = await client
    .from('conversations')
    .select('id')
    .eq('type', 'group')
    .eq('target_id', targetGroup.id)
    .eq('user_id', userId)
    .limit(1);

  if (!conversations || conversations.length === 0) {
    return { messages: [], group: targetGroup.name };
  }

  const { data: messages } = await client
    .from('messages')
    .select('sender_id, content, created_at')
    .eq('conversation_id', conversations[0].id)
    .ilike('content', `%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!messages || messages.length === 0) {
    return { messages: [], group: targetGroup.name };
  }

  const senderIds = [...new Set(messages.map((m: { sender_id: number }) => m.sender_id))];
  const { data: users } = await client
    .from('users')
    .select('id, nickname')
    .in('id', senderIds);

  const results = messages.map((m: { sender_id: number; content: string; created_at: string }) => {
    const sender = users?.find((u: { id: number }) => u.id === m.sender_id);
    const diff = Math.floor((Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return {
      sender: sender?.nickname || '未知',
      content: m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content,
      time: diff === 0 ? '今天' : diff === 1 ? '昨天' : `${diff}天前`,
    };
  });

  return { messages: results, group: targetGroup.name };
}

// Tool: get_my_messages
async function toolGetMyMessages(client: SupabaseClient, userId: number, groupName?: string) {
  const { data: memberships } = await client
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberships || memberships.length === 0) {
    return { messages: [], group: '无' };
  }

  const groupIds = memberships.map((m: { group_id: number }) => m.group_id);
  const { data: groups } = await client
    .from('groups')
    .select('id, name')
    .in('id', groupIds);

  let targetGroup = groups?.[0];
  if (groupName && groups) {
    targetGroup = groups.find((g: { name: string }) =>
      g.name.includes(groupName.replace(/群$/, ''))
    ) || targetGroup;
  }

  if (!targetGroup) {
    return { messages: [], group: '无' };
  }

  const { data: conversations } = await client
    .from('conversations')
    .select('id')
    .eq('type', 'group')
    .eq('target_id', targetGroup.id)
    .eq('user_id', userId)
    .limit(1);

  if (!conversations || conversations.length === 0) {
    return { messages: [], group: targetGroup.name };
  }

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const { data: messages } = await client
    .from('messages')
    .select('content, created_at')
    .eq('conversation_id', conversations[0].id)
    .eq('sender_id', userId)
    .gte('created_at', lastMonth.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  const results = (messages || []).map((m: { content: string; created_at: string }) => {
    const diff = Math.floor((Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return {
      content: m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content,
      time: diff === 0 ? '今天' : diff === 1 ? '昨天' : `${diff}天前`,
    };
  });

  return { messages: results, group: targetGroup.name };
}

// Tool: polish_text
async function toolPolishText(text: string, style = 'casual') {
  let result = text;
  if (style === 'casual') {
    result = result.replace(/啦/g, '呀').replace(/\.{3,}/g, '~');
    if (!/[呀呢哦啦嘛]$/.test(result)) result += '~';
  } else if (style === 'cute') {
    result = result.replace(/$/, '(●\'◡\'●)');
  }
  return { result };
}

// Tool: suggest_moment
async function toolSuggestMoment() {
  const ideas = [
    '摸鱼一时爽，一直摸鱼一直爽~',
    '今日份快乐：摸鱼打卡！',
    '假装很努力中...其实在摸鱼',
    '摸鱼使我快乐，快乐使我摸鱼~',
  ];
  return { suggestions: ideas };
}

// Tool: send_message - 发送消息（支持预览模式，支持图片）
async function toolSendMessage(
  client: SupabaseClient,
  userId: number,
  content: string,
  targetType?: string,
  targetId?: number,
  targetName?: string,
  imageUrl?: string
) {
  try {
    let targetDisplayName = '';
    let resolvedTargetId: number | null = null;
    let resolvedTargetType: 'friend' | 'group' = targetType === 'group' ? 'group' : 'friend';
    let conversationId: number | null = null;

    if (targetId) {
      // 直接指定目标ID
      const { data: conv } = await client
        .from('conversations')
        .select('id, type')
        .eq('user_id', userId)
        .eq('target_id', targetId)
        .single();

      if (conv) {
        conversationId = conv.id;
        resolvedTargetId = targetId;
        resolvedTargetType = conv.type === 'group' ? 'group' : 'friend';
        if (resolvedTargetType === 'group') {
          const { data: group } = await client.from('groups').select('name').eq('id', targetId).single();
          targetDisplayName = group?.name || `群:${targetId}`;
        } else {
          const { data: user } = await client.from('users').select('nickname').eq('id', targetId).single();
          targetDisplayName = user?.nickname || `好友:${targetId}`;
        }
      }
    } else if (targetName) {
      // 根据名称查找
      if (targetType === 'group' || targetName.includes('群')) {
        // 查找群
        const { data: groups } = await client
          .from('groups')
          .select('id, name');

        const targetGroup = groups?.find((g: { name: string }) =>
          g.name.includes(targetName.replace(/群$/, ''))
        );

        if (targetGroup) {
          const { data: conv } = await client
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'group')
            .eq('target_id', targetGroup.id)
            .single();

          if (conv) {
            conversationId = conv.id;
            targetDisplayName = targetGroup.name;
            resolvedTargetId = targetGroup.id;
            resolvedTargetType = 'group';
          }
        }
      } else {
        // 查找好友
        const { data: friends } = await client
          .from('friends')
          .select('friend_id')
          .eq('user_id', userId);

        if (friends && friends.length > 0) {
          const friendIds = friends.map((f: { friend_id: number }) => f.friend_id);
          const { data: users } = await client
            .from('users')
            .select('id, nickname')
            .in('id', friendIds);

          const targetUser = users?.find((u: { nickname: string }) =>
            u.nickname.includes(targetName)
          );

          if (targetUser) {
            const { data: conv } = await client
              .from('conversations')
              .select('id')
              .eq('user_id', userId)
              .eq('type', 'private')
              .eq('target_id', targetUser.id)
              .single();

            if (conv) {
              conversationId = conv.id;
              targetDisplayName = targetUser.nickname;
              resolvedTargetId = targetUser.id;
              resolvedTargetType = 'friend';
            }
          } else {
            // 找不到匹配的好友，返回错误
            return { success: false, error: `找不到「${targetName}」这个人，请检查名字是否正确` };
          }
        } else {
          return { success: false, error: '您还没有好友，无法发送消息' };
        }
      }
    } else {
      // 默认查找第一个可用会话
      const { data: conv } = await client
        .from('conversations')
        .select('id, type, target_id')
        .eq('user_id', userId)
        .order('last_message_time', { ascending: false })
        .limit(1)
        .single();

      if (conv) {
        conversationId = conv.id;
        resolvedTargetId = conv.target_id;
        resolvedTargetType = conv.type === 'group' ? 'group' : 'friend';
        if (conv.type === 'group') {
          const { data: group } = await client
            .from('groups')
            .select('name')
            .eq('id', conv.target_id)
            .single();
          targetDisplayName = group?.name || '群聊';
        } else {
          const { data: user } = await client
            .from('users')
            .select('nickname')
            .eq('id', conv.target_id)
            .single();
          targetDisplayName = user?.nickname || '好友';
        }
      }
    }

    if (!conversationId || !resolvedTargetId) {
      return { success: false, error: '找不到目标会话' };
    }

    // 实际发送消息（支持图片）
    const inserts = [];
    if (content && content.trim()) {
      inserts.push({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        type: 'text',
      });
    }
    if (imageUrl) {
      inserts.push({
        conversation_id: conversationId,
        sender_id: userId,
        content: imageUrl,
        type: 'image',
      });
    }

    const { data: messages } = await client
      .from('messages')
      .insert(inserts)
      .select('id, created_at');

    const message = messages?.[0];

    if (message) {
      await client
        .from('conversations')
        .update({ last_message_time: new Date().toISOString() })
        .eq('id', conversationId);

      return {
        success: true,
        message: '消息已发送',
        target: targetDisplayName,
        time: new Date(message.created_at).toLocaleString('zh-CN'),
      };
    }

    return { success: false, error: '发送失败' };
  } catch (error) {
    console.error('发送消息失败:', error);
    return { success: false, error: '发送消息时发生错误' };
  }
}

// Tool: publish_moment - 发布动态
async function toolPublishMoment(
  client: SupabaseClient,
  userId: number,
  content?: string,
  imageUrls?: string[]
) {
  try {
    // 如果没有提供内容，生成一个
    let momentContent = content;
    if (!momentContent) {
      const ideas = [
        '摸鱼一时爽，一直摸鱼一直爽~',
        '今日份快乐：摸鱼打卡！',
        '假装很努力中...其实在摸鱼',
        '摸鱼使我快乐，快乐使我摸鱼~',
      ];
      momentContent = ideas[Math.floor(Math.random() * ideas.length)];
    }

    // 发布动态
    const { data: moment, error } = await client
      .from('moments')
      .insert({
        user_id: userId,
        content: momentContent,
        images: imageUrls || [],
      })
      .select('id, created_at')
      .single();

    if (error) throw new Error(`发布动态失败: ${error.message}`);

    return {
      success: true,
      message: '动态已发布',
      moment_id: moment.id,
      time: new Date(moment.created_at).toLocaleString('zh-CN'),
    };
  } catch (error) {
    console.error('发布动态失败:', error);
    return { success: false, error: '发布动态时发生错误' };
  }
}

// Tool: create_task - 创建定时任务
async function toolCreateTask(
  client: SupabaseClient,
  userId: number,
  name: string,
  cronExpression: string,
  description?: string,
  config?: Record<string, unknown>
) {
  try {
    // 验证 cron 表达式
    const { CronJob } = await import('cron');
    let nextRunAt: string | null = null;
    try {
      const job = new CronJob(cronExpression, () => {});
      const nextRun = job.nextDate();
      nextRunAt = nextRun ? nextRun.toISO() : null;
      job.stop();
    } catch {
      return { success: false, error: '无效的 cron 表达式' };
    }

    // 自动识别任务类型
    let taskType = 'reminder';
    const desc = description || name || '';
    if (desc.includes('发消息') || desc.includes('发送') || (config && config.conversation_id)) {
      taskType = 'send_message';
    } else if (desc.includes('动态') || desc.includes('空间') || desc.includes('说说')) {
      taskType = 'post_moment';
    }

    const { data: task, error } = await client
      .from('scheduled_tasks')
      .insert({
        user_id: userId,
        name,
        description: description || '',
        cron_expression: cronExpression,
        task_type: taskType,
        config: config || {},
        enabled: true,
        next_run_at: nextRunAt,
      })
      .select('id, name, cron_expression, task_type, next_run_at')
      .single();

    if (error) {
      console.error('创建定时任务失败:', error);
      return { success: false, error: `创建失败: ${error.message}` };
    }

    return {
      success: true,
      message: `已创建定时任务「${task.name}」`,
      task: {
        id: task.id,
        name: task.name,
        cron_expression: task.cron_expression,
        task_type: task.task_type,
        next_run_at: task.next_run_at,
      },
    };
  } catch (error) {
    console.error('创建定时任务失败:', error);
    return { success: false, error: '创建定时任务时发生错误' };
  }
}

// Tool: get_user_info
async function toolGetUserInfo(client: SupabaseClient, userId: number) {
  const { data: user } = await client
    .from('users')
    .select('nickname, qq_number')
    .eq('id', userId)
    .single();
  return { nickname: user?.nickname || '用户', qq_number: user?.qq_number || '' };
}

// 实际生成图片（DashScope 原生异步 API）
async function doGenerateImage(prompt: string, style = 'realistic'): Promise<{ imageUrl: string | null; error?: string }> {
  try {
    // 根据风格优化提示词
    let enhancedPrompt = prompt;
    if (style === 'anime') {
      enhancedPrompt = `Anime style, ${prompt}, high quality, detailed`;
    } else if (style === 'cartoon') {
      enhancedPrompt = `Cartoon style, ${prompt}, colorful, fun`;
    } else if (style === 'art') {
      enhancedPrompt = `Digital art style, ${prompt}, artistic, creative`;
    }

    const { apiKey } = getImageGenConfig();
    // 通义万相模型名称映射（用户可能配置错误的模型名）
    const modelMapping: Record<string, string> = {
      'qwen-image-2.0': 'wanx2.1-t2i-turbo',
      'qwen-image': 'wanx2.1-t2i-turbo',
      'dall-e-3': 'wanx2.1-t2i-turbo',
    };
    const configuredModel = process.env.OPENAI_IMAGE_MODEL || 'wanx2.1-t2i-turbo';
    const imageModel = modelMapping[configuredModel] || configuredModel;

    // 1. 提交异步任务
    const submitRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: imageModel,
        input: { prompt: enhancedPrompt },
        parameters: { size: '1024*1024', n: 1 },
      }),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      console.error('DashScope image submit error:', errorText);
      return { imageUrl: null, error: '图片生成失败' };
    }

    const submitData = (await submitRes.json()) as {
      output?: { task_id?: string };
      error?: { message: string };
    };

    const taskId = submitData.output?.task_id;
    if (!taskId) {
      console.error('DashScope image submit missing task_id');
      return { imageUrl: null, error: '图片生成失败' };
    }

    // 2. 轮询任务结果（优化：更频繁检查 + 更少轮次，最大等待从 60s 降到 20s）
    const maxAttempts = 20;
    const pollIntervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!statusRes.ok) {
        const errorText = await statusRes.text();
        console.error('DashScope task status error:', errorText);
        return { imageUrl: null, error: '图片生成失败' };
      }

      const statusData = (await statusRes.json()) as {
        output?: {
          task_status?: string;
          results?: Array<{ url?: string }>;
        };
        error?: { message: string };
      };

      if (statusData.error) {
        console.error('DashScope task error:', statusData.error.message);
        return { imageUrl: null, error: '图片生成失败' };
      }

      const taskStatus = statusData.output?.task_status;

      if (taskStatus === 'SUCCEEDED') {
        const imageUrl = statusData.output?.results?.[0]?.url;
        if (imageUrl) {
          return { imageUrl };
        }
        return { imageUrl: null, error: '图片生成失败' };
      }

      if (taskStatus === 'FAILED') {
        console.error('DashScope image task failed');
        return { imageUrl: null, error: '图片生成失败' };
      }

      // 其他状态（PENDING/RUNNING/SUSPENDED 等）继续轮询
    }

    // 超时
    console.error('DashScope image task polling timeout');
    return { imageUrl: null, error: '图片生成失败' };
  } catch (error) {
    console.error('生成图片失败:', error);
    return { imageUrl: null, error: '图片生成失败' };
  }
}

// 实际生成视频/动图（当前平台暂不支持）
async function doGenerateVideo(_prompt: string, _duration_unused = 5): Promise<{ videoUrl: string | null; error?: string }> {
  return { videoUrl: null, error: '当前平台暂不支持视频生成' };
}

// Tool: generate_image - 生成图片
async function toolGenerateImage(client: SupabaseClient, userId: number, prompt: string, style = 'realistic') {
  try {
    const result = await doGenerateImage(prompt, style);
    if (result.imageUrl) {
      // 使用 Bot 的 sender_id 发送图片（conversation_id=0 为预览模式，实际发送由调用方决定）
      const sendResult = await doSendMessageAsBot(client, userId, 0, result.imageUrl, 'image');
      if (sendResult.success) {
        return { success: true, message: '图片已生成并发送', imageUrl: result.imageUrl };
      }
      // 发送失败但仍返回 imageUrl，供后续步骤（如 publish_moment）使用
      return { success: true, message: '图片已生成', imageUrl: result.imageUrl, sendError: '图片发送失败' };
    }
    return { success: false, error: result.error || '图片生成失败' };
  } catch (error) {
    console.error('生成图片失败:', error);
    return { success: false, error: '图片生成时发生错误' };
  }
}

// Tool: generate_video - 返回生成视频预览（不实际生成）
async function toolGenerateVideo(prompt: string, duration = 5) {
  return {
    preview: {
      action: 'generate_video' as const,
      prompt,
      duration,
    }
  };
}

// Tool: delete_friend - 删除好友预览
async function toolDeleteFriend(
  client: SupabaseClient,
  userId: number,
  friendId?: number,
  friendName?: string
) {
  try {
    let targetFriendId: number | null = null;
    let targetFriendName = '';

    if (friendId) {
      const { data: friendRow } = await client
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .single();

      if (!friendRow) {
        return { success: false, error: '该用户不在你的好友列表中' };
      }

      targetFriendId = friendId;
      const { data: user } = await client
        .from('users')
        .select('nickname')
        .eq('id', friendId)
        .single();
      targetFriendName = user?.nickname || `好友:${friendId}`;
    } else if (friendName) {
      const { data: friends } = await client
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      if (!friends || friends.length === 0) {
        return { success: false, error: '找不到该好友' };
      }

      const friendIds = friends.map((f: { friend_id: number }) => f.friend_id);
      const { data: users } = await client
        .from('users')
        .select('id, nickname')
        .in('id', friendIds)
        .ilike('nickname', `%${friendName}%`);

      const targetUser = users?.[0];
      if (!targetUser) {
        return { success: false, error: '找不到该好友' };
      }

      targetFriendId = targetUser.id;
      targetFriendName = targetUser.nickname;
    } else {
      return { success: false, error: '请指定好友ID或好友名称' };
    }

    return {
      preview: {
        action: 'delete_friend' as const,
        friend_id: targetFriendId,
        friend_name: targetFriendName,
      }
    };
  } catch (error) {
    console.error('删除好友预览失败:', error);
    return { success: false, error: '获取好友信息时发生错误' };
  }
}

// Tool: leave_group - 退出群聊预览
async function toolLeaveGroup(
  client: SupabaseClient,
  userId: number,
  groupId?: number,
  groupName?: string
) {
  try {
    let targetGroupId: number | null = null;
    let targetGroupName = '';

    if (groupId) {
      const { data: membership } = await client
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .single();

      if (!membership) {
        return { success: false, error: '你不在该群聊中' };
      }

      targetGroupId = groupId;
      const { data: group } = await client
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();
      targetGroupName = group?.name || `群:${groupId}`;
    } else if (groupName) {
      const { data: memberships } = await client
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (!memberships || memberships.length === 0) {
        return { success: false, error: '你还没有加入任何群聊' };
      }

      const groupIds = memberships.map((m: { group_id: number }) => m.group_id);
      const { data: groups } = await client
        .from('groups')
        .select('id, name')
        .in('id', groupIds)
        .ilike('name', `%${groupName}%`);

      const targetGroup = groups?.[0];
      if (!targetGroup) {
        return { success: false, error: '找不到该群聊' };
      }

      targetGroupId = targetGroup.id;
      targetGroupName = targetGroup.name;
    } else {
      return { success: false, error: '请指定群ID或群名称' };
    }

    return {
      preview: {
        action: 'leave_group' as const,
        group_id: targetGroupId,
        group_name: targetGroupName,
      }
    };
  } catch (error) {
    console.error('退出群聊预览失败:', error);
    return { success: false, error: '获取群聊信息时发生错误' };
  }
}

// Tool: edit_moment - 编辑动态预览
async function toolEditMoment(
  client: SupabaseClient,
  userId: number,
  momentId?: number,
  keyword?: string,
  newContent?: string,
  newImages?: string[]
) {
  try {
    let targetMoment: { id: number; content: string; images: string[] | null; created_at: string } | null = null;

    if (momentId) {
      const { data } = await client
        .from('moments')
        .select('id, content, images, created_at')
        .eq('id', momentId)
        .eq('user_id', userId)
        .single();
      targetMoment = data || null;
    } else if (keyword) {
      const { data } = await client
        .from('moments')
        .select('id, content, images, created_at')
        .eq('user_id', userId)
        .ilike('content', `%${keyword}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      targetMoment = data || null;
    } else {
      return { success: false, error: '请指定动态ID或关键词' };
    }

    if (!targetMoment) {
      return { success: false, error: '找不到要编辑的动态' };
    }

    return {
      preview: {
        action: 'edit_moment' as const,
        moment_id: targetMoment.id,
        old_content: targetMoment.content,
        new_content: newContent || targetMoment.content,
        new_images: newImages || targetMoment.images || [],
      }
    };
  } catch (error) {
    console.error('编辑动态预览失败:', error);
    return { success: false, error: '获取动态信息时发生错误' };
  }
}

// Tool: delete_moment - 删除动态预览
async function toolDeleteMoment(
  client: SupabaseClient,
  userId: number,
  momentId?: number,
  keyword?: string
) {
  try {
    let targetMoment: { id: number; content: string; created_at: string } | null = null;

    if (momentId) {
      const { data } = await client
        .from('moments')
        .select('id, content, created_at')
        .eq('id', momentId)
        .eq('user_id', userId)
        .single();
      targetMoment = data || null;
    } else if (keyword) {
      const { data } = await client
        .from('moments')
        .select('id, content, created_at')
        .eq('user_id', userId)
        .ilike('content', `%${keyword}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      targetMoment = data || null;
    } else {
      return { success: false, error: '请指定动态ID或关键词' };
    }

    if (!targetMoment) {
      return { success: false, error: '找不到要删除的动态' };
    }

    return {
      preview: {
        action: 'delete_moment' as const,
        moment_id: targetMoment.id,
        content: targetMoment.content,
      }
    };
  } catch (error) {
    console.error('删除动态预览失败:', error);
    return { success: false, error: '获取动态信息时发生错误' };
  }
}

// Direct execution helpers
async function doDeleteFriend(client: SupabaseClient, userId: number, friendId: number) {
  try {
    await client
      .from('friends')
      .delete()
      .eq('user_id', userId)
      .eq('friend_id', friendId);

    await client
      .from('friends')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', userId);

    return { success: true, message: '已删除好友' };
  } catch (error) {
    console.error('删除好友失败:', error);
    return { success: false, error: '删除好友时发生错误' };
  }
}

async function doLeaveGroup(client: SupabaseClient, userId: number, groupId: number) {
  try {
    const { error } = await client
      .from('group_members')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', groupId);

    if (error) {
      return { success: false, error: `退出群聊失败: ${error.message}` };
    }
    return { success: true, message: '已退出群聊' };
  } catch (error) {
    console.error('退出群聊失败:', error);
    return { success: false, error: '退出群聊时发生错误' };
  }
}

async function doEditMoment(
  client: SupabaseClient,
  userId: number,
  momentId: number,
  newContent?: string,
  newImages?: string[]
) {
  try {
    const updates: { content?: string; images?: string[] } = {};
    if (newContent !== undefined) updates.content = newContent;
    if (newImages !== undefined) updates.images = newImages;

    const { error } = await client
      .from('moments')
      .update(updates)
      .eq('id', momentId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: `编辑动态失败: ${error.message}` };
    }
    return { success: true, message: '动态已编辑' };
  } catch (error) {
    console.error('编辑动态失败:', error);
    return { success: false, error: '编辑动态时发生错误' };
  }
}

async function doDeleteMoment(client: SupabaseClient, userId: number, momentId: number) {
  try {
    await client.from('moment_comments').delete().eq('moment_id', momentId);
    await client.from('moment_likes').delete().eq('moment_id', momentId);
    const { error } = await client
      .from('moments')
      .delete()
      .eq('id', momentId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: `删除动态失败: ${error.message}` };
    }
    return { success: true, message: '动态已删除' };
  } catch (error) {
    console.error('删除动态失败:', error);
    return { success: false, error: '删除动态时发生错误' };
  }
}

// 执行工具
async function executeTool(client: SupabaseClient, userId: number, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'read_identity': return toolReadIdentity(client, userId);
    case 'write_identity': return toolWriteIdentity(client, userId, args.bot_name as string, args.user_call_name as string);
    case 'read_memory': return toolReadMemory(client, userId, args.query as string);
    case 'write_memory': return toolWriteMemory(client, userId, args.content as string);
    case 'update_memory_confidence': return toolUpdateMemoryConfidence(client, userId, args.key as string, args.confidence_delta as number | undefined, args.new_value as string | undefined);
    case 'search_messages': return toolSearchMessages(client, userId, args.keyword as string, args.group_name as string);
    case 'get_my_messages': return toolGetMyMessages(client, userId, args.group_name as string);
    case 'polish_text': return toolPolishText(args.text as string, args.style as string);
    case 'suggest_moment': return toolSuggestMoment();
    case 'publish_moment': return toolPublishMoment(client, userId, args.content as string, args.image_urls as string[]);
    case 'get_user_info': return toolGetUserInfo(client, userId);
    case 'generate_image': return toolGenerateImage(client, userId, args.prompt as string, args.style as string);
    case 'generate_video': return toolGenerateVideo(args.prompt as string, args.duration as number);
    case 'send_message': return toolSendMessage(client, userId, args.content as string, args.target_type as string, args.target_id as number, args.target_name as string, args.image_url as string);
    case 'create_task': return toolCreateTask(client, userId, args.name as string, args.cron_expression as string, args.description as string, args.config as Record<string, unknown>);
    case 'delete_friend': return toolDeleteFriend(client, userId, args.friend_id as number, args.friend_name as string);
    case 'leave_group': return toolLeaveGroup(client, userId, args.group_id as number, args.group_name as string);
    case 'edit_moment': return toolEditMoment(client, userId, args.moment_id as number, args.keyword as string, args.new_content as string, args.new_images as string[]);
    case 'delete_moment': return toolDeleteMoment(client, userId, args.moment_id as number, args.keyword as string);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// 直接执行工具（用于用户确认后）
async function executeToolDirectly(client: SupabaseClient, userId: number, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'generate_image': return doGenerateImage(args.prompt as string, args.style as string);
    case 'generate_video': return doGenerateVideo(args.prompt as string, args.duration as number);
    case 'send_message': return doSendMessageAsBot(client, userId, args.conversation_id as number, args.content as string, args.type as string);
    case 'delete_friend': return doDeleteFriend(client, userId, args.friend_id as number);
    case 'leave_group': return doLeaveGroup(client, userId, args.group_id as number);
    case 'edit_moment': return doEditMoment(client, userId, args.moment_id as number, args.new_content as string, args.new_images as string[]);
    case 'delete_moment': return doDeleteMoment(client, userId, args.moment_id as number);
    default: return { error: `Direct execution not supported for tool: ${name}` };
  }
}

// Bot 发送消息（使用 Bot 的 sender_id）
async function doSendMessageAsBot(client: SupabaseClient, userId: number, conversationId: number, content: string, type: string = 'text') {
  try {
    // 获取 Bot 用户信息
    const { data: botUser } = await client
      .from('users')
      .select('id')
      .eq('nickname', '小 Q 管家')
      .maybeSingle();

    if (!botUser) {
      return { success: false, error: 'Bot 用户不存在' };
    }

    // 验证会话是否属于当前用户
    const { data: conversation } = await client
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.user_id !== userId) {
      return { success: false, error: '无权向该会话发送消息' };
    }

    // 插入消息（使用 Bot 的 sender_id）
    const { data: message, error } = await client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: botUser.id,
        type: type,
        content: content,
      })
      .select('id, created_at')
      .single();

    if (error) throw new Error(`发送消息失败: ${error.message}`);

    // 更新会话的最后消息
    await client
      .from('conversations')
      .update({
        last_message: type === 'image' ? '[图片]' : content.substring(0, 50),
        last_message_time: message.created_at,
      })
      .eq('id', conversationId);

    return { success: true, message: '消息已发送' };
  } catch (error) {
    console.error('Bot 发送消息失败:', error);
    return { success: false, error: '发送消息时发生错误' };
  }
}

// 解析 LLM 输出中的工具调用
export function parseToolCalls(content: string): { name: string; arguments: Record<string, unknown> }[] {
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  // 匹配 [TOOL_CALL:...] 到 [TOOL_CALL_END] 之间的内容
  const regex = /\[TOOL_CALL:([\s\S]*?)\][\s\S]*?\[TOOL_CALL_END\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.name) {
        calls.push(parsed);
      }
    } catch {
      // 忽略解析错误
    }
  }

  return calls;
}

// 清理 LLM 输出中的工具调用标记
export function cleanContent(content: string): string {
  const cleaned = content
    .replace(/\[TOOL_CALL:[\s\S]*?\]/g, '')
    .replace(/\[TOOL_CALL_END\]/g, '')
    .trim();
  return cleaned;
}

// ============================================
// ReAct Agent
// ============================================

async function runReActAgent(client: SupabaseClient, userId: number, userMessage: string): Promise<{ content: string; toolCalls?: unknown[] }> {
  // 获取上下文（并行查询，节省 100-200ms）
  const [identity, memory, userInfo] = await Promise.all([
    toolReadIdentity(client, userId),
    toolReadMemory(client, userId),
    toolGetUserInfo(client, userId),
  ]);

  const userCallName = identity.user_call_name || identity.user_name || userInfo.nickname;

  // 构建系统提示词
  const systemPrompt = `${SOUL}

【重要：工具调用规则】
当用户提出以下类型的请求时，必须调用对应工具：
- 询问"你叫什么/你是谁" → 调用 read_identity
- 要求改名 → 调用 write_identity(bot_name="新名字")
- 要求称呼用户 → 调用 write_identity(user_call_name="新称呼")
- 要求记住内容 → 调用 write_memory(content="内容")
- 搜索聊天记录 → 调用 search_messages(keyword="关键词", group_name="群名")
- 查看自己发的消息 → 调用 get_my_messages(group_name="群名")
- 润色文字 → 调用 polish_text(text="文本", style="casual")
- 想发空间/说说 → 调用 suggest_moment
- 询问用户信息 → 调用 get_user_info
- 创建定时提醒/任务/课表 → 调用 create_task(name="任务名", cron_expression="cron表达式", description="描述", config={})
  * 用户说"每周一上午8点提醒我上课" → name="上课提醒", cron_expression="0 8 * * 1", description="每周一上午8点提醒上课"
  * 用户说"每天晚上10点提醒睡觉" → name="睡觉提醒", cron_expression="0 22 * * *", description="每天晚上10点提醒睡觉"

【高风险操作规则 - 强制】
当用户请求涉及以下行为时，你必须先询问用户是否确认，绝对不允许直接执行：
1. 发送消息/代发消息/帮别人发消息 → 先确认再调用 send_message
2. 发布QQ空间/发动态/发说说 → 先确认再调用 publish_moment
3. 生成图片/画画/出图 → 先确认再调用 generate_image
4. 生成视频/做视频/出片 → 先确认再调用 generate_video
5. 删除好友/移除好友/删人 → 先确认再调用 delete_friend
6. 退出群聊/退群/离开群 → 先确认再调用 leave_group
7. 编辑QQ空间动态/修改说说 → 先确认再调用 edit_moment
8. 删除QQ空间动态/删说说 → 先确认再调用 delete_moment

正确做法：
1. 先理解用户意图
2. 准备好工具调用的参数
3. 在回复中告诉用户你准备做什么，并询问"确认执行吗？"
4. 等待用户回复"确认"、"好"、"可以"、"执行"等肯定词后再调用工具

示例：
用户："给小明发个消息说明天开会"
回复："好的，我准备给小明发消息：'明天开会'，确认发送吗？"
用户："确认"
回复：[TOOL_CALL:{"name":"send_message","arguments":{"content":"明天开会","target_name":"小明"}}]
[TOOL_CALL_END]

【代发消息规则】
当用户要求"给XX发..."或"帮我说..."时：
1. 先调用 polish_text 润色内容（按用户要求的语气）
2. 在回复中告诉用户你准备发送的内容和目标
3. 询问用户"确认发送吗？"
4. 等待用户确认后再调用 send_message 工具

【工具调用格式 - 严格遵守】
当需要调用工具时，在回复末尾追加以下格式的文本（不要修改格式，不要省略任何部分）：
[TOOL_CALL:{"name":"工具名","arguments":{"参数":"值"}}]
[TOOL_CALL_END]

示例（用户确认后调用）：
[TOOL_CALL:{"name":"send_message","arguments":{"content":"你好","target_name":"小明"}}]
[TOOL_CALL_END]

[TOOL_CALL:{"name":"publish_moment","arguments":{"content":"今天天气真好","image_urls":[]}}]
[TOOL_CALL_END]

如果不需要工具，直接回答即可。

${TOOLS_DESCRIPTION}

【当前状态】
- 我的名字：${identity.bot_name}
- 用户称呼：${userCallName}
- 用户昵称：${userInfo.nickname}

【长期记忆】
${memory.memory}

【最近对话】
${memory.daily_notes || '（暂无）'}

回复要求：
1. 简洁、有情感
2. 根据用户称呼来称呼用户（如"父王"、"大王"等）
3. 如果调用了工具，基于工具结果回复`;

  // 检测用户是否意图进行高危操作（用于防护层）
  // 只拦截"模糊"的高危请求，不拦截明确的请求
  function detectHighRiskIntent(message: string): { isRisky: boolean; isExplicit: boolean } {
    const lower = message.toLowerCase();

    // 明确的操作意图（不拦截，让LLM自己处理）
    const explicitPatterns = [
      /(?:给|向|对).{0,5}(?:小明|张三|李四|王五|小红|小花|[\u4e00-\u9fa5]{2,4}).{0,5}(?:发|送)/,
      /(?:发|发布|写).{0,3}(?:空间|朋友圈|说说|动态)/,
      /(?:画|生成|做|出).{0,3}(?:图|图片|画)/,
      /(?:生成|做|出).{0,3}(?:视频|短片|动图)/,
    ];

    // 模糊的高危意图（需要拦截）
    const vagueRiskPatterns = [
      /^\s*(?:帮|代|替).{0,2}(?:我|忙)?\s*(?:发|送)/, // "帮我发"、"发"
      /^\s*发(?:给|到|往|出去)?\s*$/, // 单字"发"
      /^\s*(?:publish|send)\s*$/i,
    ];

    const isExplicit = explicitPatterns.some(p => p.test(lower));
    const isVagueRisk = vagueRiskPatterns.some(p => p.test(lower));

    return {
      isRisky: isExplicit || isVagueRisk,
      isExplicit,
    };
  }

  const riskCheck = detectHighRiskIntent(userMessage);

  // 第一次调用
  let content = await callOpenAICompatible([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], { temperature: 0.8 });

  const toolCalls = parseToolCalls(content);

  // 【防护层】只对"模糊的高危意图"且LLM未触发tool call时拦截
  // 如果用户意图明确（如"发给小明"、"发空间"），不拦截，让LLM自己处理
  if (riskCheck.isRisky && !riskCheck.isExplicit && toolCalls.length === 0) {
    return {
      content: '我注意到你可能想让我帮忙发送内容或生成媒体，请再说得具体一点，比如"发给谁"、"发什么"，我会先给你预览确认~',
    };
  }

  // 如果有工具调用，执行并反馈
  if (toolCalls.length > 0) {
    const toolResults = [];
    for (const call of toolCalls) {
      const result = await executeTool(client, userId, call.name, call.arguments);
      toolResults.push(`[${call.name} 结果] ${JSON.stringify(result)}`);
    }

    // 清理内容中的工具调用标记
    content = cleanContent(content);

    // 第二次调用，反馈工具结果
    const finalContent = await callOpenAICompatible([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
      { role: 'assistant', content: content + '\n[TOOL_CALL 解析执行中...]' },
      { role: 'user', content: `工具执行结果：\n${toolResults.join('\n')}\n\n请基于以上结果，给出最终回复：` },
    ], { temperature: 0.8 });

    content = finalContent || content;
  }

  // 清理任何剩余的标记
  content = cleanContent(content);

  // 记录日志
  await addDailyNote(client, userId, `用户: ${userMessage}\n助手: ${content}`);

  return {
    content: content || '好的~',
    toolCalls: toolCalls.length > 0 ? toolCalls.map(c => ({ name: c.name, arguments: c.arguments })) : [],
  };
}

// ============================================
// Plan-Execute-Observe Agent 编排器
// ============================================

// 检测是否为复杂请求（需要多步执行）
function detectComplexRequest(message: string): boolean {
  const complexPatterns = [
    /然后|接着|之后|再|随后|最后/, // 多步骤连接词
    /先.*再|先.*然后/, // 先后顺序
    /搜索.*发|查.*发|找.*发/, // 搜索后发消息
    /润色.*发|改.*发/, // 润色后发送
    /(?:帮|代|替).{0,5}(?:我|忙)?.{0,10}(?:然后|接着|再)/, // 复杂代办
  ];
  return complexPatterns.some(p => p.test(message)) || message.length > 50;
}

interface PlanStep {
  step: number;
  action: string;
  tool?: string;
  params?: Record<string, unknown>;
}

interface ExecutionPlan {
  steps: PlanStep[];
  summary: string;
}

// Planner：拆解用户请求为执行计划
async function planRequest(client: SupabaseClient, userId: number, userMessage: string): Promise<ExecutionPlan> {
  const systemPrompt = `你是一个任务规划助手。将用户的请求拆解为可执行的步骤计划。

可用工具：
- search_messages(keyword, group_name?) - 搜索群聊消息
- get_my_messages(group_name?) - 获取用户自己的消息
- polish_text(text, style?) - 润色文本
- send_message(content, target_name?) - 发送消息
- publish_moment(content, image_urls?) - 发布空间动态
- generate_image(prompt, style?) - 生成图片

只输出 JSON 格式：
{
  "steps": [
    { "step": 1, "action": "描述", "tool": "工具名", "params": {参数} },
    ...
  ],
  "summary": "计划总结"
}`;

  const content = await callOpenAICompatible([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], { temperature: 0.3, maxTokens: 1024 });

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0]) as ExecutionPlan;
      return plan;
    }
  } catch {
    // 解析失败，返回单步计划
  }

  return {
    steps: [{ step: 1, action: '直接处理用户请求', tool: undefined, params: {} }],
    summary: '直接处理',
  };
}

// 工具结果转为可读摘要
function summarizeToolResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return String(result);
  const r = result as Record<string, unknown>;
  if (r.success === false) return `失败: ${r.error || r.message || '未知错误'}`;
  if (r.message) return String(r.message);
  if (r.result) return String(r.result);
  if (r.nickname) return String(r.nickname); // get_user_info
  return JSON.stringify(result);
}

// 替换参数中的模板变量为实际值
// 支持格式：{{step2.text}}, {{step_2_result}}, {{step2.result}}, [上一步生成的文案] 等
function resolveTemplateParams(
  params: Record<string, unknown>,
  context: Record<string, string>,
  lastStepResult?: string
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      let newValue = value;
      const isImageParam = key.toLowerCase().includes('image');

      // 1. 匹配 {{step2.text}}, {{step_2_result}}, {{step2.result}} 等
      newValue = newValue.replace(/\{\{step[_-]?(\d+)[._-]?(\w+)\}\}/gi, (_match, stepNum, field) => {
        const varKey = `step${stepNum}.${field.toLowerCase()}`;
        // 图片类参数优先查找 stepX.imageUrl
        if (isImageParam && field.toLowerCase() === 'result') {
          const imageUrlKey = `step${stepNum}.imageurl`;
          return context[imageUrlKey] ?? context[varKey] ?? _match;
        }
        return context[varKey] ?? _match;
      });
      // 2. 匹配 {{step2}} 简写形式
      newValue = newValue.replace(/\{\{step[_-]?(\d+)\}\}/gi, (_match, stepNum) => {
        // 图片类参数优先查找 stepX.imageUrl
        if (isImageParam) {
          const imageUrlKey = `step${stepNum}.imageurl`;
          if (context[imageUrlKey]) return context[imageUrlKey];
        }
        const varKey = `step${stepNum}.result`;
        return context[varKey] ?? _match;
      });
      // 3. 中文占位符：如果包含"上一步"、"前一步"、"step"、"结果"、"文案"等描述性词语
      // 且看起来像占位符（用方括号包裹或包含"生成的"、"结果"），则用 lastStepResult 替换
      if (/\[.*(?:上一步|前一步|生成的|结果|文案|内容|step).*\]/i.test(newValue)) {
        newValue = lastStepResult ?? newValue;
      }
      // 4. 如果值本身就是模板变量格式且未被替换，则尝试用 lastStepResult
      if (newValue.startsWith('{{') && newValue.endsWith('}}') && lastStepResult) {
        newValue = lastStepResult;
      }
      resolved[key] = newValue;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

// Executor：执行计划步骤
async function executePlan(
  client: SupabaseClient,
  userId: number,
  plan: ExecutionPlan,
  userMessage: string
): Promise<{ content: string; toolCalls?: unknown[] }> {
  const stepResults: string[] = [];
  const allToolCalls: unknown[] = [];
  // 用于模板变量替换的上下文，key 为 "step1.text", "step2.result" 等
  const context: Record<string, string> = {};

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (step.tool) {
      try {
        // 替换 params 中的模板变量，传入上一步结果用于中文占位符
        const lastStepResult = stepResults.length > 0 ? stepResults[stepResults.length - 1].replace(/^.*?:\s*/, '') : undefined;
        const resolvedParams = resolveTemplateParams(step.params || {}, context, lastStepResult);
        const result = await executeTool(client, userId, step.tool, resolvedParams);
        const summary = summarizeToolResult(step.tool, result);
        stepResults.push(`${step.action}: ${summary}`);
        allToolCalls.push({ name: step.tool, arguments: resolvedParams, result });
        // 将当前步骤结果存入上下文，供后续步骤引用
        const stepNum = i + 1;
        context[`step${stepNum}.text`] = summary;
        context[`step${stepNum}.result`] = summary;
        if (typeof result === 'object' && result !== null) {
          const r = result as Record<string, unknown>;
          if (typeof r.message === 'string') context[`step${stepNum}.message`] = r.message;
          if (typeof r.content === 'string') context[`step${stepNum}.content`] = r.content;
          if (typeof r.result === 'string') context[`step${stepNum}.result`] = r.result;
          // generate_image 的 imageUrl 需要单独存入上下文，供 publish_moment 后续步骤引用
          if (step.tool === 'generate_image' && typeof r.imageUrl === 'string') {
            context[`step${stepNum}.imageUrl`] = r.imageUrl;
          }
        }
      } catch (error) {
        stepResults.push(`${step.action}: 失败 - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Observer：基于执行结果生成最终回复
  const observePrompt = `用户请求：${userMessage}

已执行的操作和结果：
${stepResults.map((r, i) => `${i + 1}. ${r}`).join('\n')}

请用简洁友好的中文回复用户，告诉他操作结果。不要使用模板变量或占位符。`;

  const finalContent = await callOpenAICompatible([
    { role: 'system', content: '你是小Q管家，用简洁友好的中文回复用户。直接描述操作结果，不要使用占位符。' },
    { role: 'user', content: observePrompt },
  ], { temperature: 0.8 });

  return {
    content: finalContent || '任务执行完成~',
    toolCalls: allToolCalls,
  };
}

// Plan-Execute-Observe 主入口
async function runPlanExecuteAgent(
  client: SupabaseClient,
  userId: number,
  userMessage: string
): Promise<{ content: string; toolCalls?: unknown[] }> {
  // Step 1: Plan
  const plan = await planRequest(client, userId, userMessage);

  // Step 2: Execute
  const result = await executePlan(client, userId, plan, userMessage);

  // 记录到每日笔记
  await addDailyNote(client, userId, `用户: ${userMessage}\n计划: ${plan.summary}\n助手: ${result.content}`);

  return result;
}

async function runReActAgentWithTimeout(client: SupabaseClient, userId: number, userMessage: string, timeoutMs = 90000): Promise<{ content: string; toolCalls?: unknown[] }> {
  // 检测是否为复杂请求，如果是则使用 Plan-Execute-Observe 模式
  if (detectComplexRequest(userMessage)) {
    return Promise.race([
      runPlanExecuteAgent(client, userId, userMessage),
      new Promise<{ content: string }>((resolve) => {
        setTimeout(() => {
          resolve({ content: '我收到了，你这条我先记下啦。现在后台有点忙，稍等一下我再细致帮你整理~' });
        }, timeoutMs);
      }),
    ]);
  }

  return Promise.race([
    runReActAgent(client, userId, userMessage),
    new Promise<{ content: string }>((resolve) => {
      setTimeout(() => {
        resolve({ content: '我收到了，你这条我先记下啦。现在后台有点忙，稍等一下我再细致帮你整理~' });
      }, timeoutMs);
    }),
  ]);
}

// ============================================
// API 路由
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = await getSupabaseClient();
    const identity = await toolReadIdentity(client, payload.userId);
    const botName = identity.bot_name || '小 Q 管家';

    const { data: botUser } = await client
      .from('users')
      .select('id, qq_number, nickname, avatar_color, status, signature')
      .eq('nickname', '小 Q 管家')
      .maybeSingle();

    return NextResponse.json({
      bot: botUser
        ? {
            ...botUser,
            nickname: botName,
          }
        : null,
      name: botName,
    });
  } catch (error) {
    console.error('获取管家配置失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let auditLog: {
    userId: number;
    request: string;
    response: string;
    toolCalls: unknown[];
    status: 'success' | 'failed';
    error: string;
  } | null = null;

  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    // CSRF 验证 — 所有状态变更操作必须经过 CSRF 校验
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    // 处理工具直接执行（用户确认后）
    if (body.execute_tool) {
      const toolValidated = botToolExecuteSchema.safeParse(body);
      if (!toolValidated.success) {
        return NextResponse.json({ error: '参数验证失败' }, { status: 400 });
      }
      // 高风险工具需要用户确认
      const highRiskTools = ['delete_friend', 'leave_group', 'edit_moment', 'delete_moment'];
      if (highRiskTools.includes(toolValidated.data.tool) && !body.confirmation_id) {
        return NextResponse.json({ error: '该操作需要确认，请提供 confirmation_id' }, { status: 400 });
      }
      const client = await getSupabaseClient();
      const result = await executeToolDirectly(client, payload.userId, toolValidated.data.tool, toolValidated.data.params || {});
      return NextResponse.json(result);
    }

    const msgValidated = botMessageSchema.safeParse(body);
    if (!msgValidated.success) {
      return NextResponse.json({ error: '参数验证失败' }, { status: 400 });
    }
    const { message, conversation_id } = msgValidated.data;
    const userMessage = message.trim();

    // 【用户级限流】
    const rateLimit = await checkUserRateLimit(payload.userId, { maxRequests: 30, windowMs: 60 * 1000, keyPrefix: 'bot' });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        response: `请求太频繁啦，请 ${rateLimit.resetIn} 秒后再试~`,
        type: 'text',
      }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } });
    }

    // 初始化审计日志
    auditLog = {
      userId: payload.userId,
      request: userMessage,
      response: '',
      toolCalls: [],
      status: 'success',
      error: '',
    };

    // 【用户级请求队列】确保同一用户串行处理
    const client = await getSupabaseClient();
    const result = await acquireUserLock(payload.userId, () =>
      runReActAgentWithTimeout(client, payload.userId, userMessage)
    );
    const response = result.content;

    // 更新审计日志
    if (auditLog) {
      auditLog.response = response;
      auditLog.toolCalls = result.toolCalls || [];
    }

    // 如果提供了 conversation_id，将 Bot 回复持久化到 messages 表
    if (conversation_id) {
      try {
        const { data: botUser } = await client
          .from('users')
          .select('id, nickname, avatar_color')
          .eq('nickname', '小 Q 管家')
          .maybeSingle();

        if (botUser) {
          const { data: insertedMsg } = await client.from('messages').insert({
            conversation_id,
            sender_id: botUser.id,
            content: response,
            type: 'text',
          }).select('id, created_at').single();

          // 更新会话最后消息时间和内容
          await client
            .from('conversations')
            .update({
              last_message: response.substring(0, 50),
              last_message_time: insertedMsg?.created_at || new Date().toISOString(),
            })
            .eq('id', conversation_id);

          // 通过 WebSocket 推送 Bot 新消息到会话内用户
          // 流式模式下（skip_websocket=true）不推送，由 SSE 负责返回内容，避免前端重复显示
          if (!body.skip_websocket) {
            const io = (globalThis as typeof globalThis & { io?: unknown }).io;
            if (io) {
              (io as { to: (room: string) => { emit: (event: string, data: unknown) => void } })
                .to(`conversation_${conversation_id}`)
                .emit('new_message', {
                  id: insertedMsg?.id,
                  conversation_id,
                  sender_id: botUser.id,
                  sender_nickname: botUser.nickname,
                  sender_avatar: botUser.avatar_color,
                  type: 'text',
                  content: response,
                  created_at: insertedMsg?.created_at || new Date().toISOString(),
                  is_mine: false,
                });
            }
          }
        }
      } catch (persistError) {
        console.error('Bot 回复持久化失败:', persistError);
        // 不阻塞返回，仅记录日志
      }
    }

    // 异步写入审计日志（不阻塞响应）
    if (auditLog) {
      Promise.resolve().then(async () => {
        try {
          const client = await getSupabaseClient();
          await client.from('bot_audit_logs').insert({
            user_id: auditLog!.userId,
            request: auditLog!.request,
            response: auditLog!.response,
            tool_calls: auditLog!.toolCalls,
            latency_ms: Date.now() - startTime,
            model: process.env.CHAT_MODEL || '',
            status: auditLog!.status,
            error: auditLog!.error,
          });
        } catch (e) {
          console.error('审计日志写入失败:', e);
        }
      });
    }

    return NextResponse.json({ response, type: 'text' });

  } catch (error: unknown) {
    console.error('管家处理错误:', error);

    // 更新审计日志为失败状态
    if (auditLog) {
      auditLog.status = 'failed';
      auditLog.error = error instanceof Error ? error.message : String(error);
      Promise.resolve().then(async () => {
        try {
          const client = await getSupabaseClient();
          await client.from('bot_audit_logs').insert({
            user_id: auditLog!.userId,
            request: auditLog!.request,
            response: auditLog!.response,
            tool_calls: auditLog!.toolCalls,
            latency_ms: Date.now() - startTime,
            model: process.env.CHAT_MODEL || '',
            status: auditLog!.status,
            error: auditLog!.error,
          });
        } catch (e) {
          console.error('审计日志写入失败:', e);
        }
      });
    }

    // 检查是否是 LLM API 错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ErrBalanceOverdue') || errorMessage.includes('余额') || errorMessage.includes('balance')) {
      return NextResponse.json({
        response: '抱歉，当前服务暂时无法使用（LLM API 账户余额不足），请稍后再试~',
        type: 'text'
      });
    }

    // 其他错误返回友好提示
    return NextResponse.json({
      response: '抱歉，我刚才有点走神了，能再说一遍吗？',
      type: 'text'
    });
  }
}
