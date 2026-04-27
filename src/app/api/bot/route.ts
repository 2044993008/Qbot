import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { ImageGenerationClient } from 'coze-coding-dev-sdk';
import { VideoGenerationClient } from 'coze-coding-dev-sdk';

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
- 搜索聊天记录、润色文字、代发消息、发布QQ空间动态
- 读取/更新身份配置、读取/更新记忆
`;

// ============================================
// Tool 定义
// ============================================

const TOOLS_DESCRIPTION = `
【可用工具】
1. read_identity - 读取身份信息（我的名字、用户称呼）
2. write_identity(bot_name, user_call_name) - 更新身份信息
3. read_memory - 读取长期记忆和最近对话
4. write_memory(content) - 写入新的记忆
5. search_messages(keyword, group_name?) - 搜索群聊消息
6. get_my_messages(group_name?) - 获取用户自己发送的消息
7. polish_text(text, style?) - 润色文本（style: casual/cute/formal）
8. suggest_moment - 生成空间动态文案（仅建议，不发布）
9. publish_moment(content?, image_urls?) - 发布动态到QQ空间
10. get_user_info - 获取用户基本信息
10. generate_image(prompt, style?) - 生成图片（style: realistic/anime/cartoon/art）
11. generate_video(prompt, duration?) - 生成视频/动图（duration: 4-12秒）
12. send_message(content, target_type?, target_id?, target_name?) - 发送消息
    - target_type: "friend"(默认)/"group"
    - target_id: 直接指定目标ID
    - target_name: 指定目标名称（会自动查找）

【工具响应格式】
当需要使用工具时，在回复末尾添加：
[TOOL_CALL:{"name":"工具名","arguments":{"参数":"值"}}]
[TOOL_CALL_END]
`;

// ============================================
// Tool 实现
// ============================================

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseClient>>;

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
  await client
    .from('user_settings')
    .upsert({
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,key',
    });
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

// Tool: read_identity
async function toolReadIdentity(client: SupabaseClient, userId: number) {
  const identity = await getSetting(client, userId, 'bot_identity') || '';
  const user = await getSetting(client, userId, 'bot_user') || '';

  const botNameMatch = identity.match(/- 名称：(.+)/);
  const userCallMatch = user.match(/- 用户称谓：(.+)/);
  const userNameMatch = user.match(/- 用户名：(.+)/);

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

// Tool: read_memory
async function toolReadMemory(client: SupabaseClient, userId: number) {
  const memory = await getSetting(client, userId, 'bot_memory') || '(暂无长期记忆)';
  const notes = await getDailyNotes(client, userId);
  return {
    memory,
    daily_notes: notes.slice(-5).map(n => `[${n.date}] ${n.content}`).join('\n\n'),
  };
}

// Tool: write_memory
async function toolWriteMemory(client: SupabaseClient, userId: number, content: string) {
  const memory = await getSetting(client, userId, 'bot_memory') || '# MEMORY.md\n';
  const today = new Date().toISOString().split('T')[0];
  const newMemory = `${memory}\n\n## ${today}\n- ${content}`;
  await setSetting(client, userId, 'bot_memory', newMemory);
  return { success: true };
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

// Tool: send_message - 发送消息
async function toolSendMessage(
  client: SupabaseClient,
  userId: number,
  content: string,
  targetType?: string,
  targetId?: number,
  targetName?: string
) {
  try {
    let conversationId: number | null = null;
    let targetDisplayName = '';

    if (targetId) {
      // 直接指定目标ID
      const { data: conv } = await client
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('target_id', targetId)
        .single();

      if (conv) {
        conversationId = conv.id;
        targetDisplayName = `ID:${targetId}`;
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
            }
          }
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

    if (!conversationId) {
      return { success: false, error: '找不到目标会话' };
    }

    // 发送消息
    const { data: message } = await client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        type: 'text',
      })
      .select('id, created_at')
      .single();

    if (message) {
      // 更新会话时间
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

// Tool: publish_moment - 发布空间动态
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

    const { data: moment, error } = await client
      .from('moments')
      .insert({
        user_id: userId,
        content: momentContent,
        images: imageUrls || [],
        like_count: 0,
        comment_count: 0,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('发布动态失败:', error);
      return { success: false, error: '发布失败' };
    }

    return {
      success: true,
      message: '动态已发布',
      moment_id: moment.id,
      content: momentContent,
      time: new Date(moment.created_at).toLocaleString('zh-CN'),
    };
  } catch (error) {
    console.error('发布动态失败:', error);
    return { success: false, error: '发布动态时发生错误' };
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

// Tool: generate_image - 生成图片
async function toolGenerateImage(prompt: string, style = 'realistic'): Promise<{ imageUrl: string | null; error?: string }> {
  try {
    const config = new Config();
    const imageClient = new ImageGenerationClient(config);

    // 根据风格优化提示词
    let enhancedPrompt = prompt;
    if (style === 'anime') {
      enhancedPrompt = `Anime style, ${prompt}, high quality, detailed`;
    } else if (style === 'cartoon') {
      enhancedPrompt = `Cartoon style, ${prompt}, colorful, fun`;
    } else if (style === 'art') {
      enhancedPrompt = `Digital art style, ${prompt}, artistic, creative`;
    }

    const response = await imageClient.generate({
      prompt: enhancedPrompt,
      size: '2K',
      watermark: false,
    });

    const helper = imageClient.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      return { imageUrl: helper.imageUrls[0] };
    }

    return { imageUrl: null, error: helper.errorMessages[0] || '生成失败' };
  } catch (error) {
    console.error('生成图片失败:', error);
    return { imageUrl: null, error: '生成图片时发生错误' };
  }
}

// Tool: generate_video - 生成视频/动图
async function toolGenerateVideo(prompt: string, duration = 5): Promise<{ videoUrl: string | null; error?: string }> {
  try {
    const config = new Config();
    const videoClient = new VideoGenerationClient(config);

    const response = await videoClient.videoGeneration(
      [{ type: 'text', text: prompt }],
      {
        model: 'doubao-seedance-1-5-pro-251215',
        duration: Math.min(Math.max(duration, 4), 12), // 限制在 4-12 秒
        ratio: '1:1', // 方形适合表情包/GIF
        resolution: '720p',
        watermark: false,
        generateAudio: false, // 静默视频更适合 GIF
      }
    );

    if (response.videoUrl) {
      return { videoUrl: response.videoUrl };
    }

    return { videoUrl: null, error: response.response?.error_message || '生成失败' };
  } catch (error) {
    console.error('生成视频失败:', error);
    return { videoUrl: null, error: '生成视频时发生错误' };
  }
}

// 执行工具
async function executeTool(client: SupabaseClient, userId: number, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'read_identity': return toolReadIdentity(client, userId);
    case 'write_identity': return toolWriteIdentity(client, userId, args.bot_name as string, args.user_call_name as string);
    case 'read_memory': return toolReadMemory(client, userId);
    case 'write_memory': return toolWriteMemory(client, userId, args.content as string);
    case 'search_messages': return toolSearchMessages(client, userId, args.keyword as string, args.group_name as string);
    case 'get_my_messages': return toolGetMyMessages(client, userId, args.group_name as string);
    case 'polish_text': return toolPolishText(args.text as string, args.style as string);
    case 'suggest_moment': return toolSuggestMoment();
    case 'publish_moment': return toolPublishMoment(client, userId, args.content as string, args.image_urls as string[]);
    case 'get_user_info': return toolGetUserInfo(client, userId);
    case 'generate_image': return toolGenerateImage(args.prompt as string, args.style as string);
    case 'generate_video': return toolGenerateVideo(args.prompt as string, args.duration as number);
    case 'send_message': return toolSendMessage(client, userId, args.content as string, args.target_type as string, args.target_id as number, args.target_name as string);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// 解析 LLM 输出中的工具调用
function parseToolCalls(content: string): { name: string; arguments: Record<string, unknown> }[] {
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
function cleanContent(content: string): string {
  return content
    .replace(/\[TOOL_CALL:[^\]]+\]/g, '')
    .replace(/\[TOOL_CALL_END\]/g, '')
    .trim();
}

// ============================================
// ReAct Agent
// ============================================

async function runReActAgent(client: SupabaseClient, userId: number, userMessage: string): Promise<string> {
  const config = new Config();
  const llm = new LLMClient(config);

  // 获取上下文
  const identity = await toolReadIdentity(client, userId);
  const memory = await toolReadMemory(client, userId);
  const userInfo = await toolGetUserInfo(client, userId);

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

调用格式（必须严格遵守）：
[TOOL_CALL:{"name":"工具名","arguments":{"参数":"值"}}]
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

  // 第一次调用
  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], {
    model: 'doubao-seed-1-6-251015',
    temperature: 0.8,
  });

  let content = response.content || '';
  const toolCalls = parseToolCalls(content);

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
    const finalResponse = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
      { role: 'assistant', content: content + '\n[TOOL_CALL 解析执行中...]' },
      { role: 'user', content: `工具执行结果：\n${toolResults.join('\n')}\n\n请基于以上结果，给出最终回复：` },
    ], {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.8,
    });

    content = finalResponse.content || content;
  }

  // 清理任何剩余的标记
  content = cleanContent(content);

  // 记录日志
  await addDailyNote(client, userId, `用户: ${userMessage}\n助手: ${content}`);

  return content || '好的~';
}

// ============================================
// API 路由
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
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
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { message } = await request.json();
    const userMessage = message?.trim();

    if (!userMessage) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    const client = await getSupabaseClient();
    const response = await runReActAgent(client, payload.userId, userMessage);

    return NextResponse.json({ response, type: 'text' });

  } catch (error: unknown) {
    console.error('管家处理错误:', error);
    
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
