'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { io, Socket } from 'socket.io-client';

interface McpSession {
  name: string;
  hasTools: boolean;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mcpSessions, setMcpSessions] = useState<McpSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [command, setCommand] = useState('node');
  const [args, setArgs] = useState('');
  const [mcpName, setMcpName] = useState('');

  useEffect(() => {
    // 初始化 Socket.io 连接
    const socketIo = io('/', {
      transports: ['websocket'],
    });

    socketIo.on('connect', () => {
      console.log('已连接到 Socket.io 服务器');
      socketIo.emit('join_session', id);
    });

    socketIo.on('mcp_update', () => {
      fetchMcpSessions();
    });

    setSocket(socketIo);

    // 获取 MCP 会话
    fetchMcpSessions();

    return () => {
      socketIo.off('mcp_update');
      socketIo.emit('leave_session', id);
      socketIo.disconnect();
    };
  }, [id]);

  const fetchMcpSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sessions/${id}/mcp`);
      const data = await response.json();
      setMcpSessions(data.mcpSessions || []);
    } catch (error) {
      console.error('获取 MCP 会话失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectMcp = async () => {
    if (!mcpName) {
      alert('请输入 MCP 名称');
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${id}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: mcpName,
          command,
          args: args.split(' ').filter(Boolean),
        }),
      });

      if (response.ok) {
        fetchMcpSessions();
        setMcpName('');
        setArgs('');
      } else {
        const error = await response.json();
        alert(`连接失败: ${error.error}`);
      }
    } catch (error) {
      console.error('连接 MCP 错误:', error);
    }
  };

  const disconnectMcp = async (name: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/mcp?name=${name}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchMcpSessions();
      }
    } catch (error) {
      console.error('断开 MCP 错误:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <Link href="/sessions">
          <Button variant="ghost" size="sm">
            &larr; 返回会话列表
          </Button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">会话详情: {id}</h1>

      <div className="mb-8 p-6 border rounded-lg">
        <h2 className="text-2xl font-bold mb-4">连接新 MCP</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">MCP 名称</label>
            <input
              type="text"
              value={mcpName}
              onChange={e => setMcpName(e.target.value)}
              className="px-3 py-2 border rounded-md w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">命令</label>
            <input
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="px-3 py-2 border rounded-md w-full"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">参数</label>
          <input
            type="text"
            value={args}
            onChange={e => setArgs(e.target.value)}
            className="px-3 py-2 border rounded-md w-full"
            placeholder="例如: --arg1 value1 --arg2 value2"
          />
        </div>
        <Button onClick={connectMcp}>连接 MCP</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <h2 className="text-2xl font-bold p-4 bg-gray-50">MCP 连接</h2>

        {loading ? (
          <div className="p-4 text-center">加载中...</div>
        ) : mcpSessions.length === 0 ? (
          <div className="p-4 text-center">暂无 MCP 连接</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-left">工具</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {mcpSessions.map(mcp => (
                <tr key={mcp.name} className="border-t">
                  <td className="px-4 py-3">{mcp.name}</td>
                  <td className="px-4 py-3">{mcp.hasTools ? '已加载' : '未加载'}</td>
                  <td className="px-4 py-3">
                    <Button variant="destructive" size="sm" onClick={() => disconnectMcp(mcp.name)}>
                      断开连接
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
