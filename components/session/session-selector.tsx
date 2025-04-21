'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface Session {
  id: string;
  userId: string;
  createdAt: string;
  mcpSessionCount: number;
}

export default function SessionSelector() {
  const { toast } = useToast();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    // 从localStorage获取当前会话ID
    const storedSessionId = localStorage.getItem('currentSessionId');
    if (storedSessionId) {
      setSelectedSession(storedSessionId);
    }
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('获取会话失败:', error);
      toast({
        title: '获取会话失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'user-1' }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedSession(data.sessionId);

        // 保存会话ID到localStorage
        localStorage.setItem('currentSessionId', data.sessionId);

        // 更新会话列表
        fetchSessions();

        toast({
          title: '已创建新会话',
          description: `会话ID: ${data.sessionId.slice(0, 8)}...`,
        });

        // 跳转到MCP管理页面
        router.push('/mcp');
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      toast({
        title: '创建会话失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSession(sessionId);
    localStorage.setItem('currentSessionId', sessionId);

    toast({
      title: '已切换会话',
      description: `当前会话: ${sessionId.slice(0, 8)}...`,
    });

    // 跳转到MCP管理页面
    router.push('/mcp');
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">当前会话</h2>
        <Button onClick={handleCreateSession} size="sm">
          创建新会话
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">加载会话...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-6 border rounded-md">
          <p className="text-muted-foreground mb-4">没有可用的会话</p>
          <Button onClick={handleCreateSession}>创建你的第一个会话</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`p-3 border rounded-md cursor-pointer transition-colors ${
                selectedSession === session.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
              }`}
              onClick={() => handleSelectSession(session.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">ID: {session.id.slice(0, 8)}...</div>
                  <div className="text-sm text-muted-foreground">
                    创建于: {new Date(session.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm">
                  MCP: <span className="font-medium">{session.mcpSessionCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
