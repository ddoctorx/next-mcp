'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Send, Trash2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  functionCalls?: {
    name: string;
    params: any;
    result?: any;
  }[];
}

export default function ChatInterface() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState('等待连接MCP服务');
  const [canUseChat, setCanUseChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 假设当前会话ID保存在localStorage中
  useEffect(() => {
    const storedSessionId = localStorage.getItem('currentSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      checkChatAvailability(storedSessionId);
      loadChatHistory(storedSessionId);
    }
  }, []);

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkChatAvailability = async (sid: string) => {
    try {
      const response = await fetch(`/api/sessions/${sid}/mcp`);

      if (response.ok) {
        const data = await response.json();
        const hasMcps = data.mcpSessions && data.mcpSessions.length > 0;

        if (hasMcps) {
          setStatus('已连接MCP，可以开始聊天');
          setCanUseChat(true);
        } else {
          setStatus('未连接任何MCP服务，请先连接MCP');
          setCanUseChat(false);
        }
      } else {
        setStatus('无法获取MCP连接状态');
        setCanUseChat(false);
      }
    } catch (error) {
      console.error('检查聊天可用性失败:', error);
      setStatus('检查MCP状态失败');
      setCanUseChat(false);
    }
  };

  const loadChatHistory = async (sid: string) => {
    try {
      // 通常这里会从服务器加载聊天历史
      // 此处简化处理，添加欢迎消息
      setMessages([
        {
          id: Date.now().toString(),
          role: 'system',
          content: '欢迎使用MCP聊天界面。请连接MCP后开始聊天。',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      toast({
        title: '加载聊天历史失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId || !canUseChat) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 这里应该发送到服务器的API，使用OpenAI处理并获取响应
      // 简化示例，假装调用API并延时模拟响应
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟AI响应
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `我已收到您的消息: "${input}"。不过我现在是一个模拟的响应，实际功能需要连接到后端API。`,
        timestamp: new Date(),
        functionCalls: [
          {
            name: 'demo_function',
            params: { query: input },
            result: { status: 'success', message: '这是一个模拟的函数调用结果' },
          },
        ],
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('发送消息失败:', error);
      toast({
        title: '发送消息失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });

      // 添加错误消息
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: '发送消息失败，请稍后重试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('确定要清除所有聊天记录吗？')) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'system',
          content: '聊天已清除。',
          timestamp: new Date(),
        },
      ]);

      toast({
        title: '聊天已清除',
        description: '所有聊天记录已被清除',
      });
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getRoleColorClass = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-primary text-primary-foreground';
      case 'assistant':
        return 'bg-secondary border border-border';
      case 'system':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-background border border-border';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'user':
        return '用户';
      case 'assistant':
        return '助手';
      case 'system':
        return '系统';
      default:
        return role;
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
      <h2 className="text-xl font-semibold mb-4">与OpenAI聊天</h2>
      <div className="flex items-center mb-4 gap-2">
        <span className="text-sm text-muted-foreground">状态:</span>
        <span className={`text-sm ${canUseChat ? 'text-green-600' : 'text-destructive'}`}>
          {status}
        </span>
      </div>

      <div className="bg-muted rounded-md p-4 mb-4 h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground italic py-2">
            请连接MCP服务并开始聊天
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`message mb-4 max-w-3/4 rounded-lg p-3 ${getRoleColorClass(
                message.role,
              )} ${message.role === 'user' ? 'ml-auto' : ''}`}
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{getRoleName(message.role)}</span>
                <span className="text-muted-foreground">
                  {formatTime(new Date(message.timestamp))}
                </span>
              </div>
              <div className="message-content whitespace-pre-wrap">{message.content}</div>

              {message.functionCalls && message.functionCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  {message.functionCalls.map((call, idx) => (
                    <div key={idx} className="text-xs">
                      <div className="font-medium mb-1">函数调用: {call.name}</div>
                      <div className="bg-background/50 rounded-md p-2 mb-1 font-mono overflow-x-auto">
                        {JSON.stringify(call.params, null, 2)}
                      </div>
                      {call.result && (
                        <div className="bg-background/50 rounded-md p-2 font-mono overflow-x-auto">
                          {JSON.stringify(call.result, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
          placeholder={canUseChat ? '在这里输入消息...' : '请先连接MCP服务...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={!canUseChat || isLoading}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <div className="flex flex-row sm:flex-col gap-2 self-end">
          <Button
            onClick={handleSendMessage}
            disabled={!canUseChat || isLoading || !input.trim()}
            className="flex items-center"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-primary-foreground rounded-full border-t-transparent animate-spin mr-2"></div>
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            发送
          </Button>
          <Button onClick={clearChat} variant="destructive" className="flex items-center">
            <Trash2 className="h-4 w-4 mr-2" />
            清除聊天
          </Button>
        </div>
      </div>
    </div>
  );
}
