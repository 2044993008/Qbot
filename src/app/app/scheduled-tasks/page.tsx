'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTasks } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Bell,
  MessageSquare,
  ImageIcon,
  CalendarClock,
  Play,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { ScheduledTask } from '@/lib/types';

const taskTypeMeta = {
  reminder: { label: '提醒', icon: Bell, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  send_message: { label: '发消息', icon: MessageSquare, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  post_moment: { label: '发动态', icon: ImageIcon, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function getDefaultConfig(type: ScheduledTask['task_type']) {
  switch (type) {
    case 'reminder':
      return { content: '' };
    case 'send_message':
      return { conversation_id: 0, content: '' };
    case 'post_moment':
      return { content: '' };
    default:
      return {};
  }
}

export default function ScheduledTasksPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { tasks, isLoading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    task_type: 'reminder' as ScheduledTask['task_type'],
    cron_expression: '',
    enabled: true,
  });
  const [configObj, setConfigObj] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchTasks();
    }
  }, [authLoading, isAuthenticated, fetchTasks]);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      task_type: 'reminder',
      cron_expression: '',
      enabled: true,
    });
    setConfigObj(getDefaultConfig('reminder'));
    setEditingTask(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setForm({
      name: task.name,
      description: task.description,
      task_type: task.task_type,
      cron_expression: task.cron_expression,
      enabled: task.enabled,
    });
    setConfigObj(task.config || getDefaultConfig(task.task_type));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (!form.cron_expression.trim()) {
      toast.error('请输入 Cron 表达式');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        config: configObj,
        user_id: user?.id || 0,
      };

      if (editingTask) {
        await updateTask(editingTask.id, payload);
        toast.success('任务更新成功');
      } else {
        await createTask(payload);
        toast.success('任务创建成功');
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (task: ScheduledTask) => {
    try {
      await updateTask(task.id, { enabled: !task.enabled });
      toast.success(task.enabled ? '任务已停用' : '任务已启用');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteTaskId) return;
    try {
      await deleteTask(deleteTaskId);
      toast.success('任务已删除');
      setDeleteTaskId(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '删除失败';
      toast.error(msg);
    }
  };

  const handleTypeChange = (value: string) => {
    const type = value as ScheduledTask['task_type'];
    setForm((prev) => ({ ...prev, task_type: type }));
    setConfigObj(getDefaultConfig(type));
  };

  const renderConfigFields = () => {
    switch (form.task_type) {
      case 'reminder':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium">提醒内容</label>
            <Textarea
              placeholder="请输入提醒内容..."
              value={String(configObj.content || '')}
              onChange={(e) => setConfigObj((prev) => ({ ...prev, content: e.target.value }))}
              className="min-h-[80px] resize-none border-gray-200 focus:border-[#12b7f5]"
            />
          </div>
        );
      case 'send_message':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">会话 ID</label>
              <Input
                type="number"
                placeholder="请输入会话 ID"
                value={String(configObj.conversation_id || '')}
                onChange={(e) =>
                  setConfigObj((prev) => ({ ...prev, conversation_id: parseInt(e.target.value) || 0 }))
                }
                className="border-gray-200 focus:border-[#12b7f5]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">消息内容</label>
              <Textarea
                placeholder="请输入要发送的消息..."
                value={String(configObj.content || '')}
                onChange={(e) => setConfigObj((prev) => ({ ...prev, content: e.target.value }))}
                className="min-h-[80px] resize-none border-gray-200 focus:border-[#12b7f5]"
              />
            </div>
          </div>
        );
      case 'post_moment':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium">动态内容</label>
            <Textarea
              placeholder="请输入要发布的动态内容..."
              value={String(configObj.content || '')}
              onChange={(e) => setConfigObj((prev) => ({ ...prev, content: e.target.value }))}
              className="min-h-[80px] resize-none border-gray-200 focus:border-[#12b7f5]"
            />
          </div>
        );
    }
  };

  const isPageLoading = isLoading || authLoading;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f5]">
      <Toaster />
        {/* 移动端顶部 */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
          <h1 className="text-lg font-semibold">定时任务</h1>
          <Button size="sm" className="bg-[#12b7f5] hover:bg-[#0aa8e8] h-8 px-3" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            新建
          </Button>
        </div>

        {/* 桌面端标题栏 */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#12b7f5]" />
            <h1 className="text-lg font-semibold">定时任务</h1>
            <Badge variant="secondary" className="ml-2">
              {tasks.length}
            </Badge>
          </div>
          <Button className="bg-[#12b7f5] hover:bg-[#0aa8e8]" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            创建任务
          </Button>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
          {isPageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <Skeleton className="h-6 w-10" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Clock className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-1">暂无定时任务</p>
              <p className="text-sm mb-6">创建你的第一个定时任务，让 QQ 管家自动帮你处理事务</p>
              <Button className="bg-[#12b7f5] hover:bg-[#0aa8e8]" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                创建任务
              </Button>
            </div>
          ) : (
            tasks.map((task) => {
              const meta = taskTypeMeta[task.task_type];
              const TypeIcon = meta.icon;

              return (
                <Card
                  key={task.id}
                  className={`overflow-hidden transition-all hover:shadow-md ${
                    !task.enabled ? 'opacity-70' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* 标题行 */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{task.name}</h3>
                          <Badge variant="outline" className={`${meta.color} text-xs px-2 py-0.5`}>
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {meta.label}
                          </Badge>
                          {!task.enabled && (
                            <Badge variant="secondary" className="text-xs">
                              已停用
                            </Badge>
                          )}
                        </div>

                        {/* 描述 */}
                        {task.description && (
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{task.description}</p>
                        )}

                        {/* 元信息 */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5 text-[#12b7f5]" />
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {task.cron_expression}
                            </span>
                          </div>
                          {task.next_run_at && (
                            <div className="flex items-center gap-1">
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                              <span>
                                下次运行：
                                {formatDistanceToNow(new Date(task.next_run_at), {
                                  addSuffix: true,
                                  locale: zhCN,
                                })}
                              </span>
                            </div>
                          )}
                          {task.last_run_at && (
                            <div className="flex items-center gap-1">
                              <Play className="w-3.5 h-3.5 text-gray-400" />
                              <span>
                                上次运行：
                                {formatDistanceToNow(new Date(task.last_run_at), {
                                  addSuffix: true,
                                  locale: zhCN,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 操作区 */}
                      <div className="flex flex-col items-end gap-2">
                        <Switch
                          checked={task.enabled}
                          onCheckedChange={() => handleToggle(task)}
                          className="data-[state=checked]:bg-[#12b7f5]"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-[#12b7f5]"
                            onClick={() => openEdit(task)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                            onClick={() => setDeleteTaskId(task.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* 创建/编辑对话框 */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setTimeout(resetForm, 200);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '创建任务'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 任务名称 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                任务名称 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="例如：每日早安提醒"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="border-gray-200 focus:border-[#12b7f5]"
              />
            </div>

            {/* 任务描述 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">任务描述</label>
              <Textarea
                placeholder="描述这个任务的用途..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[60px] resize-none border-gray-200 focus:border-[#12b7f5]"
              />
            </div>

            {/* 任务类型 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">任务类型</label>
              <Select value={form.task_type} onValueChange={handleTypeChange}>
                <SelectTrigger className="border-gray-200 focus:border-[#12b7f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reminder">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-500" />
                      提醒
                    </div>
                  </SelectItem>
                  <SelectItem value="send_message">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-sky-500" />
                      发消息
                    </div>
                  </SelectItem>
                  <SelectItem value="post_moment">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-500" />
                      发动态
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cron 表达式 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Cron 表达式 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="0 9 * * 1"
                value={form.cron_expression}
                onChange={(e) => setForm((prev) => ({ ...prev, cron_expression: e.target.value }))}
                className="border-gray-200 focus:border-[#12b7f5] font-mono"
              />
              <p className="text-xs text-gray-400">
                格式：分 时 日 月 周。例如 0 9 * * 1 表示每周一上午 9 点，0 0 * * * 表示每天凌晨
              </p>
            </div>

            {/* 动态配置字段 */}
            {renderConfigFields()}

            <Separator />

            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">立即启用</p>
                <p className="text-xs text-gray-400">创建后任务将按设定时间自动执行</p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
                className="data-[state=checked]:bg-[#12b7f5]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setTimeout(resetForm, 200);
              }}
            >
              取消
            </Button>
            <Button
              className="bg-[#12b7f5] hover:bg-[#0aa8e8]"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : editingTask ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteTaskId !== null} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个定时任务吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTaskId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
