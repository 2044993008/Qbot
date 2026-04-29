import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

async function saveUserSetting(userId: number, key: string, value: string) {
  const client = getSupabaseClient();

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
    const { data, error } = await client
      .from('user_settings')
      .update({ value, updated_at: updatedAt })
      .eq('id', existingId)
      .select()
      .single();

    if (error) {
      throw new Error(`更新设置失败: ${error.message}`);
    }

    return data;
  }

  const { data, error } = await client
    .from('user_settings')
    .insert({ user_id: userId, key, value, updated_at: updatedAt })
    .select()
    .single();

  if (error) {
    throw new Error(`创建设置失败: ${error.message}`);
  }

  return data;
}


// GET - 获取用户设置
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    const client = getSupabaseClient();
    
    if (key) {
      const { data } = await client
        .from('user_settings')
        .select('key, value')
        .eq('user_id', payload.userId)
        .eq('key', key)
        .maybeSingle();

      return NextResponse.json({ 
        key, 
        value: data?.value || '' 
      });
    } else {
      const { data } = await client
        .from('user_settings')
        .select('key, value')
        .eq('user_id', payload.userId);

      return NextResponse.json({ 
        settings: data || [] 
      });
    }
  } catch (err) {
    console.error('获取设置错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT - 更新用户设置
export async function PUT(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const { key, value } = await request.json();
    
    if (!key) {
      return NextResponse.json({ error: '缺少设置键' }, { status: 400 });
    }

    const data = await saveUserSetting(payload.userId, key, value || '');

    return NextResponse.json({ success: true, setting: data });
  } catch (err) {
    console.error('更新设置错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
