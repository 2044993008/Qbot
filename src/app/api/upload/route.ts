import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getSupabaseClient as getStorageClient } from '@/storage/database/supabase-client';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';


// POST - 上传图片
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 上传限流：10次/分钟/用户
    const limit = await checkUserRateLimit(payload.userId, { maxRequests: 10, windowMs: 60 * 1000, keyPrefix: 'upload' });
    if (!limit.allowed) {
      return NextResponse.json({ error: '上传过于频繁，请稍后再试' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '没有文件' }, { status: 400 });
    }

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支持的图片格式' }, { status: 400 });
    }

    // 检查文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 });
    }

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${payload.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // 转换为 ArrayBuffer
    const buffer = await file.arrayBuffer();
    const arrayBuffer = new Uint8Array(buffer);

    // 使用 Supabase Storage 上传
    const storageClient = getStorageClient();
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from('images')
      .upload(filename, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase 上传失败:', uploadError.message);
      return NextResponse.json({ error: '图片上传失败，请重试' }, { status: 500 });
    }

    // 获取公开 URL
    const { data: urlData } = await storageClient.storage
      .from('images')
      .getPublicUrl(filename);

    return NextResponse.json({
      url: urlData.publicUrl,
      filename,
    });
  } catch (err) {
    console.error('上传图片错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
