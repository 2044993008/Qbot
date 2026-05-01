'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoading } = useAuth();
  const [loginForm, setLoginForm] = useState({ qq_number: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ qq_number: '', nickname: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!loginForm.qq_number || !loginForm.password) {
      setError('请输入QQ号和密码');
      return;
    }

    try {
      await login(loginForm.qq_number, loginForm.password);
      // 登录成功，显示提示并跳转
      setLoginSuccess(true);
      setTimeout(() => {
        router.push('/app');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!registerForm.qq_number || !registerForm.nickname || !registerForm.password) {
      setError('请填写所有必填项');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    try {
      await register(registerForm.qq_number, registerForm.nickname, registerForm.password);
      // 注册成功，强制跳转
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#12b7f5] to-[#0aa8e8] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-4xl font-bold text-[#12b7f5]">Q</span>
          </div>
          <h1 className="text-3xl font-bold text-white">仿 QQ</h1>
          <p className="text-white/80 mt-2">即时通讯，轻松连接</p>
        </div>

        <Card className="shadow-xl">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardHeader>
                  <CardTitle>欢迎回来</CardTitle>
                  <CardDescription>输入您的账号信息登录</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                      {error}
                    </div>
                  )}
                  
                  {loginSuccess && (
                    <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm">
                      登录成功！正在跳转...
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-qq">QQ号</Label>
                    <Input
                      id="login-qq"
                      type="text"
                      placeholder="请输入QQ号"
                      value={loginForm.qq_number}
                      onChange={(e) => setLoginForm({ ...loginForm, qq_number: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">密码</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="请输入密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-[#12b7f5] hover:bg-[#0aa8e8]" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    登录
                  </Button>

                  <div className="text-center text-sm text-gray-500 mt-4">
                    <p>测试账号：QQ号 10001，密码 123456</p>
                  </div>
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister}>
                <CardHeader>
                  <CardTitle>创建账号</CardTitle>
                  <CardDescription>填写信息注册新账号</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reg-qq">QQ号</Label>
                    <Input
                      id="reg-qq"
                      type="text"
                      placeholder="5-12位数字"
                      value={registerForm.qq_number}
                      onChange={(e) => setRegisterForm({ ...registerForm, qq_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-nickname">昵称</Label>
                    <Input
                      id="reg-nickname"
                      type="text"
                      placeholder="输入您的昵称"
                      value={registerForm.nickname}
                      onChange={(e) => setRegisterForm({ ...registerForm, nickname: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">密码</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="至少6位"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">确认密码</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="再次输入密码"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-[#12b7f5] hover:bg-[#0aa8e8]" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    注册
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
