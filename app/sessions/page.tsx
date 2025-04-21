'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Session {
  id: string;
  userId: string;
  createdAt: string;
  mcpSessionCount: number;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('user-1');

  useEffect(() => {
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
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        fetchSessions();
      }
    } catch (error) {
      console.error('创建会话失败:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">会话管理</h1>

      <div className="mb-6 flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">用户 ID</label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="px-3 py-2 border rounded-md w-64"
          />
        </div>
        <Button onClick={createSession}>创建新会话</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-3 text-left">会话 ID</th>
              <th className="px-4 py-3 text-left">用户 ID</th>
              <th className="px-4 py-3 text-left">创建时间</th>
              <th className="px-4 py-3 text-left">MCP 连接数</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center">
                  加载中...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center">
                  暂无会话
                </td>
              </tr>
            ) : (
              sessions.map(session => (
                <tr key={session.id} className="border-t">
                  <td className="px-4 py-3">{session.id}</td>
                  <td className="px-4 py-3">{session.userId}</td>
                  <td className="px-4 py-3">{new Date(session.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{session.mcpSessionCount}</td>
                  <td className="px-4 py-3">
                    <Link href={`/sessions/${session.id}`}>
                      <Button variant="outline" size="sm">
                        查看详情
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
