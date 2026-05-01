'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth-context';
import { botApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { BotAuditLog } from '@/lib/types';

const statusMeta = {
  success: { label: '成功', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700 border-red-200' },
  rejected: { label: '已拒绝', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AuditLogsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<BotAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await botApi.getAuditLogs(targetPage, limit);
      if (targetPage === 1) {
        setLogs(response.logs);
      } else {
        setLogs((prev) => [...prev, ...response.logs]);
      }
      setTotal(response.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取操作记录失败';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchLogs(1);
    }
  }, [authLoading, isAuthenticated]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage);
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const hasMore = logs.length < total;
  const isPageLoading = isLoading || authLoading;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f5]">
        {/* 移动端顶部 */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
          <h1 className="text-lg font-semibold">操作记录</h1>
        </div>

        {/* 桌面端标题栏 */}
        <div className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#12b7f5]" />
            <h1 className="text-lg font-semibold">操作记录</h1>
            <Badge variant="secondary" className="ml-2">
              {total}
            </Badge>
          </div>
        </div>

        {/* 记录列表 */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3 pb-20">
            {isPageLoading && logs.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-4 w-1/3" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <AlertCircle className="w-16 h-16 mb-4 text-red-300" />
                <p className="text-lg font-medium mb-1">加载失败</p>
                <p className="text-sm mb-6">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => fetchLogs(1)}
                  className="border-[#12b7f5] text-[#12b7f5] hover:bg-[#12b7f5]/5"
                >
                  重试
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <ShieldCheck className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-1">暂无操作记录</p>
                <p className="text-sm">QQ 管家的所有操作都会记录在这里</p>
              </div>
            ) : (
              <>
                {logs.map((log) => {
                  const meta = statusMeta[log.status as keyof typeof statusMeta];
                  const isExpanded = expandedId === log.id;
                  const requestText = log.request || '(无请求内容)';
                  const isLongRequest = requestText.length > 100;

                  return (
                    <Card
                      key={log.id}
                      className="overflow-hidden transition-all hover:shadow-md"
                    >
                      <CardContent className="p-4">
                        {/* 请求内容 */}
                        <div className="mb-3">
                          <p className="text-sm text-gray-900 leading-relaxed">
                            {isExpanded || !isLongRequest
                              ? requestText
                              : `${requestText.slice(0, 100)}...`}
                          </p>
                          {isLongRequest && (
                            <button
                              onClick={() => toggleExpand(log.id)}
                              className="text-xs text-[#12b7f5] hover:underline mt-1 flex items-center gap-0.5"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  收起
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  展开
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* 元信息行 */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 mb-3">
                          <Badge variant="outline" className={`${meta.color} text-xs px-2 py-0.5`}>
                            {meta.label}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-gray-400" />
                            <span>{log.model || '未知模型'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-gray-400" />
                            <span>{formatLatency(log.latency_ms)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {log.tokens_used} tokens
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {formatDistanceToNow(new Date(log.created_at), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* 展开详情 */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                            {log.plan && Object.keys(log.plan).length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">
                                  执行计划
                                </h4>
                                <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-600">
                                  {JSON.stringify(log.plan, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.tool_calls && log.tool_calls.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">
                                  工具调用
                                </h4>
                                <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-600">
                                  {JSON.stringify(log.tool_calls, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.response && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">
                                  响应内容
                                </h4>
                                <div className="text-xs bg-gray-50 rounded p-2 text-gray-600 whitespace-pre-wrap">
                                  {log.response}
                                </div>
                              </div>
                            )}
                            {log.error && (
                              <div>
                                <h4 className="text-xs font-semibold text-red-700 mb-1">
                                  错误信息
                                </h4>
                                <div className="text-xs bg-red-50 rounded p-2 text-red-600 whitespace-pre-wrap">
                                  {log.error}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 展开/收起按钮 */}
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-500 hover:text-[#12b7f5]"
                            onClick={() => toggleExpand(log.id)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5 mr-1" />
                                收起详情
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                                查看详情
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* 加载更多 */}
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        '加载更多'
                      )}
                    </Button>
                  </div>
                )}

                {/* 到底提示 */}
                {!hasMore && logs.length > 0 && (
                  <div className="text-center text-xs text-gray-400 pt-2">
                    <Separator className="mb-3" />
                    已经到底了
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

    </div>
  );
}
