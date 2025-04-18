#!/usr/bin/env node

/**
 * 示例第三方MCP服务
 * 实现基于stdio的MCP协议
 *
 * 可以通过以下方式使用：
 * 1. 通过npm全局安装：npm install -g external-mcp-service
 *    然后运行：external-mcp
 *
 * 2. 通过npx临时运行：npx external-mcp-service
 *
 * 3. 直接在MCP客户端中通过命令调用：npx external-mcp-service
 */

// 处理标准输入输出
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// 加载所有工具 - 增加容错性
const tools = {};

// 安全加载工具函数
function safeRequire(modulePath, toolName) {
  try {
    const tool = require(modulePath);
    console.error(`成功加载工具: ${toolName}`);
    return tool;
  } catch (error) {
    console.error(`加载工具 ${toolName} 失败: ${error.message}`);
    // 返回一个简单的工具占位符
    return {
      name: toolName,
      description: `${toolName} (加载失败)`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => ({
        error: '工具加载失败',
        message: `工具 ${toolName} 加载时出错: ${error.message}`,
      }),
    };
  }
}

// 尝试加载所有工具
try {
  // 图像生成工具
  const imageGenTool = safeRequire('./tools/image-gen', 'image-gen');
  tools['image-gen'] = imageGenTool;

  // 翻译工具
  const translationTool = safeRequire('./tools/translation', 'translation');
  tools['translation'] = translationTool;

  // 分析工具
  const analysisTool = safeRequire('./tools/analysis', 'analysis');
  tools['analysis'] = analysisTool;

  // 推特工具
  const tweetTool = safeRequire('./tools/twitter-feed', 'tweet-feed');
  tools['tweet-feed'] = tweetTool;

  // 股票相关工具
  const stockQuoteTool = safeRequire('./tools/stock-quote', 'stock-quote');
  tools['stock-quote'] = stockQuoteTool;

  const stockHistoryTool = safeRequire('./tools/stock-history', 'stock-history');
  tools['stock-history'] = stockHistoryTool;

  const marketTrendingTool = safeRequire('./tools/market-trending', 'market-trending');
  tools['market-trending'] = marketTrendingTool;

  const stockSearchTool = safeRequire('./tools/stock-search', 'stock-search');
  tools['stock-search'] = stockSearchTool;

  const stockOptionsTool = safeRequire('./tools/stock-options', 'stock-options');
  tools['stock-options'] = stockOptionsTool;

  console.error(`成功加载 ${Object.keys(tools).length} 个工具`);
} catch (error) {
  console.error('加载工具过程中发生错误:', error);
}

// 请求ID计数器
let requestIdCounter = 1;

// 记录活跃请求
const activeRequests = new Map();

// 输出初始化信息，包含可用工具
function sendInitializationResponse() {
  const toolList = Object.entries(tools).map(([id, tool]) => ({
    name: id,
    description: tool.description,
    parameters: tool.parameters || {
      type: 'object',
      properties: {},
      required: [],
    },
  }));

  const response = {
    tools: toolList,
  };

  console.log(JSON.stringify(response));
}

// 处理工具调用请求
async function handleRequest(request) {
  const { id, tool: toolName, params } = request;

  try {
    // 检查工具是否存在
    if (!tools[toolName]) {
      return sendResponse(id, { error: `未知工具: ${toolName}` }, true);
    }

    // 调用工具
    const result = await tools[toolName].execute(params);
    return sendResponse(id, { result }, false);
  } catch (error) {
    return sendResponse(id, { error: error.message }, true);
  }
}

// 发送响应
function sendResponse(requestId, data, isError) {
  const response = {
    id: requestId,
    type: 'response',
    status: isError ? 'error' : 'success',
    ...data,
  };

  console.log(JSON.stringify(response));
}

// 处理输入
rl.on('line', async line => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);

    // 生成请求ID
    const requestId = request.id || `req_${requestIdCounter++}`;

    // 设置请求类型
    request.type = request.type || 'call';

    // 处理不同类型的请求
    if (request.type === 'call') {
      // 调用工具
      activeRequests.set(requestId, request);
      await handleRequest({ ...request, id: requestId });
      activeRequests.delete(requestId);
    } else {
      // 其他类型请求
      sendResponse(requestId, { error: `不支持的请求类型: ${request.type}` }, true);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'error',
        error: `请求处理错误: ${error.message}`,
      }),
    );
  }
});

// 处理退出信号
process.on('SIGINT', () => {
  console.error(JSON.stringify({ type: 'exit', reason: 'SIGINT' }));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error(JSON.stringify({ type: 'exit', reason: 'SIGTERM' }));
  process.exit(0);
});

// 如果是直接运行，显示启动消息
if (require.main === module) {
  console.error('MCP服务已启动，等待输入...');
}

// 发送初始化响应，标记服务准备就绪
sendInitializationResponse();
