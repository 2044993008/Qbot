import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST - 预置种子数据
export async function POST() {
  try {
    const client = getSupabaseClient();

    // 检查是否已有数据
    const { data: existingUsers } = await client.from('users').select('id').limit(1);
    
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: '数据已存在，无需重复预置' 
      });
    }

    console.log('开始预置数据...');

    const defaultPasswordHash = await bcrypt.hash('123456', 12);

    // 1. 创建预设用户
    const userData = [
      { qq_number: '10001', nickname: 'DemoUser', password: defaultPasswordHash, avatar_color: '#3b82f6', signature: '这是测试账号', status: 'online' },
      { qq_number: '10002', nickname: '张小明', password: defaultPasswordHash, avatar_color: '#ef4444', signature: '今天也要加油鸭！', status: 'online' },
      { qq_number: '10003', nickname: '李华', password: defaultPasswordHash, avatar_color: '#22c55e', signature: '学习使我快乐', status: 'offline' },
      { qq_number: '10004', nickname: '王小红', password: defaultPasswordHash, avatar_color: '#f59e0b', signature: '摸鱼中...', status: 'busy' },
      { qq_number: '10005', nickname: '陈伟', password: defaultPasswordHash, avatar_color: '#8b5cf6', signature: '代码改变世界', status: 'online' },
      { qq_number: '10006', nickname: '刘芳', password: defaultPasswordHash, avatar_color: '#ec4899', signature: '追星女孩永不认输', status: 'online' },
      { qq_number: '10007', nickname: '周杰伦', password: defaultPasswordHash, avatar_color: '#06b6d4', signature: '听妈妈的话', status: 'offline' },
      { qq_number: '10008', nickname: '杨幂', password: defaultPasswordHash, avatar_color: '#f97316', signature: '幂幂最可爱', status: 'online' },
      { qq_number: '10009', nickname: '小 Q 管家', password: defaultPasswordHash, avatar_color: '#6366f1', signature: '我是你的智能助手', status: 'online' },
    ];

    const { data: insertedUsers, error: usersError } = await client
      .from('users')
      .insert(userData)
      .select('id, qq_number, nickname');

    if (usersError) throw new Error(`插入用户失败: ${usersError.message}`);
    console.log('用户创建成功:', insertedUsers?.length);

    const usersArray = insertedUsers ?? [];
    const demoUser = usersArray.find(u => u.qq_number === '10001');
    if (!demoUser) throw new Error('创建 DemoUser 失败');
    
    const friendUsers = usersArray.filter(u => u.qq_number !== '10001');
    const botUser = friendUsers.find(u => u.nickname === '小 Q 管家');

    // 2. 创建好友关系
    const friendData = [
      ...friendUsers.filter(u => u.nickname !== '小 Q 管家').map(friend => ({
        user_id: demoUser.id,
        friend_id: friend.id,
        remark: ''
      })),
      ...(botUser ? [{ user_id: demoUser.id, friend_id: botUser.id, remark: '' }] : [])
    ];

    const { error: friendsError } = await client.from('friends').insert(friendData);
    if (friendsError) throw new Error(`插入好友关系失败: ${friendsError.message}`);
    console.log('好友关系创建成功');

    // 3. 创建群组
    const groupData = [
      { name: '计算机2103班群', avatar_color: '#10b981', description: '计算机2103班官方群' },
      { name: '前端开发交流群', avatar_color: '#3b82f6', description: '前端技术交流' },
      { name: '摸鱼一家人', avatar_color: '#f59e0b', description: '摸鱼群，欢迎加入' },
    ];

    const { data: insertedGroups, error: groupsError } = await client
      .from('groups')
      .insert(groupData)
      .select('id, name');

    if (groupsError) throw new Error(`插入群组失败: ${groupsError.message}`);
    console.log('群组创建成功:', insertedGroups?.length);

    const groupsArray = insertedGroups ?? [];
    const classGroup = groupsArray.find(g => g.name === '计算机2103班群');
    const frontendGroup = groupsArray.find(g => g.name === '前端开发交流群');
    const fishGroup = groupsArray.find(g => g.name === '摸鱼一家人');
    
    if (!classGroup || !frontendGroup || !fishGroup) {
      throw new Error('创建群组失败');
    }

    // 4. 创建群成员
    const groupMembersData = [
      // 班群
      { group_id: classGroup.id, user_id: demoUser.id, role: '普通成员' },
      { group_id: classGroup.id, user_id: friendUsers[0].id, role: '班长' },
      { group_id: classGroup.id, user_id: friendUsers[1].id, role: '学习委员' },
      { group_id: classGroup.id, user_id: friendUsers[2].id, role: '老师' },
      { group_id: classGroup.id, user_id: friendUsers[3].id, role: '活跃' },
      { group_id: classGroup.id, user_id: friendUsers[4].id, role: '普通成员' },
      { group_id: classGroup.id, user_id: friendUsers[5].id, role: '普通成员' },
      { group_id: classGroup.id, user_id: friendUsers[6].id, role: '普通成员' },
      { group_id: classGroup.id, user_id: friendUsers[7].id, role: '活跃' },
      // 前端群
      { group_id: frontendGroup.id, user_id: demoUser.id, role: '群主' },
      { group_id: frontendGroup.id, user_id: friendUsers[4].id, role: '前端大佬' },
      { group_id: frontendGroup.id, user_id: friendUsers[0].id, role: 'Vue党' },
      { group_id: frontendGroup.id, user_id: friendUsers[1].id, role: 'React党' },
      { group_id: frontendGroup.id, user_id: friendUsers[2].id, role: '新手入门' },
      // 摸鱼群
      { group_id: fishGroup.id, user_id: demoUser.id, role: '摸鱼王' },
      { group_id: fishGroup.id, user_id: friendUsers[3].id, role: '摸鱼达人' },
      { group_id: fishGroup.id, user_id: friendUsers[5].id, role: '摸鱼爱好者' },
      { group_id: fishGroup.id, user_id: friendUsers[6].id, role: '摸鱼新手' },
    ];

    const { error: membersError } = await client.from('group_members').insert(groupMembersData);
    if (membersError) throw new Error(`插入群成员失败: ${membersError.message}`);
    console.log('群成员创建成功');

    // 5. 创建会话
    const conversationsData = [
      { type: 'private', user_id: demoUser.id, target_id: friendUsers[0].id },
      { type: 'private', user_id: demoUser.id, target_id: friendUsers[1].id },
      { type: 'private', user_id: demoUser.id, target_id: friendUsers[2].id },
      { type: 'private', user_id: demoUser.id, target_id: friendUsers[3].id },
      { type: 'private', user_id: demoUser.id, target_id: botUser?.id || 0 },
      { type: 'group', user_id: demoUser.id, target_id: classGroup.id },
      { type: 'group', user_id: demoUser.id, target_id: frontendGroup.id },
      { type: 'group', user_id: demoUser.id, target_id: fishGroup.id },
    ].filter(c => c.target_id !== 0);

    const { data: insertedConversations, error: convError } = await client
      .from('conversations')
      .insert(conversationsData)
      .select('id, type, target_id');

    if (convError) throw new Error(`插入会话失败: ${convError.message}`);
    console.log('会话创建成功:', insertedConversations?.length);

    const conversationsArray = insertedConversations ?? [];
    const classConversation = conversationsArray.find(c => c.type === 'group' && c.target_id === classGroup.id);
    const frontendConversation = conversationsArray.find(c => c.type === 'group' && c.target_id === frontendGroup.id);
    const fishConversation = conversationsArray.find(c => c.type === 'group' && c.target_id === fishGroup.id);

    if (!classConversation || !frontendConversation || !fishConversation) {
      throw new Error('创建会话失败');
    }

    // 6. 创建历史消息（班群至少30条）
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    const classMessages = [
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '同学们注意了！明天有网课！', created_at: new Date(lastMonth.getTime() - 86400000 * 3).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '关于网课的具体安排如下...', created_at: new Date(lastMonth.getTime() - 86400000 * 2).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[1].id, type: 'text', content: '收到班长！', created_at: new Date(lastMonth.getTime() - 86400000 * 2 + 3600000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[2].id, type: 'text', content: '网课期间请大家认真听讲', created_at: new Date(lastMonth.getTime() - 86400000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '@全体成员 明天网课链接已发，请查收！', created_at: new Date(lastMonth.getTime()).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '网课平台：腾讯会议', created_at: new Date(lastMonth.getTime() + 3600000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[1].id, type: 'text', content: '作业截止时间是这周五，大家记得按时提交', created_at: new Date(lastMonth.getTime() + 86400000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[3].id, type: 'text', content: '收到！', created_at: new Date(lastMonth.getTime() + 86400000 + 1800000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[4].id, type: 'text', content: '请问作业格式有什么要求吗？', created_at: new Date(lastMonth.getTime() + 86400000 * 2).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[1].id, type: 'text', content: '作业要求：Word格式，不少于2000字', created_at: new Date(lastMonth.getTime() + 86400000 * 2 + 3600000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[5].id, type: 'text', content: '考试时间定了吗？', created_at: new Date(lastMonth.getTime() + 86400000 * 3).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '考试安排在下下周一', created_at: new Date(lastMonth.getTime() + 86400000 * 3 + 1800000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[2].id, type: 'text', content: '大家抓紧复习，有问题随时问我', created_at: new Date(lastMonth.getTime() + 86400000 * 4).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[6].id, type: 'text', content: '老师，请问有复习资料吗？', created_at: new Date(lastMonth.getTime() + 86400000 * 4 + 3600000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[2].id, type: 'text', content: '复习资料已上传到学习通', created_at: new Date(lastMonth.getTime() + 86400000 * 4 + 7200000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[7].id, type: 'text', content: '收到谢谢老师！', created_at: new Date(lastMonth.getTime() + 86400000 * 5).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '班级活动定在这周六', created_at: new Date(lastMonth.getTime() + 86400000 * 6).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[3].id, type: 'text', content: '期待！', created_at: new Date(lastMonth.getTime() + 86400000 * 6 + 1800000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[4].id, type: 'text', content: '谁要一起去图书馆？', created_at: new Date(lastMonth.getTime() + 86400000 * 7).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[1].id, type: 'text', content: '我去！', created_at: new Date(lastMonth.getTime() + 86400000 * 7 + 1800000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[5].id, type: 'text', content: '加我一个', created_at: new Date(lastMonth.getTime() + 86400000 * 7 + 3600000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '网课摸鱼技巧分享', created_at: new Date(lastMonth.getTime() + 86400000 * 8).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[3].id, type: 'text', content: '哈哈哈太真实了', created_at: new Date(lastMonth.getTime() + 86400000 * 8 + 1800000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[4].id, type: 'text', content: '网课期间如何优雅地摸鱼', created_at: new Date(lastMonth.getTime() + 86400000 * 9).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[6].id, type: 'text', content: '多窗口切换法了解一下', created_at: new Date(lastMonth.getTime() + 86400000 * 9 + 3600000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[7].id, type: 'text', content: '考试加油！大家', created_at: new Date(lastMonth.getTime() + 86400000 * 10).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[0].id, type: 'text', content: '明天作业最后截止日期！', created_at: new Date(lastMonth.getTime() + 86400000 * 11).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[1].id, type: 'text', content: '还没交的赶紧交了！', created_at: new Date(lastMonth.getTime() + 86400000 * 11 + 1800000).toISOString() },
      { conversation_id: classConversation.id, sender_id: friendUsers[2].id, type: 'text', content: '大家辛苦了，好好复习', created_at: new Date(lastMonth.getTime() + 86400000 * 12).toISOString() },
    ];

    const frontendMessages = [
      { conversation_id: frontendConversation.id, sender_id: friendUsers[4].id, type: 'text', content: 'React 19正式发布了！', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
      { conversation_id: frontendConversation.id, sender_id: demoUser.id, type: 'text', content: '哇，期待已久', created_at: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString() },
      { conversation_id: frontendConversation.id, sender_id: friendUsers[0].id, type: 'text', content: 'Vue党表示不慌', created_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString() },
      { conversation_id: frontendConversation.id, sender_id: friendUsers[1].id, type: 'text', content: 'React yyds', created_at: new Date(Date.now() - 86400000 * 2 + 5400000).toISOString() },
      { conversation_id: frontendConversation.id, sender_id: friendUsers[2].id, type: 'text', content: '前端入门中，请问该学哪个框架？', created_at: new Date(Date.now() - 86400000).toISOString() },
      { conversation_id: frontendConversation.id, sender_id: friendUsers[4].id, type: 'text', content: '建议先学React打好基础', created_at: new Date(Date.now() - 86400000 + 1800000).toISOString() },
    ];

    const fishMessages = [
      { conversation_id: fishConversation.id, sender_id: friendUsers[3].id, type: 'text', content: '摸鱼时间到！', created_at: new Date(Date.now() - 3600000).toISOString() },
      { conversation_id: fishConversation.id, sender_id: friendUsers[5].id, type: 'text', content: '一起摸鱼', created_at: new Date(Date.now() - 1800000).toISOString() },
    ];

    const allMessages = [...classMessages, ...frontendMessages, ...fishMessages];
    const { error: messagesError } = await client.from('messages').insert(allMessages);
    if (messagesError) throw new Error(`插入消息失败: ${messagesError.message}`);
    console.log('消息创建成功:', allMessages.length);

    // 7. 创建空间动态
    const momentsData = [
      { user_id: demoUser.id, content: '今天天气真好，出门散个步！', images: ['https://picsum.photos/400/300?random=1'] },
      { user_id: friendUsers[0].id, content: '新买的小熊饼干到了，开森！', images: ['https://picsum.photos/400/300?random=2', 'https://picsum.photos/400/300?random=3'] },
      { user_id: friendUsers[1].id, content: '图书馆学习日常，坚持打卡第三天', images: ['https://picsum.photos/400/300?random=4'] },
      { user_id: friendUsers[3].id, content: '摸鱼心得：工作是为了更好的生活', images: [] },
      { user_id: friendUsers[4].id, content: '写代码写到深夜，只有咖啡陪伴', images: ['https://picsum.photos/400/300?random=5'] },
      { user_id: friendUsers[5].id, content: '追星女孩的日常，今天的爱豆依旧帅气！', images: ['https://picsum.photos/400/300?random=6', 'https://picsum.photos/400/300?random=7', 'https://picsum.photos/400/300?random=8'] },
    ];

    const { data: insertedMoments, error: momentsError } = await client
      .from('moments')
      .insert(momentsData)
      .select('id, user_id');

    if (momentsError) throw new Error(`插入动态失败: ${momentsError.message}`);
    console.log('动态创建成功:', insertedMoments?.length);

    // 8. 创建动态评论
    if (insertedMoments && insertedMoments.length > 0) {
      const commentsData = [
        { moment_id: insertedMoments[0].id, user_id: friendUsers[0].id, content: '好羡慕，我也想出去玩' },
        { moment_id: insertedMoments[1].id, user_id: demoUser.id, content: '看起来好好吃' },
        { moment_id: insertedMoments[2].id, user_id: friendUsers[4].id, content: '加油！' },
        { moment_id: insertedMoments[3].id, user_id: demoUser.id, content: '太真实了' },
        { moment_id: insertedMoments[5].id, user_id: friendUsers[6].id, content: '同款追星' },
      ];

      const { error: commentsError } = await client.from('moment_comments').insert(commentsData);
      if (commentsError) throw new Error(`插入评论失败: ${commentsError.message}`);
      console.log('评论创建成功');
    }

    // 9. 创建用户设置
    const settingsData = [
      { user_id: demoUser.id, key: 'bot_name', value: '小 Q 管家' },
      { user_id: demoUser.id, key: 'bot_remark', value: '智能助手' },
    ];

    const { error: settingsError } = await client.from('user_settings').insert(settingsData);
    if (settingsError) throw new Error(`插入设置失败: ${settingsError.message}`);
    console.log('用户设置创建成功');

    console.log('数据预置完成！');

    return NextResponse.json({ 
      success: true, 
      message: '数据预置成功' 
    });
  } catch (err) {
    console.error('预置数据错误:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : '服务器错误' 
    }, { status: 500 });
  }
}
