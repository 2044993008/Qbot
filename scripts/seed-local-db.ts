import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

type UserStatus = 'online' | 'offline' | 'busy';

type UserRecord = {
  id: number;
  qq_number: string;
  nickname: string;
  avatar_color: string;
  signature: string;
  status: UserStatus;
};

type GroupRecord = {
  id: number;
  name: string;
  avatar_color: string;
  description: string;
};

type ConversationRecord = {
  id: number;
  type: 'private' | 'group';
  user_id: number;
  target_id: number;
};

type FriendProfile = {
  qq_number: string;
  nickname: string;
  avatar_color: string;
  signature: string;
  status: UserStatus;
};

type GroupBlueprint = {
  name: string;
  avatar_color: string;
  description: string;
  memberships: Array<{ qq_number: string; role: string }>;
};

type MessageDraft = {
  daysAgo: number;
  hour: number;
  minute: number;
  sender: string;
  content: string;
  type?: 'text';
  metadata?: Record<string, unknown>;
};

type MomentDraft = {
  user: string;
  daysAgo: number;
  hour: number;
  minute: number;
  content: string;
  images?: string[];
  comments?: Array<{ user: string; content: string; offsetDays?: number; offsetHours?: number }>;
  likes?: string[];
};

type InsertableMessage = {
  conversation_id: number;
  sender_id: number;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const DAY = 24 * 60 * 60 * 1000;
const FRIEND_PROFILES: FriendProfile[] = [
  { qq_number: '10002', nickname: '张小明', avatar_color: '#ef4444', signature: '下课先去食堂占位', status: 'online' },
  { qq_number: '10003', nickname: '李华', avatar_color: '#22c55e', signature: '今晚图书馆见', status: 'offline' },
  { qq_number: '10005', nickname: '陈伟', avatar_color: '#8b5cf6', signature: '接口别拍脑袋改', status: 'online' },
  { qq_number: '10006', nickname: '刘芳', avatar_color: '#ec4899', signature: '周末想去拍照', status: 'busy' },
  { qq_number: '10009', nickname: '小 Q 管家', avatar_color: '#6366f1', signature: '有事叫我', status: 'online' },
  { qq_number: '10010', nickname: '赵敏', avatar_color: '#14b8a6', signature: '测试环境先别动', status: 'online' },
];

const GROUP_BLUEPRINTS: GroupBlueprint[] = [
  {
    name: '计算机2103班群',
    avatar_color: '#10b981',
    description: '班级通知和作业交流',
    memberships: [
      { qq_number: '10001', role: '普通成员' },
      { qq_number: '10002', role: '班长' },
      { qq_number: '10003', role: '学习委员' },
      { qq_number: '10005', role: '老师' },
      { qq_number: '10006', role: '普通成员' },
      { qq_number: '10010', role: '普通成员' },
    ],
  },
  {
    name: '前端开发交流群',
    avatar_color: '#3b82f6',
    description: '联调和样式问题都在这里说',
    memberships: [
      { qq_number: '10001', role: '群主' },
      { qq_number: '10003', role: 'React党' },
      { qq_number: '10005', role: '后端接口' },
      { qq_number: '10009', role: 'AI 助手' },
      { qq_number: '10010', role: '测试' },
    ],
  },
  {
    name: '周末出游搭子群',
    avatar_color: '#14b8a6',
    description: '周末约饭和短途出门',
    memberships: [
      { qq_number: '10001', role: '组织者' },
      { qq_number: '10002', role: '路线规划' },
      { qq_number: '10006', role: '拍照担当' },
      { qq_number: '10010', role: '记账' },
    ],
  },
];

const PRIVATE_CHAT_THREADS: Record<string, MessageDraft[]> = {
  '10002': [
    { daysAgo: 18, hour: 11, minute: 12, sender: '10002', content: '中午要不要一起吃？我已经在一食堂这边了。' },
    { daysAgo: 18, hour: 11, minute: 15, sender: '10001', content: '来，帮我先占个靠窗的位置，我下课就过去。' },
    { daysAgo: 18, hour: 11, minute: 18, sender: '10002', content: '行，我顺便把你那份鸡排也点了。' },
    { daysAgo: 6, hour: 20, minute: 4, sender: '10002', content: '明天早八老师要点名，别又卡着铃声进门。' },
    { daysAgo: 6, hour: 20, minute: 10, sender: '10001', content: '收到，这次真不敢晚了。' },
    { daysAgo: 1, hour: 9, minute: 6, sender: '10002', content: '班长刚在群里发了补交名单，你不在里面，稳了。' },
  ],
  '10003': [
    { daysAgo: 23, hour: 21, minute: 5, sender: '10003', content: '数据库这章你整理了吗？我总觉得事务隔离那块还乱。' },
    { daysAgo: 23, hour: 21, minute: 11, sender: '10001', content: '我记了个脑图，等会发你，你先看可重复读和幻读那张。' },
    { daysAgo: 23, hour: 21, minute: 14, sender: '10003', content: '太好了，我今天一直在这两个概念里打转。' },
    { daysAgo: 8, hour: 14, minute: 28, sender: '10001', content: '下午图书馆老位置？我带电脑过去顺便把作业改完。' },
    { daysAgo: 8, hour: 14, minute: 35, sender: '10003', content: '可以，我已经占到插座旁边了。' },
    { daysAgo: 2, hour: 22, minute: 9, sender: '10003', content: '你上次说的那道题我终于懂了，原来卡在边界条件。' },
  ],
  '10005': [
    { daysAgo: 14, hour: 10, minute: 2, sender: '10005', content: '登录接口我刚补了一个字段，前端那边记得把返回值更新一下。' },
    { daysAgo: 14, hour: 10, minute: 8, sender: '10001', content: '看到了，我先把类型改掉，等会重新走一遍登录。' },
    { daysAgo: 14, hour: 10, minute: 11, sender: '10005', content: '行，有问题直接戳我。' },
    { daysAgo: 4, hour: 19, minute: 42, sender: '10001', content: '聊天列表最后一条消息显示有点怪，我怀疑是群和用户 id 撞了。' },
    { daysAgo: 4, hour: 19, minute: 49, sender: '10005', content: '那大概率是目标映射没分开查，群聊别直接混在 users 里找。' },
    { daysAgo: 4, hour: 19, minute: 55, sender: '10001', content: '对，我刚改完，已经正常了。' },
  ],
  '10006': [
    { daysAgo: 12, hour: 18, minute: 24, sender: '10006', content: '周六要不要去江边走走？最近落日挺好看的。' },
    { daysAgo: 12, hour: 18, minute: 31, sender: '10001', content: '可以啊，要是天气好我顺便把相机带上。' },
    { daysAgo: 12, hour: 18, minute: 36, sender: '10006', content: '那我负责找喝的，拍完去买奶茶。' },
    { daysAgo: 3, hour: 23, minute: 3, sender: '10006', content: '上次那几张侧脸抓拍还挺自然的，我已经设成朋友圈封面了。' },
    { daysAgo: 3, hour: 23, minute: 10, sender: '10001', content: '哈哈你满意就行，我明天把原图打包发你。' },
  ],
  '10009': [
    { daysAgo: 16, hour: 9, minute: 40, sender: '10001', content: '帮我找一下前端群里谁提过“登录按钮没反应”。' },
    { daysAgo: 16, hour: 9, minute: 41, sender: '10009', content: '查到了，赵敏前天下午提过一次，还带了复现步骤。' },
    { daysAgo: 16, hour: 9, minute: 43, sender: '10001', content: '把那段原话整理一下发我。' },
    { daysAgo: 16, hour: 9, minute: 44, sender: '10009', content: '已整理：进入聊天页后首次点击发送无响应，刷新后恢复正常。' },
    { daysAgo: 7, hour: 13, minute: 16, sender: '10001', content: '帮我润色一段请假说明，语气别太硬。' },
    { daysAgo: 7, hour: 13, minute: 17, sender: '10009', content: '可以，发我原文，我给你改成礼貌一点的版本。' },
    { daysAgo: 1, hour: 22, minute: 5, sender: '10001', content: '想发条空间，但别太矫情，偏轻松一点。' },
    { daysAgo: 1, hour: 22, minute: 6, sender: '10009', content: '那可以走“忙完一阵子终于喘口气”的口吻，要不要我给你写三版？' },
  ],
  '10010': [
    { daysAgo: 11, hour: 15, minute: 7, sender: '10010', content: '测试环境今天别重启，我这边还在录回归视频。' },
    { daysAgo: 11, hour: 15, minute: 12, sender: '10001', content: '收到，我晚点再推那版。' },
    { daysAgo: 5, hour: 17, minute: 50, sender: '10010', content: '你修的那个会话列表问题我已经验过，群名显示正常了。' },
    { daysAgo: 5, hour: 17, minute: 56, sender: '10001', content: '好，那我今晚把剩下的假数据也收拾一下。' },
    { daysAgo: 5, hour: 18, minute: 2, sender: '10010', content: '支持，之前那批文案一看就不像真人。' },
  ],
};

const GROUP_CHAT_THREADS: Record<string, MessageDraft[]> = {
  '计算机2103班群': [
    { daysAgo: 9, hour: 19, minute: 2, sender: '10002', content: '@全体成员 明天晚上的班会改到 7:30，在老教室。' },
    { daysAgo: 9, hour: 19, minute: 5, sender: '10001', content: '收到。' },
    { daysAgo: 9, hour: 19, minute: 8, sender: '10006', content: '那实验课结束应该赶得上。' },
    { daysAgo: 2, hour: 8, minute: 17, sender: '10005', content: '实验报告纸质版今天下课前交，不收电子版。' },
    { daysAgo: 2, hour: 8, minute: 23, sender: '10003', content: '封面还是用上周那个模板吗？' },
    { daysAgo: 2, hour: 8, minute: 25, sender: '10005', content: '对，姓名和学号别漏。' },
  ],
  '前端开发交流群': [
    { daysAgo: 6, hour: 11, minute: 14, sender: '10001', content: '聊天列表里群会话名称串了，像是把群 id 当用户 id 查了。' },
    { daysAgo: 6, hour: 11, minute: 17, sender: '10005', content: '那就把私聊和群聊分开映射，别共用一份 targets。' },
    { daysAgo: 6, hour: 11, minute: 21, sender: '10010', content: '我这边能稳定复现，修完叫我回归。' },
    { daysAgo: 6, hour: 11, minute: 28, sender: '10009', content: '顺手把真实一点的 seed 也补上吧，不然联调时很出戏。' },
    { daysAgo: 1, hour: 16, minute: 40, sender: '10001', content: '本地库已经接上了，接下来准备把那批机械消息删掉。' },
    { daysAgo: 1, hour: 16, minute: 47, sender: '10010', content: '好，保留几个真实场景就够，不用再堆几千条。' },
    { daysAgo: 1, hour: 16, minute: 53, sender: '10005', content: '是，能看出上下文比数量更重要。' },
  ],
  '周末出游搭子群': [
    { daysAgo: 15, hour: 20, minute: 12, sender: '10006', content: '周六下午去江边还是植物园？我都可以。' },
    { daysAgo: 15, hour: 20, minute: 18, sender: '10002', content: '江边吧，来回轻松点。' },
    { daysAgo: 15, hour: 20, minute: 21, sender: '10001', content: '那就江边，三点地铁口集合。' },
    { daysAgo: 15, hour: 20, minute: 26, sender: '10010', content: '我负责带纸巾和驱蚊。' },
    { daysAgo: 1, hour: 10, minute: 9, sender: '10006', content: '这周降温了，要不改成去新开的咖啡店坐坐？' },
    { daysAgo: 1, hour: 10, minute: 13, sender: '10001', content: '也行，室内更省心。' },
  ],
};

const MOMENT_DRAFTS: MomentDraft[] = [
  {
    user: '10001',
    daysAgo: 10,
    hour: 22,
    minute: 14,
    content: '今天终于把本地联调链路跑顺了，看到数据正常出来那一刻是真的松了口气。',
    comments: [
      { user: '10005', content: '这句“松了口气”太真实了。', offsetDays: 0, offsetHours: 1 },
      { user: '10010', content: '等你把假消息也一起清掉。', offsetDays: 1, offsetHours: 10 },
    ],
    likes: ['10003', '10005', '10010'],
  },
  {
    user: '10006',
    daysAgo: 8,
    hour: 18,
    minute: 36,
    content: '傍晚的风还挺舒服，江边随手拍的这张颜色很好看。',
    images: ['https://picsum.photos/seed/real-moment-1/400/300'],
    comments: [
      { user: '10001', content: '这张构图真不错。', offsetDays: 0, offsetHours: 2 }],
    likes: ['10001', '10002'],
  },
  {
    user: '10003',
    daysAgo: 6,
    hour: 23,
    minute: 8,
    content: '把数据库那章终于顺完了，明天再过一遍索引，今晚先睡。',
    comments: [
      { user: '10001', content: '你这进度已经很可以了。', offsetDays: 0, offsetHours: 8 }],
    likes: ['10001', '10005'],
  },
  {
    user: '10002',
    daysAgo: 4,
    hour: 12,
    minute: 20,
    content: '食堂今天的糖醋里脊 surprisingly 能打，下次可以放心点。',
    likes: ['10001', '10006', '10010'],
  },
  {
    user: '10009',
    daysAgo: 3,
    hour: 21,
    minute: 2,
    content: '提醒：周末想发空间又没思路的人，可以先写事实，再补一句心情。',
    comments: [
      { user: '10001', content: '你这条像在内涵我。', offsetDays: 0, offsetHours: 1 }],
    likes: ['10001'],
  },
  {
    user: '10010',
    daysAgo: 1,
    hour: 19,
    minute: 48,
    content: '今天的回归终于没再冒红，测试同学下班前看到全绿真的会心情变好。',
    likes: ['10001', '10005'],
  },
];

function getConnectionString() {
  return process.env.LOCAL_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54322/app';
}

function timestampFromOffset(daysAgo: number, hour: number, minute: number, extraDays = 0, extraHours = 0) {
  const date = new Date();
  date.setHours(hour + extraHours, minute, 0, 0);
  date.setTime(date.getTime() - (daysAgo - extraDays) * DAY);
  return date.toISOString();
}

function messageTimestamp(draft: MessageDraft) {
  return timestampFromOffset(draft.daysAgo, draft.hour, draft.minute);
}

function momentTimestamp(draft: MomentDraft) {
  return timestampFromOffset(draft.daysAgo, draft.hour, draft.minute);
}

function getUserByQq(users: UserRecord[], qqNumber: string) {
  const user = users.find((item) => item.qq_number === qqNumber);
  if (!user) {
    throw new Error(`用户不存在: ${qqNumber}`);
  }
  return user;
}

function buildPrivateMessages(conversationId: number, users: UserRecord[], friendQqNumber: string) {
  const drafts = PRIVATE_CHAT_THREADS[friendQqNumber] || [];
  return drafts.map<InsertableMessage>((draft) => ({
    conversation_id: conversationId,
    sender_id: getUserByQq(users, draft.sender).id,
    type: draft.type || 'text',
    content: draft.content,
    metadata: draft.metadata || {},
    created_at: messageTimestamp(draft),
  }));
}

function buildGroupMessages(conversationId: number, users: UserRecord[], groupName: string) {
  const drafts = GROUP_CHAT_THREADS[groupName] || [];
  return drafts.map<InsertableMessage>((draft) => ({
    conversation_id: conversationId,
    sender_id: getUserByQq(users, draft.sender).id,
    type: draft.type || 'text',
    content: draft.content,
    metadata: draft.metadata || {},
    created_at: messageTimestamp(draft),
  }));
}

async function resetDatabase(client: Client) {
  await client.query(`
    TRUNCATE TABLE
      moment_likes,
      moment_comments,
      moments,
      messages,
      conversations,
      group_role_mappings,
      group_members,
      groups,
      friends,
      user_settings,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function insertUsers(client: Client) {
  const passwordHash = await bcrypt.hash('123456', 12);
  const profiles = [
    { qq_number: '10001', nickname: 'DemoUser', avatar_color: '#3b82f6', signature: '最近在收拾本地调试数据', status: 'online' as const },
    ...FRIEND_PROFILES,
  ];

  const inserted: UserRecord[] = [];
  for (const profile of profiles) {
    const { rows } = await client.query<UserRecord>(
      `INSERT INTO users (qq_number, nickname, password, avatar_color, signature, status, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, qq_number, nickname, avatar_color, signature, status`,
      [profile.qq_number, profile.nickname, passwordHash, profile.avatar_color, profile.signature, profile.status]
    );
    inserted.push(rows[0]);
  }

  return inserted;
}

async function insertFriendships(client: Client, users: UserRecord[]) {
  const demoUser = users.find((user) => user.qq_number === '10001');
  if (!demoUser) throw new Error('DemoUser 不存在');

  const friends = users.filter((user) => user.id !== demoUser.id);
  for (const friend of friends) {
    await client.query(
      'INSERT INTO friends (user_id, friend_id, remark, created_at) VALUES ($1, $2, $3, $4)',
      [demoUser.id, friend.id, '', new Date(Date.now() - 45 * DAY)]
    );
    await client.query(
      'INSERT INTO friends (user_id, friend_id, remark, created_at) VALUES ($1, $2, $3, $4)',
      [friend.id, demoUser.id, '', new Date(Date.now() - 45 * DAY)]
    );
  }

  return { demoUser, friends };
}

async function insertGroups(client: Client) {
  const groups: GroupRecord[] = [];
  for (const blueprint of GROUP_BLUEPRINTS) {
    const { rows } = await client.query<GroupRecord>(
      `INSERT INTO groups (name, avatar_color, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, avatar_color, description`,
      [blueprint.name, blueprint.avatar_color, blueprint.description]
    );
    groups.push(rows[0]);
  }
  return groups;
}

async function insertMemberships(client: Client, users: UserRecord[], groups: GroupRecord[]) {
  for (const blueprint of GROUP_BLUEPRINTS) {
    const group = groups.find((item) => item.name === blueprint.name);
    if (!group) continue;

    for (const membership of blueprint.memberships) {
      const user = users.find((item) => item.qq_number === membership.qq_number);
      if (!user) continue;

      await client.query(
        'INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)',
        [group.id, user.id, membership.role, new Date(Date.now() - 30 * DAY)]
      );

      if (membership.role !== '普通成员') {
        await client.query(
          'INSERT INTO group_role_mappings (user_id, group_id, role_type, role_name, created_at) VALUES ($1, $2, $3, $4, $5)',
          [user.id, group.id, membership.role, membership.role, new Date(Date.now() - 28 * DAY)]
        );
      }
    }
  }
}

async function createConversation(client: Client, type: 'private' | 'group', userId: number, targetId: number, createdAt: string) {
  const { rows } = await client.query<ConversationRecord>(
    `INSERT INTO conversations (type, user_id, target_id, last_message, unread_count, created_at)
     VALUES ($1, $2, $3, '', 0, $4)
     RETURNING id, type, user_id, target_id`,
    [type, userId, targetId, createdAt]
  );
  return rows[0];
}

async function insertConversations(client: Client, users: UserRecord[], groups: GroupRecord[]) {
  const demoUser = users.find((user) => user.qq_number === '10001');
  if (!demoUser) throw new Error('DemoUser 不存在');

  const privateConversations: ConversationRecord[] = [];
  const groupConversations: ConversationRecord[] = [];

  for (const friend of users.filter((user) => user.id !== demoUser.id)) {
    const drafts = PRIVATE_CHAT_THREADS[friend.qq_number] || [];
    const firstDraft = drafts[0];
    privateConversations.push(
      await createConversation(
        client,
        'private',
        demoUser.id,
        friend.id,
        firstDraft ? messageTimestamp(firstDraft) : new Date().toISOString()
      )
    );
  }

  for (const group of groups) {
    const drafts = GROUP_CHAT_THREADS[group.name] || [];
    const firstDraft = drafts[0];
    groupConversations.push(
      await createConversation(
        client,
        'group',
        demoUser.id,
        group.id,
        firstDraft ? messageTimestamp(firstDraft) : new Date().toISOString()
      )
    );
  }

  return { demoUser, privateConversations, groupConversations };
}

async function insertMessages(client: Client, users: UserRecord[], privateConversations: ConversationRecord[], groupConversations: ConversationRecord[]) {
  for (const conversation of privateConversations) {
    const friend = users.find((user) => user.id === conversation.target_id);
    if (!friend) continue;

    const messages = buildPrivateMessages(conversation.id, users, friend.qq_number);
    for (const message of messages) {
      await client.query(
        'INSERT INTO messages (conversation_id, sender_id, type, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
        [message.conversation_id, message.sender_id, message.type, message.content, JSON.stringify(message.metadata), message.created_at]
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      await client.query(
        'UPDATE conversations SET last_message = $1, last_message_time = $2 WHERE id = $3',
        [lastMessage.content.slice(0, 50), lastMessage.created_at, conversation.id]
      );
    }
  }

  for (const conversation of groupConversations) {
    const group = GROUP_BLUEPRINTS.find((item) => item.name === GROUP_BLUEPRINTS[groupConversations.findIndex((conv) => conv.id === conversation.id)]?.name);
    const groupName = group?.name;
    if (!groupName) continue;

    const messages = buildGroupMessages(conversation.id, users, groupName);
    for (const message of messages) {
      await client.query(
        'INSERT INTO messages (conversation_id, sender_id, type, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
        [message.conversation_id, message.sender_id, message.type, message.content, JSON.stringify(message.metadata), message.created_at]
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      await client.query(
        'UPDATE conversations SET last_message = $1, last_message_time = $2 WHERE id = $3',
        [lastMessage.content.slice(0, 50), lastMessage.created_at, conversation.id]
      );
    }
  }
}

async function insertMoments(client: Client, users: UserRecord[]) {
  for (const draft of MOMENT_DRAFTS) {
    const user = getUserByQq(users, draft.user);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO moments (user_id, content, images, like_count, comment_count, created_at)
       VALUES ($1, $2, $3::jsonb, 0, 0, $4)
       RETURNING id`,
      [user.id, draft.content, JSON.stringify(draft.images || []), momentTimestamp(draft)]
    );

    const momentId = rows[0].id;
    let likeCount = 0;
    let commentCount = 0;

    for (const comment of draft.comments || []) {
      const commenter = getUserByQq(users, comment.user);
      await client.query(
        'INSERT INTO moment_comments (moment_id, user_id, content, created_at) VALUES ($1, $2, $3, $4)',
        [
          momentId,
          commenter.id,
          comment.content,
          timestampFromOffset(draft.daysAgo, draft.hour, draft.minute, comment.offsetDays || 0, comment.offsetHours || 0),
        ]
      );
      commentCount += 1;
    }

    for (const likerQq of draft.likes || []) {
      const liker = getUserByQq(users, likerQq);
      await client.query(
        'INSERT INTO moment_likes (moment_id, user_id, created_at) VALUES ($1, $2, $3)',
        [momentId, liker.id, timestampFromOffset(draft.daysAgo, draft.hour, draft.minute, 0, 2)]
      );
      likeCount += 1;
    }

    await client.query('UPDATE moments SET comment_count = $1, like_count = $2 WHERE id = $3', [commentCount, likeCount, momentId]);
  }
}

async function insertSettings(client: Client, demoUser: UserRecord) {
  const settings = [
    { key: 'bot_name', value: '小Q管家' },
    { key: 'bot_remark', value: '智能助手' },
    { key: 'bot_memory', value: '# MEMORY.md\n\n- 用户偏好：聊天记录看起来自然一点，比堆数量更重要。' },
  ];

  for (const setting of settings) {
    await client.query(
      'INSERT INTO user_settings (user_id, key, value, updated_at) VALUES ($1, $2, $3, NOW())',
      [demoUser.id, setting.key, setting.value]
    );
  }
}

async function executeLocalSeed() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  try {
    await client.query('BEGIN');
    await resetDatabase(client);
    const users = await insertUsers(client);
    const { demoUser } = await insertFriendships(client, users);
    const groups = await insertGroups(client);
    await insertMemberships(client, users, groups);
    const { privateConversations, groupConversations } = await insertConversations(client, users, groups);
    await insertMessages(client, users, privateConversations, groupConversations);
    await insertMoments(client, users);
    await insertSettings(client, demoUser);
    await client.query('COMMIT');

    return {
      users: users.length,
      privateConversations: privateConversations.length,
      groupConversations: groupConversations.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const result = await executeLocalSeed();
  console.log(`Seed completed: ${result.users} users, ${result.privateConversations} private conversations, ${result.groupConversations} group conversations.`);
}

const entryPath = process.argv[1];
const currentPath = fileURLToPath(import.meta.url);

if (entryPath && currentPath === entryPath) {
  main().catch((error) => {
    console.error('Local seed failed:', error);
    process.exit(1);
  });
}

export { executeLocalSeed };
