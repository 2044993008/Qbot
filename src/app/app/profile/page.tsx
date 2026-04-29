'use client';

import { useState, useEffect } from 'react';
import { Sidebar, MobileNav } from '@/components/sidebar';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { userApi } from '@/lib/api';
import { Camera, Save, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    signature: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        signature: user.signature || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await userApi.updateProfile(formData);
      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
  ];

  const handleAvatarColorChange = async (avatarColor: string) => {
    try {
      await userApi.updateProfile({ avatar_color: avatarColor });
      await refreshUser();
    } catch (error) {
      console.error('更新头像颜色失败:', error);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏 */}
      <div className="w-72 border-r bg-white desktop-only">
        <Sidebar />
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f5]">
        {/* 移动端顶部 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b">
          <h1 className="text-lg font-semibold">个人资料</h1>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto space-y-4">
            {/* 头像卡片 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <Avatar
                      name={user?.nickname || 'U'}
                      color={user?.avatar_color}
                      size="xl"
                    />
                    {isEditing && (
                      <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#12b7f5] text-white rounded-full flex items-center justify-center">
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {colors.map((color) => (
                          <button
                            key={color}
                            onClick={() => void handleAvatarColorChange(color)}
                            className="w-10 h-10 rounded-full border-2 transition-transform hover:scale-110"
                            style={{ backgroundColor: color, borderColor: user?.avatar_color === color ? '#12b7f5' : 'transparent' }}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <h2 className="text-xl font-semibold">{user?.nickname}</h2>
                      <p className="text-gray-500 mt-1">QQ {user?.qq_number}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 基本信息卡片 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">基本信息</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={isSaving}
                  >
                    {isEditing ? (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        保存
                      </>
                    ) : (
                      '编辑'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-500">昵称</span>
                  {isEditing ? (
                    <Input
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      className="w-48 text-right"
                    />
                  ) : (
                    <span>{user?.nickname}</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-500">QQ号</span>
                  <span>{user?.qq_number}</span>
                </div>

                <div className="py-2">
                  <div className="text-gray-500 mb-2">个性签名</div>
                  {isEditing ? (
                    <Input
                      value={formData.signature}
                      onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                      placeholder="说点什么吧..."
                    />
                  ) : (
                    <p className="text-gray-700">{user?.signature || '这个人很懒，什么都没写'}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 在线状态卡片 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">在线状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className={`status-indicator status-${user?.status || 'offline'}`} />
                  <span className="capitalize">
                    {user?.status === 'online' ? '在线' : 
                     user?.status === 'busy' ? '忙碌' : '离线'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 登出按钮 */}
            <Button
              variant="outline"
              className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-500"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <MobileNav />
    </div>
  );
}
