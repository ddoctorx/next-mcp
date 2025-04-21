'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, X } from 'lucide-react';

interface McpSession {
  name: string;
  hasTools: boolean;
}

interface McpListProps {
  onMcpCountChange: (count: number) => void;
}

export default function McpList({ onMcpCountChange }: McpListProps) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<McpSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 假设当前会话ID保存在localStorage中
  useEffect(() => {
    const storedSessionId = localStorage.getItem('currentSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      fetchMcpSessions(storedSessionId);
    }
  }, []);

  useEffect(() => {
    // 更新父组件的计数
    onMcpCountChange(sessions.length);
  }, [sessions, onMcpCountChange]);

  const fetchMcpSessions = async (sid: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sessions/${sid}/mcp`);

      if (response.ok) {
        const data = await response.json();
        setSessions(data.mcpSessions || []);
      } else {
        setSessions([]);
        toast({
          title: '获取会话失败',
          description: '无法获取MCP连接列表',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('获取MCP会话失败:', error);
      setSessions([]);
      toast({
        title: '获取会话失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const reconnectMcp = async (name: string) => {
    if (!sessionId) return;

    toast({
      title: '重新连接MCP',
      description: `正在尝试重新连接: ${name}`,
    });

    try {
      // 首先断开连接
      await fetch(`/api/sessions/${sessionId}/mcp?name=${name}`, {
        method: 'DELETE',
      });

      // 然后重新获取列表
      await fetchMcpSessions(sessionId);

      // 这里应该有重新连接的逻辑，但简化处理，只是提示用户
      toast({
        title: '需要重新添加',
        description: `已断开连接 ${name}，请重新添加`,
      });
    } catch (error) {
      console.error('重新连接MCP失败:', error);
      toast({
        title: '重新连接失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const deleteMcp = async (name: string) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/mcp?name=${name}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 更新列表
        setSessions(prev => prev.filter(mcp => mcp.name !== name));

        toast({
          title: '已断开连接',
          description: `已成功断开 ${name} 的连接`,
        });
      } else {
        throw new Error('断开连接失败');
      }
    } catch (error) {
      console.error('断开MCP连接失败:', error);
      toast({
        title: '断开连接失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  if (!sessionId) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-muted-foreground mb-4">未找到会话</p>
        <Button onClick={() => (window.location.href = '/sessions')} variant="secondary">
          创建或选择会话
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">已连接的MCP服务</h2>

        <Button
          variant="outline"
          size="sm"
          onClick={() => sessionId && fetchMcpSessions(sessionId)}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent mx-auto mb-2"></div>
          <p className="text-muted-foreground">正在加载...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 px-4" id="empty-state">
          <p className="text-muted-foreground mb-4">暂无已连接的MCP</p>
          <Button
            onClick={() => document.getElementById('add-mcp-trigger')?.click()}
            variant="secondary"
          >
            添加您的第一个MCP服务
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(mcp => (
            <div
              key={mcp.name}
              className="border border-border rounded-md p-4 bg-background shadow-sm"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium mb-1">{mcp.name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <div className="text-muted-foreground">Type: stdio</div>
                    <div className="text-green-600">已连接</div>
                  </div>
                  <div className="mt-2 text-sm">
                    {mcp.hasTools ? (
                      <span className="text-green-600">已加载工具</span>
                    ) : (
                      <span className="text-amber-600">未加载工具</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 self-end md:self-start">
                  <Button
                    variant="secondary"
                    size="icon"
                    title="重新连接"
                    onClick={() => reconnectMcp(mcp.name)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    title="删除"
                    onClick={() => deleteMcp(mcp.name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
