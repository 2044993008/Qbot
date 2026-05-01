'use client';

import { useState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useMoments } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Heart, MessageCircle, Send, Image as ImageIcon, X, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { uploadApi } from '@/lib/api';

export default function MomentsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { moments, fetchMoments, publishMoment, likeMoment, commentMoment, editMoment, deleteMoment } = useMoments();
  const [isPublishing, setIsPublishing] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const [showAllComments, setShowAllComments] = useState<Record<number, boolean>>({});
  const [editingMoment, setEditingMoment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 只有在用户已认证且不再加载时才获取数据
    if (!authLoading && isAuthenticated) {
      fetchMoments();
    }
  }, [authLoading, isAuthenticated, fetchMoments]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length && selectedImages.length < 9; i++) {
      try {
        const result = await uploadApi.image(files[i]);
        setSelectedImages(prev => [...prev, result.url]);
      } catch (error) {
        console.error('上传图片失败:', error);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePublish = async () => {
    if (!newContent.trim() && selectedImages.length === 0) return;

    setIsPublishing(true);
    try {
      const createdMoment = await publishMoment(newContent, selectedImages);
      if (!createdMoment) {
        return;
      }
      setNewContent('');
      setSelectedImages([]);
    } catch (error) {
      console.error('发布动态失败:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleComment = async (momentId: number) => {
    const content = commentInputs[momentId];
    if (!content?.trim()) return;

    try {
      const createdComment = await commentMoment(momentId, content);
      if (!createdComment) {
        return;
      }
      setCommentInputs(prev => ({ ...prev, [momentId]: '' }));
    } catch (error) {
      console.error('评论失败:', error);
    }
  };

  const toggleComments = (momentId: number) => {
    setExpandedComments(prev => ({ ...prev, [momentId]: !prev[momentId] }));
  };

  const showMoreComments = (momentId: number) => {
    setShowAllComments(prev => ({ ...prev, [momentId]: true }));
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length && editImages.length < 9; i++) {
      try {
        const result = await uploadApi.image(files[i]);
        setEditImages(prev => [...prev, result.url]);
      } catch (error) {
        console.error('上传图片失败:', error);
      }
    }

    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const openEditDialog = (momentId: number) => {
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;
    setEditingMoment(momentId);
    setEditContent(moment.content);
    setEditImages(moment.images || []);
  };

  const closeEditDialog = () => {
    setEditingMoment(null);
    setEditContent('');
    setEditImages([]);
  };

  const handleEdit = async () => {
    if (!editingMoment) return;
    if (!editContent.trim() && editImages.length === 0) return;

    setIsEditing(true);
    try {
      await editMoment(editingMoment, editContent, editImages);
      closeEditDialog();
    } catch (error) {
      console.error('编辑动态失败:', error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async (momentId: number) => {
    try {
      await deleteMoment(momentId);
    } catch (error) {
      console.error('删除动态失败:', error);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f5]">
        {/* 移动端顶部 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b">
          <h1 className="text-lg font-semibold">QQ空间</h1>
        </div>

        {/* 发布框 */}
        <div className="p-4 bg-white border-b">
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handlePublish();
            }}
          >
            <Avatar name={user?.nickname || 'U'} color={user?.avatar_color} size="md" />
            <div className="flex-1">
              <Textarea
                placeholder="分享生活点滴..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[80px] resize-none border-gray-200 focus:border-[#12b7f5]"
              />
              
              {/* 图片预览 */}
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedImages.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`预览 ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 操作栏 */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-1" />
                    图片
                  </Button>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#12b7f5] hover:bg-[#0aa8e8]"
                  disabled={(!newContent.trim() && selectedImages.length === 0) || isPublishing}
                >
                  {isPublishing ? '发布中...' : '发布'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* 动态列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {moments.map((moment) => (
            <Card key={`moment-${moment.id}`} className="overflow-hidden">
              <CardContent className="p-4">
                {/* 发布者信息 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={moment.publisher_nickname || '?'}
                      color={moment.publisher_avatar}
                      size="md"
                    />
                    <div>
                      <span className="font-medium">{moment.publisher_nickname}</span>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(moment.created_at), { addSuffix: true, locale: zhCN })}
                      </p>
                    </div>
                  </div>
                  {moment.user_id === user?.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-[#12b7f5]"
                        onClick={() => openEditDialog(moment.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除这条动态吗？此操作不可撤销，相关的评论和点赞也会被删除。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-500 hover:bg-red-600"
                              onClick={() => handleDelete(moment.id)}
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* 内容 */}
                {moment.content && (
                  <p className="mb-3 whitespace-pre-wrap">{moment.content}</p>
                )}

                {/* 图片 */}
                {moment.images && moment.images.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${
                    moment.images.length === 1 ? 'grid-cols-1' :
                    moment.images.length === 2 ? 'grid-cols-2' :
                    'grid-cols-3'
                  }`}>
                    {moment.images.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`图片 ${index + 1}`}
                        className="w-full object-cover rounded-lg cursor-pointer hover:opacity-90"
                      />
                    ))}
                  </div>
                )}

                {/* 操作栏 */}
                <div className="flex items-center gap-6 pt-3 border-t">
                  <button
                    onClick={() => likeMoment(moment.id)}
                    className={`flex items-center gap-1 ${moment.is_liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                  >
                    <Heart className={`w-4 h-4 ${moment.is_liked ? 'fill-current' : ''}`} />
                    <span>{moment.like_count || 0}</span>
                  </button>
                  <button
                    onClick={() => toggleComments(moment.id)}
                    className="flex items-center gap-1 text-gray-500 hover:text-[#12b7f5]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{moment.comment_count || 0}</span>
                  </button>
                </div>

                {/* 评论区 */}
                {expandedComments[moment.id] && (
                  <div className="mt-4 pt-4 border-t">
                    {/* 评论列表 */}
                    {moment.comments && moment.comments.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {!showAllComments[moment.id] && moment.comments.length > 3 && (
                          <button
                            onClick={() => showMoreComments(moment.id)}
                            className="text-[#12b7f5] text-sm flex items-center gap-1"
                          >
                            <ChevronDown className="w-4 h-4" />
                            查看全部 {moment.comments.length} 条评论
                          </button>
                        )}
                        
                        {(showAllComments[moment.id] ? moment.comments : moment.comments.slice(0, 3)).map((comment) => (
                          <div key={`comment-${comment.id}`} className="flex gap-2 text-sm">
                            <span className="font-medium text-[#12b7f5]">
                              {comment.user_nickname}：
                            </span>
                            <span>{comment.content}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 评论输入 */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="写评论..."
                        value={commentInputs[moment.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleComment(moment.id)}
                        className="flex-1 h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleComment(moment.id)}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {moments.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <p>还没有动态，快来发布第一条吧！</p>
            </div>
          )}
        </div>
      </div>

      {/* 编辑动态对话框 */}
      <Dialog open={editingMoment !== null} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑动态</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="分享生活点滴..."
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[100px] resize-none border-gray-200 focus:border-[#12b7f5]"
            />
            {editImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editImages.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`预览 ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setEditImages(prev => prev.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEditImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editFileInputRef.current?.click()}
                >
                  <ImageIcon className="w-4 h-4 mr-1" />
                  图片
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>取消</Button>
            <Button
              className="bg-[#12b7f5] hover:bg-[#0aa8e8]"
              onClick={handleEdit}
              disabled={(!editContent.trim() && editImages.length === 0) || isEditing}
            >
              {isEditing ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
