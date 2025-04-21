'use client';

import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface AddMcpFormProps {
  onMcpAdded: () => void;
}

type McpType = 'stdio' | 'sse';

export default function AddMcpForm({ onMcpAdded }: AddMcpFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    type: 'stdio' as McpType,
    command: 'npx',
    args: '',
    env: '',
    url: '',
  });
  const [commandLine, setCommandLine] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);

  // 假设当前会话ID保存在localStorage中
  useEffect(() => {
    const storedSessionId = localStorage.getItem('currentSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    }
  }, []);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { id, value } = e.target;
    const newData = { ...formData, [id.replace('server-', '')]: value };
    setFormData(newData);
    validateForm(newData);
  };

  const validateForm = (data = formData) => {
    const isValid =
      data.name.trim() !== '' &&
      (data.type === 'stdio' ? data.command.trim() !== '' : data.url.trim() !== '');
    setIsFormValid(isValid);
    return isValid;
  };

  const handleCommandLineParse = () => {
    if (!commandLine.trim()) return;

    try {
      // 简单拆分命令行
      const parts = commandLine.trim().split(/\s+/);
      const command = parts[0];
      const args = parts.slice(1).join('\n');

      setFormData(prev => ({
        ...prev,
        command,
        args,
      }));

      toast({
        title: '命令已解析',
        description: `命令: ${command}, 参数已更新`,
      });

      validateForm({
        ...formData,
        command,
        args,
      });
    } catch (error) {
      toast({
        title: '解析失败',
        description: '无法解析命令行',
        variant: 'destructive',
      });
    }
  };

  const handleJsonValidate = () => {
    if (!configJson.trim()) return;

    try {
      JSON.parse(configJson);
      toast({
        title: 'JSON 有效',
        description: 'JSON 格式正确',
      });
    } catch (error) {
      toast({
        title: 'JSON 无效',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const handleJsonFormat = () => {
    if (!configJson.trim()) return;

    try {
      const parsed = JSON.parse(configJson);
      setConfigJson(JSON.stringify(parsed, null, 2));
      toast({
        title: 'JSON 已格式化',
      });
    } catch (error) {
      toast({
        title: 'JSON 无效',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  const handleConfigParse = () => {
    if (!configJson.trim()) return;

    try {
      const config = JSON.parse(configJson);

      // 假设结构为 {"mcpServers": {"name": {...config...}}}
      if (config.mcpServers && typeof config.mcpServers === 'object') {
        const mcpName = Object.keys(config.mcpServers)[0];
        const mcpConfig = config.mcpServers[mcpName];

        if (mcpConfig) {
          const newFormData = {
            name: mcpName,
            type: mcpConfig.type || 'stdio',
            command: mcpConfig.command || '',
            args: Array.isArray(mcpConfig.args) ? mcpConfig.args.join('\n') : '',
            env: mcpConfig.env
              ? Object.entries(mcpConfig.env)
                  .map(([k, v]) => `${k}=${v}`)
                  .join('\n')
              : '',
            url: mcpConfig.url || '',
          };

          setFormData(newFormData);
          validateForm(newFormData);

          toast({
            title: '配置已应用',
            description: `MCP名称: ${mcpName}`,
          });
        }
      }
    } catch (error) {
      toast({
        title: '解析失败',
        description: '无法解析JSON配置',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!sessionId) {
      toast({
        title: '错误',
        description: '没有活动会话，请先创建会话',
        variant: 'destructive',
      });
      return;
    }

    if (!validateForm()) return;

    const payload = {
      name: formData.name,
      command: formData.command,
      args: formData.args.split('\n').filter(Boolean),
    };

    if (formData.type === 'sse') {
      // 对于SSE类型的MCP
      payload.command = 'sse';
      // @ts-ignore
      payload.url = formData.url;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: 'MCP 已添加',
          description: `成功添加 MCP: ${formData.name}`,
        });
        onMcpAdded();

        // 清空表单
        setFormData({
          name: '',
          type: 'stdio' as McpType,
          command: 'npx',
          args: '',
          env: '',
          url: '',
        });
        setCommandLine('');
        setConfigJson('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '添加MCP失败');
      }
    } catch (error) {
      toast({
        title: '添加失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold mb-6">连接新的MCP服务</h2>

      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">快速添加常用MCP服务:</label>
        <select
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          onChange={e => {
            // 预设MCP的处理逻辑
            const presetValue = e.target.value;
            if (!presetValue) return;

            const presets: Record<string, any> = {
              'amap-maps': {
                name: '高德地图',
                type: 'stdio',
                command: 'npx',
                args: '-y\n@amap/amap-maps-mcp-server\n--AMAP_MAPS_API_KEY=your-key-here',
              },
              stripe: {
                name: 'Stripe',
                type: 'stdio',
                command: 'npx',
                args: '-y\n@stripe/mcp\n--api-key=your-key-here',
              },
              openai: {
                name: 'OpenAI',
                type: 'stdio',
                command: 'npx',
                args: '-y\n@openai/mcp\n--api-key=your-key-here',
              },
            };

            if (presetValue in presets) {
              const newFormData = { ...formData, ...presets[presetValue] };
              setFormData(newFormData);
              validateForm(newFormData);
            }
          }}
        >
          <option value="">选择预设服务...</option>
          <option value="amap-maps">高德地图 MCP</option>
          <option value="stripe">Stripe MCP</option>
          <option value="openai">OpenAI MCP</option>
        </select>
      </div>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">或者手动配置</span>
        </div>
      </div>

      <div className="mt-6">
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或者直接输入命令行</span>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="command-line-input" className="text-sm font-medium mb-2 block">
            输入MCP启动命令 (例如: npx -y @amap/amap-maps-mcp-server --AMAP_MAPS_API_KEY=xxx)
          </label>
          <input
            type="text"
            id="command-line-input"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="npx -y @mcp/server --API_KEY=your-key"
            value={commandLine}
            onChange={e => setCommandLine(e.target.value)}
          />
          <Button type="button" onClick={handleCommandLineParse} className="mt-2">
            解析为配置
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或者直接粘贴配置</span>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="config-json" className="text-sm font-medium mb-2 block">
            直接输入或粘贴 MCP 配置 (JSON)
          </label>
          <textarea
            id="config-json"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary h-40 font-mono"
            placeholder='{"mcpServers": {"your-server": {"command": "npx", "args": ["-y", "@your/server"], "env": {"API_KEY": "your-key"}}}}'
            value={configJson}
            onChange={e => setConfigJson(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={handleJsonValidate}>
              校验JSON
            </Button>
            <Button type="button" variant="secondary" onClick={handleJsonFormat}>
              格式化
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfigJson('')}>
              清除
            </Button>
            <Button type="button" onClick={handleConfigParse}>
              应用配置
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="server-name" className="text-sm font-medium mb-2 block">
          名称 *
        </label>
        <input
          type="text"
          id="server-name"
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例如: Stripe"
          value={formData.name}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="server-type" className="text-sm font-medium mb-2 block">
          类型 *
        </label>
        <select
          id="server-type"
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={formData.type}
          onChange={handleInputChange}
        >
          <option value="stdio">stdio</option>
          <option value="sse">sse</option>
        </select>
      </div>

      {formData.type === 'stdio' ? (
        <>
          <div className="mb-4">
            <label htmlFor="server-command" className="text-sm font-medium mb-2 block">
              命令 *
            </label>
            <input
              type="text"
              id="server-command"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="例如: npx"
              value={formData.command}
              onChange={handleInputChange}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="server-args" className="text-sm font-medium mb-2 block">
              参数 (每行一个)
            </label>
            <textarea
              id="server-args"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 font-mono"
              placeholder="例如:&#10;-y&#10;@stripe/mcp&#10;--api-key=YOUR_KEY"
              value={formData.args}
              onChange={handleInputChange}
            ></textarea>
          </div>

          <div className="mb-4">
            <label htmlFor="server-env" className="text-sm font-medium mb-2 block">
              环境变量 (每行一个键值对)
            </label>
            <textarea
              id="server-env"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 font-mono"
              placeholder="例如:&#10;STRIPE_API_KEY=sk_test_...&#10;STRIPE_ENV=test"
              value={formData.env}
              onChange={handleInputChange}
            ></textarea>
          </div>
        </>
      ) : (
        <div className="mb-4">
          <label htmlFor="server-url" className="text-sm font-medium mb-2 block">
            服务URL *
          </label>
          <input
            type="text"
            id="server-url"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例如: http://localhost:5000"
            value={formData.url}
            onChange={handleInputChange}
          />
        </div>
      )}

      <div className="flex justify-end mt-6">
        <Button type="submit" disabled={!isFormValid}>
          添加MCP
        </Button>
      </div>
    </form>
  );
}
