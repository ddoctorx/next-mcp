'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Play, Trash2 } from 'lucide-react';

interface FunctionCallResponse {
  message: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  function_response?: {
    result: any;
  };
}

export default function FunctionCallTest() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState('等待连接MCP服务');
  const [testMessage, setTestMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testEnabled, setTestEnabled] = useState(false);
  const [testResults, setTestResults] = useState<FunctionCallResponse[]>([]);

  // 假设当前会话ID保存在localStorage中
  useEffect(() => {
    const storedSessionId = localStorage.getItem('currentSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      checkAvailability(storedSessionId);
    }
  }, []);

  const checkAvailability = async (sid: string) => {
    try {
      const response = await fetch(`/api/sessions/${sid}/mcp`);

      if (response.ok) {
        const data = await response.json();
        const hasMcps = data.mcpSessions && data.mcpSessions.length > 0;

        if (hasMcps) {
          setStatus('已连接MCP，可以开始测试');
          setTestEnabled(true);
        } else {
          setStatus('未连接任何MCP服务，请先连接MCP');
          setTestEnabled(false);
        }
      } else {
        setStatus('无法获取MCP连接状态');
        setTestEnabled(false);
      }
    } catch (error) {
      console.error('检查测试可用性失败:', error);
      setStatus('检查MCP状态失败');
      setTestEnabled(false);
    }
  };

  const runTest = async () => {
    if (!testMessage.trim() || !sessionId || !testEnabled) return;

    setIsLoading(true);

    try {
      // 这里应该调用服务器API测试函数调用
      // 简化示例，延时并返回模拟结果
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟响应
      const result: FunctionCallResponse = {
        message: `您的测试消息: "${testMessage}"`,
        function_call: {
          name: 'test_function',
          arguments: JSON.stringify({ query: testMessage }, null, 2),
        },
        function_response: {
          result: {
            status: 'success',
            data: {
              timestamp: new Date().toISOString(),
              processed: testMessage.toUpperCase(),
            },
          },
        },
      };

      setTestResults(prev => [result, ...prev]);

      toast({
        title: '测试完成',
        description: '函数调用测试已完成',
      });
    } catch (error) {
      console.error('测试失败:', error);
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });

      setTestResults(prev => [
        {
          message: '测试失败，请稍后重试。',
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    toast({
      title: '已清除结果',
    });
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
      <h2 className="text-xl font-semibold mb-2">测试OpenAI函数调用</h2>
      <p className="text-sm text-muted-foreground mb-6">
        使用此界面测试OpenAI的Function
        Call功能与MCP工具的集成。输入提示OpenAI调用工具的消息，查看结果。
      </p>

      <div className="flex items-center mb-4 gap-2">
        <span className="text-sm text-muted-foreground">MCP状态:</span>
        <span className={`text-sm ${testEnabled ? 'text-green-600' : 'text-destructive'}`}>
          {status}
        </span>
      </div>

      <div className="mb-6">
        <label htmlFor="function-test-message" className="text-sm font-medium mb-2 block">
          测试消息 (尝试请求使用工具)
        </label>
        <textarea
          id="function-test-message"
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24"
          placeholder="例如：'生成一张猫的图片' 或 '翻译 Hello World 到中文'"
          value={testMessage}
          onChange={e => setTestMessage(e.target.value)}
          disabled={!testEnabled || isLoading}
        />

        <div className="flex gap-2 mt-3">
          <Button
            onClick={runTest}
            disabled={!testEnabled || isLoading || !testMessage.trim()}
            className="flex items-center"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-primary-foreground rounded-full border-t-transparent animate-spin mr-2"></div>
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            运行测试
          </Button>
          <Button
            onClick={clearResults}
            variant="secondary"
            className="flex items-center"
            disabled={testResults.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清除结果
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">测试结果:</h3>
        <div className="bg-muted rounded-md p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground italic py-2">
              请连接MCP服务并运行测试
            </div>
          ) : (
            testResults.map((result, index) => (
              <div
                key={index}
                className="mb-4 border border-border rounded-md p-4 bg-background shadow-sm"
              >
                <div className="mb-2">
                  <div className="text-sm mb-2">{result.message}</div>

                  {result.function_call && (
                    <div className="mt-2">
                      <div className="flex gap-2 mb-2">
                        <span className="text-sm font-medium">函数调用:</span>
                        <span className="text-sm font-medium text-primary">
                          {result.function_call.name}
                        </span>
                      </div>
                      <div className="bg-muted rounded-md p-3 text-sm font-mono mb-2 overflow-x-auto">
                        {result.function_call.arguments}
                      </div>
                    </div>
                  )}

                  {result.function_response && (
                    <div className="bg-muted rounded-md p-3 text-sm font-mono overflow-x-auto">
                      {JSON.stringify(result.function_response.result, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
