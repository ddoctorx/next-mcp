import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ChatFlowVisualization = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // seconds per step
  const [userQuestion, setUserQuestion] = useState('你能告诉我北京明天的天气怎么样吗？');
  const [showCode, setShowCode] = useState(false);

  // Used to visualize which entity is active
  const [activeEntity, setActiveEntity] = useState(null);

  // Chat history state
  const [messages, setMessages] = useState([]);

  // Function call state
  const [functionCall, setFunctionCall] = useState(null);
  const [functionResult, setFunctionResult] = useState(null);

  // Define the complete flow
  const steps = [
    {
      id: 'user-question',
      title: '用户提问',
      description: '用户在界面中输入问题',
      entity: 'user',
      action: '输入问题并发送',
      details:
        '用户在聊天界面输入一个问题，这个问题可能需要调用外部工具才能回答，例如天气查询、搜索或计算等。',
      effectFn: () => {
        setMessages([
          {
            role: 'user',
            content: userQuestion,
            time: getCurrentTime(),
          },
        ]);
        setActiveEntity('user');
      },
      code: `// 前端聊天组件
const sendMessage = async () => {
  if (!messageText.trim() || isLoading) return;

  // 将用户消息添加到聊天界面
  setMessages(prev => [...prev, {
    role: "user",
    content: messageText,
    time: getCurrentTime()
  }]);

  // 清空输入框
  setMessageText("");

  // 设置加载状态
  setIsLoading(true);

  // 调用API发送消息
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.id,
        message: messageText
      })
    });

    // 处理响应...
  } catch (error) {
    // 处理错误...
  } finally {
    setIsLoading(false);
  }
};`,
    },
    {
      id: 'client-preprocessing',
      title: '客户端预处理',
      description: '客户端处理用户消息并准备API请求',
      entity: 'client',
      action: '预处理用户消息',
      details:
        "客户端验证用户输入，将消息添加到本地聊天历史，并构建发送给后端API的请求。此时客户端会显示一个'AI思考中...'的状态信息。",
      effectFn: () => {
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            content: 'AI思考中...',
            time: getCurrentTime(),
          },
        ]);
        setActiveEntity('client');
      },
      code: `// 后端聊天API路由
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  // 验证会话
  if (!sessions[sessionId]) {
    return res.status(404).json({
      success: false,
      error: '会话不存在'
    });
  }

  try {
    // 初始化或获取聊天历史
    const chatHistory = initChatHistory(sessionId);

    // 添加用户消息到历史
    chatHistory.push({
      role: 'user',
      content: message,
    });

    // 准备调用OpenAI...
`,
    },
    {
      id: 'gather-tools',
      title: '收集可用工具',
      description: '服务器收集当前会话中可用的MCP工具',
      entity: 'client',
      action: '收集MCP工具',
      details:
        '服务器会查询当前会话中所有已连接的MCP服务，收集它们提供的工具定义，并将这些工具转换为OpenAI函数调用格式。',
      effectFn: () => {
        setActiveEntity('client');
      },
      code: `// 准备工具列表
const allTools = [];
const mcpSessions = sessions[sessionId].mcpSessions;

// 收集所有MCP工具并转换为OpenAI格式
for (const mcpName in mcpSessions) {
  const mcpSession = mcpSessions[mcpName];
  if (mcpSession.tools && mcpSession.tools.length > 0) {
    const openaiTools = convertMcpToolsToOpenAIFormat(mcpSession.tools);
    allTools.push(...openaiTools);
  }
}

console.log(\`为会话 \${sessionId} 找到 \${allTools.length} 个工具\`);

// 转换函数示例
function convertMcpToolsToOpenAIFormat(mcpTools) {
  return mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || \`执行\${tool.name}操作\`,
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  }));
}`,
    },
    {
      id: 'call-openai',
      title: '调用OpenAI API',
      description: '服务器将用户消息和工具定义发送给OpenAI',
      entity: 'client',
      action: '请求OpenAI API',
      details:
        '服务器将用户消息历史和收集到的工具定义一起发送给OpenAI API，请求AI生成回复或进行工具调用。',
      effectFn: () => {
        setActiveEntity('client');
      },
      code: `// 调用OpenAI API
const response = await openai.callChatCompletion(
  chatHistory,
  allTools.length > 0 ? allTools : null
);

// OpenAI API调用实现
async function callChatCompletion(messages, tools = null) {
  const requestOptions = {
    method: 'post',
    url: OPENAI_API_URL,
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json',
    },
    data: {
      model: 'gpt-4.1',
      messages,
      temperature: 0.7,
    },
  };

  // 如果提供了工具，添加到请求中
  if (tools && tools.length > 0) {
    requestOptions.data.tools = tools;
    requestOptions.data.tool_choice = 'auto';
  }

  const response = await axios(requestOptions);
  return response.data;
}`,
    },
    {
      id: 'openai-processing',
      title: 'OpenAI处理请求',
      description: 'OpenAI处理用户问题并决定是否调用工具',
      entity: 'openai',
      action: '生成响应或函数调用',
      details:
        'OpenAI分析用户问题，理解其意图，并决定是否需要调用外部工具来回答问题。在本例中，OpenAI决定需要调用天气工具来获取北京明天的天气信息。',
      effectFn: () => {
        setActiveEntity('openai');
        // Mock function call from OpenAI
        setFunctionCall({
          id: 'call_' + Date.now(),
          function: {
            name: 'weather',
            arguments: JSON.stringify(
              {
                city: '北京',
                date: 'tomorrow',
              },
              null,
              2,
            ),
          },
        });
      },
      code: `// OpenAI返回的函数调用示例
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "gpt-4.1",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "weather",
            "arguments": "{\\n  \\"city\\": \\"北京\\",\\n  \\"date\\": \\"tomorrow\\"\\n}"
          }
        }
      ]
    },
    "finish_reason": "tool_calls"
  }]
}`,
    },
    {
      id: 'process-function-call',
      title: '处理函数调用',
      description: '服务器处理OpenAI返回的函数调用请求',
      entity: 'client',
      action: '分析函数调用',
      details:
        '服务器解析OpenAI返回的函数调用请求，识别需要调用的工具、参数以及需要使用的MCP服务。',
      effectFn: () => {
        setActiveEntity('client');
        setMessages(prev => prev.filter(msg => msg.role !== 'system'));
      },
      code: `// 处理OpenAI的函数调用
const processedResponse = await openai.handleFunctionCalling(
  response,
  sessionId,
  mcpSessions,
  mcpToolAdapter
);

// 函数调用处理
if (processedResponse.type === 'function_call') {
  // 处理函数调用的情况
  const functionCalls = processedResponse.calls;

  // 添加函数调用到聊天历史
  chatHistory.push({
    role: 'assistant',
    content: null,
    tool_calls: functionCalls,
  });

  // 处理每个函数调用
  const results = [];
  for (const call of functionCalls) {
    if (call.type === 'function') {
      // 提取函数详情
      const functionName = call.function.name;
      let functionArgs = {};

      try {
        functionArgs = JSON.parse(call.function.arguments);
      } catch (e) {
        console.error('解析函数参数失败:', e);
      }

      // 查找适当的MCP服务并执行工具调用
      // ...
    }
  }

  // 继续处理...
}`,
    },
    {
      id: 'find-mcp-tool',
      title: '查找MCP工具',
      description: '服务器查找匹配的MCP工具',
      entity: 'client',
      action: '定位工具',
      details:
        "服务器在已连接的MCP服务中查找匹配的工具。在本例中，它查找名为'weather'的工具，该工具能够提供天气信息。",
      effectFn: () => {
        setActiveEntity('client');
      },
      code: `// 查找匹配的MCP工具
let foundTool = false;
let toolResult = null;

// 记录可用的MCP和工具
console.log('可用的MCP服务:');
for (const mcpName in mcpSessions) {
  console.log(
    \`- \${mcpName} 包含工具:\`,
    mcpSessions[mcpName].tools.map(t => t.name)
  );
}

// 遍历所有MCP服务查找匹配的工具
for (const mcpName in mcpSessions) {
  const mcpSession = mcpSessions[mcpName];
  const hasTool = mcpSession.tools.some(t => t.name === functionName);

  if (hasTool) {
    console.log(\`在MCP "\${mcpName}" 中找到工具 "\${functionName}"\`);
    foundTool = true;

    try {
      // 准备调用工具
      // ...
    } catch (error) {
      // 处理错误
    }
  }
}`,
    },
    {
      id: 'call-mcp-tool',
      title: '调用MCP工具',
      description: '服务器调用MCP工具获取数据',
      entity: 'mcp',
      action: '执行工具调用',
      details:
        '服务器向MCP服务发送工具调用请求，包括工具名称和参数。MCP服务执行工具并返回结果。在本例中，天气工具查询北京明天的天气信息并返回结果。',
      effectFn: () => {
        setActiveEntity('mcp');
        // Mock function result from MCP
        setTimeout(() => {
          setFunctionResult({
            city: '北京',
            date: '2025-04-21',
            temperature: 22,
            condition: '晴朗',
            humidity: 45,
            wind: '3级',
            forecast: '明天北京天气晴朗，气温22°C，湿度45%，东北风3级。',
          });
        }, 1000);
      },
      code: `// 调用MCP工具
async function callRemoteMcpTool(mcpSession, toolName, params) {
  return new Promise((resolve, reject) => {
    // 设置请求ID
    const requestId = \`req_\${Date.now()}\`;

    // 构建请求
    const request = {
      id: requestId,
      type: 'call',
      tool: toolName,
      params: params,
    };

    console.log(\`发送调用请求: \${requestId}\`, JSON.stringify(request, null, 2));

    // 设置超时
    const timeout = setTimeout(() => {
      reject(new Error('工具调用超时'));
    }, 30000);

    // 监听进程输出
    mcpSession.process.stdout.on('data', data => {
      // 处理响应...
      const response = JSON.parse(line);

      // 检查是否匹配请求ID
      if (response.id === requestId) {
        clearTimeout(timeout);

        if (response.status === 'error') {
          reject(new Error(response.error || '工具调用失败'));
        } else {
          resolve(response.result);
        }
      }
    });

    // 发送请求
    mcpSession.process.stdin.write(JSON.stringify(request) + '\\n');
  });
}`,
    },
    {
      id: 'process-tool-result',
      title: '处理工具结果',
      description: '服务器接收并处理MCP工具返回的结果',
      entity: 'client',
      action: '处理工具结果',
      details:
        '服务器接收MCP工具返回的结果，并将其格式化为OpenAI可以理解的格式。结果将添加到聊天历史中，并准备发送回OpenAI以获取最终回复。',
      effectFn: () => {
        setActiveEntity('client');
      },
      code: `// 处理工具结果
const resultForAI = JSON.stringify(toolResult);

// 添加结果
results.push({
  tool_call_id: call.id,
  function_name: functionName,
  result: resultForAI,
});

// 将工具结果添加到聊天历史
chatHistory.push({
  role: 'tool',
  tool_call_id: call.id,
  content: resultForAI,
});`,
    },
    {
      id: 'call-openai-with-result',
      title: '将结果发送回OpenAI',
      description: '服务器将工具结果发送回OpenAI获取最终回复',
      entity: 'client',
      action: '发送工具结果到OpenAI',
      details:
        '服务器将MCP工具的执行结果连同之前的消息历史一起发送回OpenAI，请求AI生成一个考虑了工具结果的最终回复。',
      effectFn: () => {
        setActiveEntity('client');
      },
      code: `// 将工具结果发送回OpenAI获取最终回复
const followUpResponse = await openai.callChatCompletion(chatHistory);

// 确保返回的是文本内容
if (
  followUpResponse.choices &&
  followUpResponse.choices[0] &&
  followUpResponse.choices[0].message
) {
  const finalContent = followUpResponse.choices[0].message.content;

  // 添加最终回复到聊天历史
  chatHistory.push({
    role: 'assistant',
    content: finalContent,
  });

  // 返回结果给前端
  res.json({
    success: true,
    type: 'function_result',
    function_calls: processedResponse.calls,
    results: results,
    final_response: finalContent,
  });
} else {
  throw new Error('无法获取模型的最终回复');
}`,
    },
    {
      id: 'openai-generates-answer',
      title: 'OpenAI生成最终回答',
      description: 'OpenAI根据工具结果生成最终回答',
      entity: 'openai',
      action: '生成回答',
      details:
        'OpenAI接收工具调用结果，结合原始问题和上下文，生成一个最终的、考虑了工具结果的回答。',
      effectFn: () => {
        setActiveEntity('openai');
      },
      code: `// OpenAI生成最终回答的请求和响应示例
// 请求:
{
  "model": "gpt-4.1",
  "messages": [
    {"role": "user", "content": "你能告诉我北京明天的天气怎么样吗？"},
    {"role": "assistant", "tool_calls": [{"id": "call_abc123", "type": "function", "function": {"name": "weather", "arguments": "{\\"city\\": \\"北京\\", \\"date\\": \\"tomorrow\\"}"}}]},
    {"role": "tool", "tool_call_id": "call_abc123", "content": "{\\"city\\":\\"北京\\",\\"date\\":\\"2025-04-21\\",\\"temperature\\":22,\\"condition\\":\\"晴朗\\",\\"humidity\\":45,\\"wind\\":\\"3级\\",\\"forecast\\":\\"明天北京天气晴朗，气温22°C，湿度45%，东北风3级。\\"}"}
  ]
}

// 响应:
{
  "id": "chatcmpl-xyz789",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "根据最新天气预报，明天北京天气将会晴朗，气温约22°C，湿度45%，东北风3级。是个适合外出活动的好天气！"
    },
    "finish_reason": "stop"
  }]
}`,
    },
    {
      id: 'client-processes-response',
      title: '客户端处理回复',
      description: '服务器接收OpenAI的最终回复并发送给前端',
      entity: 'client',
      action: '处理最终回复',
      details:
        '服务器接收OpenAI的最终回复，将其添加到聊天历史中，并将完整的响应（包括函数调用信息和最终回复）发送回前端。',
      effectFn: () => {
        setActiveEntity('client');
      },
      code: `// 服务器端: 返回结果给前端
res.json({
  success: true,
  type: 'function_result',
  function_calls: processedResponse.calls,
  results: results,
  final_response: finalContent,
});

// 前端: 处理服务器响应
if (data.success) {
  if (data.type === 'text') {
    // 普通文本响应
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: data.content,
        time: getCurrentTime()
      }
    ]);
  } else if (data.type === 'function_result') {
    // 函数调用结果
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: data.final_response,
        time: getCurrentTime(),
        tool_calls: data.function_calls,
        tool_results: data.results
      }
    ]);
  }
}`,
    },
    {
      id: 'frontend-displays-result',
      title: '前端展示结果',
      description: '前端显示AI回复和函数调用信息',
      entity: 'client',
      action: '更新界面',
      details:
        '前端接收服务器的响应，更新聊天界面，显示AI的最终回复和函数调用信息。用户可以看到问题的答案以及系统如何使用外部工具获取信息。',
      effectFn: () => {
        setActiveEntity('client');
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content:
              '根据最新天气预报，明天北京天气将会晴朗，气温约22°C，湿度45%，东北风3级。是个适合外出活动的好天气！',
            time: getCurrentTime(),
            tool_calls: [functionCall],
            tool_results: [functionResult],
          },
        ]);
      },
      code: `// 前端渲染聊天消息和函数调用
function ChatMessage({ message }) {
  // 根据消息类型渲染不同的组件
  if (message.role === 'system') {
    return (
      <div className="text-center text-sm text-muted-foreground py-2">
        {message.content}
      </div>
    );
  }

  // 用户或助手消息
  return (
    <div className={\`flex gap-3 w-full \${message.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
      {/* 消息内容 */}
      <div className={\`flex flex-col gap-1 max-w-[80%]\`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {message.role === 'user' ? '你' : 'AI助手'}
          </span>
          {message.time && (
            <span className="text-xs text-muted-foreground">
              {message.time}
            </span>
          )}
        </div>

        <div className={\`rounded-lg px-4 py-2 max-w-full \${
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }\`}>
          {message.content}
        </div>

        {/* 显示函数调用信息 */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <FunctionCallInfo
            toolCalls={message.tool_calls}
            toolResults={message.tool_results}
          />
        )}
      </div>
    </div>
  );
}`,
    },
    {
      id: 'user-views-response',
      title: '用户查看回答',
      description: '用户查看AI的回答和系统的工具调用过程',
      entity: 'user',
      action: '阅读回答',
      details:
        '用户在聊天界面看到了完整的交互过程，包括他们的问题、系统使用的工具以及基于工具结果生成的最终回答。整个过程对用户来说是无缝的，但他们可以看到系统如何调用外部工具来回答问题。',
      effectFn: () => {
        setActiveEntity('user');
      },
      code: ``,
    },
  ];

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying) return;

    let timer;
    if (currentStep < steps.length - 1) {
      timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, speed * 1000);
    } else {
      setIsPlaying(false);
    }

    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, speed, steps.length]);

  // Run effect when step changes
  useEffect(() => {
    if (steps[currentStep].effectFn) {
      steps[currentStep].effectFn();
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    setMessages([]);
    setFunctionCall(null);
    setFunctionResult(null);
  };

  // Helper function to get current time
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-4">AI聊天流程可视化</h2>
      <p className="text-gray-600 mb-6">从用户输入到OpenAI调用MCP工具的完整流程</p>

      {/* Main visualization area */}
      <div className="grid grid-cols-12 gap-6 min-h-[650px]">
        {/* Left side - Process stages */}
        <div className="col-span-3">
          <Card className="h-full p-4 overflow-auto">
            <h3 className="font-semibold mb-4">
              流程步骤 ({currentStep + 1}/{steps.length})
            </h3>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    index === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : index < currentStep
                      ? 'bg-muted hover:bg-muted/80'
                      : 'bg-muted/50 hover:bg-muted/60'
                  }`}
                  onClick={() => setCurrentStep(index)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {index + 1}. {step.title}
                    </span>
                    <Badge variant={getEntityVariant(step.entity)}>
                      {getEntityLabel(step.entity)}
                    </Badge>
                  </div>
                  <div
                    className={`text-sm mt-1 ${
                      index === currentStep ? 'text-primary-foreground/90' : 'text-muted-foreground'
                    }`}
                  >
                    {step.action}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center - Visualization */}
        <div className="col-span-9">
          <Card className="h-full p-0 overflow-hidden">
            <Tabs defaultValue="visual" className="h-full flex flex-col">
              <div className="px-4 pt-4 border-b">
                <TabsList>
                  <TabsTrigger value="visual">交互式可视化</TabsTrigger>
                  <TabsTrigger value="details">技术细节</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="visual" className="flex-grow overflow-hidden flex flex-col">
                <div className="p-4 pb-2 border-b">
                  <h3 className="font-semibold">{steps[currentStep].title}</h3>
                  <p className="text-muted-foreground text-sm">{steps[currentStep].description}</p>
                </div>

                <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-0.5 overflow-hidden">
                  {/* User Panel */}
                  <div
                    className={`p-4 border-r h-full overflow-auto ${
                      activeEntity === 'user' ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                        <UserIcon />
                      </div>
                      <div className="font-medium">用户</div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {/* Mock user chat interface */}
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <div className="font-medium mb-2">聊天界面</div>

                        {/* Chat messages */}
                        <div className="border rounded-md p-3 bg-white h-64 overflow-auto mb-3">
                          {messages.length === 0 ? (
                            <div className="text-center text-gray-400 mt-20">开始新的对话</div>
                          ) : (
                            <div className="space-y-3">
                              {messages.map((msg, i) => (
                                <div
                                  key={i}
                                  className={`${
                                    msg.role === 'system'
                                      ? 'text-center text-xs text-gray-500 italic py-1'
                                      : `p-2 rounded-lg ${
                                          msg.role === 'user'
                                            ? 'bg-blue-100 ml-auto max-w-[80%]'
                                            : 'bg-gray-100 mr-auto max-w-[80%]'
                                        }`
                                  }`}
                                >
                                  {msg.content}

                                  {/* Simplified function call info */}
                                  {msg.tool_calls && (
                                    <div className="mt-2 text-xs">
                                      <div className="p-2 bg-gray-200 rounded-md">
                                        <div className="font-medium text-blue-800">
                                          使用了工具: {msg.tool_calls[0].function.name}
                                        </div>
                                        {msg.tool_results && (
                                          <div className="mt-1 font-mono text-green-800 truncate">
                                            结果:{' '}
                                            {JSON.stringify(msg.tool_results[0]).substring(0, 50)}
                                            ...
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Input area */}
                        <div className="flex">
                          <input
                            type="text"
                            className="flex-grow border rounded-l-md p-2 text-sm"
                            placeholder="输入消息..."
                            value={userQuestion}
                            onChange={e => setUserQuestion(e.target.value)}
                            disabled={currentStep !== 0}
                          />
                          <button
                            className={`p-2 rounded-r-md ${
                              currentStep === 0
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                            }`}
                            disabled={currentStep !== 0}
                          >
                            <SendIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MCP Panel */}
                  <div
                    className={`p-4 border-r h-full overflow-auto ${
                      activeEntity === 'client' ? 'bg-purple-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-2">
                        <ServerIcon />
                      </div>
                      <div className="font-medium">MCP Client</div>
                    </div>

                    <div className="space-y-3 mt-4">
                      {/* Connected MCPs */}
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <div className="font-medium mb-2">已连接的MCP</div>
                        <div className="border rounded-md p-2 bg-white">
                          <div className="font-medium">WeatherMCP</div>
                          <div className="text-xs text-gray-500">工具: weather</div>
                          <Badge variant="success" className="mt-1">
                            已连接
                          </Badge>
                        </div>
                      </div>

                      {/* Function call processing */}
                      {functionCall && (
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <div className="font-medium mb-2">函数调用</div>
                          <div className="border rounded-md p-2 bg-white">
                            <div className="font-medium text-purple-800">
                              {functionCall.function.name}
                            </div>
                            <div className="text-xs bg-gray-100 p-2 mt-1 font-mono overflow-x-auto">
                              {functionCall.function.arguments}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Function result */}
                      {functionResult && (
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <div className="font-medium mb-2">工具结果</div>
                          <div className="border rounded-md p-2 bg-white">
                            <div className="text-xs bg-gray-100 p-2 font-mono overflow-x-auto">
                              {JSON.stringify(functionResult, null, 2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OpenAI Panel */}
                  <div
                    className={`p-4 h-full overflow-auto ${
                      activeEntity === 'openai' ? 'bg-green-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-2">
                        <AIIcon />
                      </div>
                      <div className="font-medium">OpenAI</div>
                    </div>

                    <div className="space-y-3 mt-4">
                      {/* Current Status */}
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <div className="font-medium mb-2">处理状态</div>
                        <div className="border rounded-md p-2 bg-white">
                          {currentStep < 5 ? (
                            <div className="text-gray-500">等待请求...</div>
                          ) : currentStep === 5 ? (
                            <div className="text-yellow-600">
                              <div className="flex items-center">
                                <span className="mr-2">分析用户问题</span>
                                <div className="w-2 h-2 bg-yellow-600 rounded-full animate-ping"></div>
                              </div>
                              <div className="text-xs mt-1">检测到可能需要天气信息</div>
                            </div>
                          ) : currentStep === 10 ? (
                            <div className="text-yellow-600">
                              <div className="flex items-center">
                                <span className="mr-2">生成最终回答</span>
                                <div className="w-2 h-2 bg-yellow-600 rounded-full animate-ping"></div>
                              </div>
                              <div className="text-xs mt-1">基于工具结果创建回复</div>
                            </div>
                          ) : currentStep > 10 ? (
                            <div className="text-green-600">
                              <div className="flex items-center">
                                <span className="mr-2">回答已生成</span>
                                <CheckIcon />
                              </div>
                              <div className="text-xs mt-1">已返回最终回答</div>
                            </div>
                          ) : (
                            <div className="text-blue-600">
                              <div className="flex items-center">
                                <span className="mr-2">请求函数调用</span>
                                <CheckIcon />
                              </div>
                              <div className="text-xs mt-1">需要获取天气信息</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OpenAI Response */}
                      {currentStep >= 11 && (
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <div className="font-medium mb-2">生成的回答</div>
                          <div className="border rounded-md p-3 bg-white">
                            根据最新天气预报，明天北京天气将会晴朗，气温约22°C，湿度45%，东北风3级。是个适合外出活动的好天气！
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t">
                  <p className="font-medium">当前步骤详情:</p>
                  <p className="text-gray-600 mt-1">{steps[currentStep].details}</p>
                </div>
              </TabsContent>

              <TabsContent value="details" className="overflow-auto p-4">
                <h3 className="font-semibold text-lg mb-4">
                  步骤 {currentStep + 1}: {steps[currentStep].title}
                </h3>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="font-medium mb-2">详细说明</div>
                    <p className="text-gray-600">{steps[currentStep].details}</p>

                    <div className="mt-4">
                      <div className="flex items-center">
                        <Badge
                          variant={getEntityVariant(steps[currentStep].entity)}
                          className="mr-2"
                        >
                          {getEntityLabel(steps[currentStep].entity)}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          执行方 - {steps[currentStep].action}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="font-medium mb-2">流程解析</div>
                      <div className="space-y-3 text-sm">
                        <div className="p-3 bg-blue-50 rounded-md">
                          <div className="font-medium text-blue-800">从用户的角度</div>
                          <p className="mt-1">
                            {currentStep === 0
                              ? '用户提出问题，等待回答'
                              : currentStep === steps.length - 1
                              ? '用户收到回答，包含天气信息'
                              : "系统正在处理，用户看到'AI思考中'的状态"}
                          </p>
                        </div>

                        <div className="p-3 bg-purple-50 rounded-md">
                          <div className="font-medium text-purple-800">从MCP Client的角度</div>
                          <p className="mt-1">
                            {currentStep <= 1
                              ? '接收用户问题，准备处理'
                              : currentStep >= 2 && currentStep <= 4
                              ? '收集可用工具，准备调用OpenAI'
                              : currentStep >= 6 && currentStep <= 9
                              ? '处理函数调用，调用MCP工具，处理结果'
                              : currentStep >= 11
                              ? '处理最终回复，更新UI'
                              : '等待其他组件操作'}
                          </p>
                        </div>

                        <div className="p-3 bg-green-50 rounded-md">
                          <div className="font-medium text-green-800">从OpenAI的角度</div>
                          <p className="mt-1">
                            {currentStep <= 4
                              ? '等待请求'
                              : currentStep === 5
                              ? '分析用户问题，决定使用工具'
                              : currentStep === 10
                              ? '根据工具结果生成最终回答'
                              : '已完成处理'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    {steps[currentStep].code && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="font-medium">代码实现示例</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCode(!showCode)}
                          >
                            {showCode ? '隐藏代码' : '显示代码'}
                          </Button>
                        </div>

                        {showCode && (
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-auto text-sm mt-2 h-72">
                            {steps[currentStep].code}
                          </pre>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center mt-6">
        <div className="flex space-x-4 items-center">
          <Button variant="outline" onClick={handleReset}>
            重置演示
          </Button>

          <div className="flex items-center space-x-2 ml-4">
            <span className="text-sm">速度:</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm">{speed}秒/步</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
            上一步
          </Button>
          <Button variant="outline" onClick={handlePlay}>
            {isPlaying ? '暂停' : '播放'}
          </Button>
          <Button onClick={handleNext} disabled={currentStep === steps.length - 1}>
            下一步
          </Button>
        </div>
      </div>

      {/* Data flow diagram */}
      <Card className="mt-6 p-6">
        <h3 className="font-semibold mb-4">数据流向概览</h3>
        <div className="relative h-40 overflow-hidden">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
            <div className="text-center">
              <UserIcon size={24} className="mx-auto" />
              <div className="mt-1 font-medium">用户</div>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center">
            <div className="text-center">
              <ServerIcon size={24} className="mx-auto" />
              <div className="mt-1 font-medium">MCP</div>
            </div>
          </div>

          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
            <div className="text-center">
              <AIIcon size={24} className="mx-auto" />
              <div className="mt-1 font-medium">OpenAI</div>
            </div>
          </div>

          {/* Arrows */}
          <Arrow
            from="left"
            to="middle"
            label="1. 用户提问"
            position="top"
            active={currentStep >= 0}
          />

          <Arrow
            from="middle"
            to="right"
            label="2. 发送问题+工具列表"
            position="top"
            active={currentStep >= 4}
          />

          <Arrow
            from="right"
            to="middle"
            label="3. 函数调用请求"
            position="bottom"
            active={currentStep >= 5}
          />

          <Arrow
            from="middle"
            to="middle"
            label="4. 调用MCP工具"
            position="center"
            active={currentStep >= 7}
          />

          <Arrow
            from="middle"
            to="right"
            label="5. 发送工具结果"
            position="top"
            active={currentStep >= 9}
          />

          <Arrow
            from="right"
            to="middle"
            label="6. 返回最终回答"
            position="bottom"
            active={currentStep >= 10}
          />

          <Arrow
            from="middle"
            to="left"
            label="7. 显示回答"
            position="bottom"
            active={currentStep >= 11}
          />
        </div>
      </Card>
    </div>
  );
};

// Helper components for visualization
function Arrow({ from, to, label, position, active }) {
  let startX, endX, startY, yOffset;

  // Set positions based on from/to
  if (from === 'left' && to === 'middle') {
    startX = '12%';
    endX = '50%';
  } else if (from === 'middle' && to === 'right') {
    startX = '50%';
    endX = '88%';
  } else if (from === 'right' && to === 'middle') {
    startX = '88%';
    endX = '50%';
  } else if (from === 'middle' && to === 'left') {
    startX = '50%';
    endX = '12%';
  } else if (from === 'middle' && to === 'middle') {
    startX = '48%';
    endX = '52%';
    yOffset = -30;
  }

  // Y position based on position prop
  if (position === 'top') {
    startY = '25%';
  } else if (position === 'bottom') {
    startY = '75%';
  } else if (position === 'center') {
    startY = '50%';
  }

  // Self-referencing arrow
  if (from === 'middle' && to === 'middle') {
    return (
      <div
        className={`absolute transition-opacity duration-300 ${
          active ? 'opacity-100' : 'opacity-20'
        }`}
        style={{ left: startX, top: startY }}
      >
        <div
          className="w-16 h-16 border-2 border-purple-400 rounded-full absolute"
          style={{ borderStyle: 'dashed' }}
        ></div>
        <div className="absolute left-8 -top-6 text-xs text-center w-24 -ml-12">{label}</div>
      </div>
    );
  }

  // Regular arrow
  return (
    <div
      className={`absolute transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-20'
      }`}
      style={{
        left: startX,
        top: startY,
        width: `calc(${endX} - ${startX})`,
        height: '2px',
        background: active ? '#6366F1' : '#D1D5DB',
        transform: from > to ? 'scaleX(-1)' : 'none',
      }}
    >
      <div
        className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2"
        style={{
          borderRight: '2px solid ' + (active ? '#6366F1' : '#D1D5DB'),
          borderBottom: '2px solid ' + (active ? '#6366F1' : '#D1D5DB'),
        }}
      ></div>
      <div
        className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 -rotate-45 w-2 h-2"
        style={{
          borderRight: '2px solid ' + (active ? '#6366F1' : '#D1D5DB'),
          borderTop: '2px solid ' + (active ? '#6366F1' : '#D1D5DB'),
        }}
      ></div>
      <div
        className={`absolute text-xs ${
          position === 'top' ? '-top-6' : '-bottom-6'
        } w-full text-center`}
        style={{ color: active ? '#6366F1' : '#9CA3AF' }}
      >
        {label}
      </div>
    </div>
  );
}

// Helper functions
function getEntityVariant(entity) {
  switch (entity) {
    case 'user':
      return 'default';
    case 'client':
      return 'outline';
    case 'mcp':
      return 'secondary';
    case 'openai':
      return 'success';
    default:
      return 'default';
  }
}

function getEntityLabel(entity) {
  switch (entity) {
    case 'user':
      return '用户';
    case 'client':
      return 'MCP客户端';
    case 'mcp':
      return 'MCP工具';
    case 'openai':
      return 'OpenAI';
    default:
      return entity;
  }
}

// Icon components
function UserIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ServerIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6" y1="6" y2="6" />
      <line x1="6" x2="6" y1="18" y2="18" />
    </svg>
  );
}

function AIIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2a8 8 0 0 1 8 8v1h-2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V11H4v-1a8 8 0 0 1 8-8Z" />
      <path d="M10 14v-3" />
      <path d="M14 14v-3" />
      <path d="M10 8v.01" />
      <path d="M14 8v.01" />
    </svg>
  );
}

function SendIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function CheckIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default ChatFlowVisualization;
