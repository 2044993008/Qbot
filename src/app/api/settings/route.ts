import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';


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

    const { key, value } = await request.json();
    
    if (!key) {
      return NextResponse.json({ error: '缺少设置键' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('user_settings')
      .upsert({
        user_id: payload.userId,
        key,
        value: value || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' })
      .select()
      .single();

    if (error) throw new Error(`更新设置失败: ${error.message}`);

    return NextResponse.json({ success: true, setting: data });
  } catch (err) {
    console.error('更新设置错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
