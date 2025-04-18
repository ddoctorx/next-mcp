// 加载环境变量 - 必须在最顶部
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');
const tools = require('./tools');
const openai = require('./openai');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// 存储所有会话和MCP连接
const sessions = {};

// 存储聊天历史
const chatHistories = {};

// 创建新会话
function createSession(userId) {
  const sessionId = uuidv4();
  sessions[sessionId] = {
    id: sessionId,
    userId,
    mcpSessions: {},
    createdAt: new Date(),
  };
  return sessionId;
}

// 从MCP进程获取工具列表
async function getToolsFromProcess(process) {
  return new Promise((resolve, reject) => {
    // 设置超时
    const timeout = setTimeout(() => {
      reject(new Error('获取工具列表超时'));
    }, 10000); // 增加超时时间到10秒

    let buffer = '';
    let errorBuffer = '';

    // 监听stderr以捕获错误
    const errorHandler = data => {
      errorBuffer += data.toString();
      console.error(`工具列表获取错误输出: ${data.toString()}`);
    };

    // 监听进程输出
    const dataHandler = data => {
      buffer += data.toString();
      console.log(`接收到MCP数据: ${data.toString()}`);

      try {
        // 尝试解析JSON响应
        // 可能有多行输出，逐行处理
        const lines = buffer.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            // 检查是否包含工具列表
            if (response.tools) {
              clearTimeout(timeout);
              process.stdout.removeListener('data', dataHandler);
              process.stderr.removeListener('data', errorHandler);
              console.log(`成功解析工具列表: ${JSON.stringify(response.tools)}`);
              resolve(response.tools);
              return;
            }
          } catch (lineError) {
            // 这一行不是有效的JSON，继续处理下一行
            console.log(`尝试解析行失败，继续处理: ${line}`);
          }
        }
      } catch (e) {
        // 继续收集数据，直到收到完整JSON
        console.log(`解析输出失败，继续等待: ${e.message}`);
      }
    };

    process.stdout.on('data', dataHandler);
    process.stderr.on('data', errorHandler);

    // 添加进程错误和退出处理
    process.on('error', err => {
      clearTimeout(timeout);
      process.stdout.removeListener('data', dataHandler);
      process.stderr.removeListener('data', errorHandler);
      reject(new Error(`获取工具列表时进程错误: ${err.message}`));
    });

    process.on('exit', code => {
      if (code !== 0) {
        clearTimeout(timeout);
        process.stdout.removeListener('data', dataHandler);
        process.stderr.removeListener('data', errorHandler);
        reject(new Error(`进程非正常退出，退出码: ${code}，错误: ${errorBuffer}`));
      }
    });
  });
}

// 调用远程MCP工具
async function callRemoteMcpTool(mcpSession, toolName, params) {
  console.log(`准备调用远程MCP工具: ${toolName}, 参数:`, params);

  return new Promise((resolve, reject) => {
    // 检查MCP会话是否有效且有进程对象
    if (!mcpSession) {
      console.error(`无效的MCP会话`);
      return reject(new Error('无效的MCP会话'));
    }

    if (!mcpSession.process) {
      console.error(`MCP会话没有有效的进程对象`);
      return reject(new Error('MCP会话没有有效的进程对象'));
    }

    if (!toolName) {
      console.error(`工具名称不能为空`);
      return reject(new Error('工具名称不能为空'));
    }

    // 确保params是对象
    const safeParams = params && typeof params === 'object' ? params : {};

    // 设置超时
    const timeout = setTimeout(() => {
      console.error(`工具调用超时: ${toolName}`);
      reject(new Error('工具调用超时'));
    }, 30000);

    // 生成请求ID
    const requestId = `req_${Date.now()}`;

    // 构建请求 - 确保正确使用tool字段作为工具名称，params字段作为参数
    const request = {
      id: requestId,
      type: 'call',
      tool: toolName, // 工具名称正确放在tool字段
      params: safeParams, // 参数正确放在params字段
    };

    console.log(`发送调用请求: ${requestId}`, JSON.stringify(request, null, 2));

    let buffer = '';
    let errorOutput = '';

    // 监听进程的错误输出
    const errorHandler = data => {
      const errorData = data.toString();
      errorOutput += errorData;
      console.error(`工具 ${toolName} 错误输出:`, errorData);
    };

    // 监听进程输出
    const dataHandler = data => {
      const chunk = data.toString();
      buffer += chunk;
      console.log(`收到工具 ${toolName} 输出:`, chunk);

      try {
        // 尝试逐行解析 - 可能有多行输出
        const lines = buffer.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const response = JSON.parse(line);

            // 检查是否匹配当前请求ID
            if (response.id === requestId) {
              clearTimeout(timeout);
              mcpSession.process.stdout.removeListener('data', dataHandler);
              mcpSession.process.stderr.removeListener('data', errorHandler);

              if (response.status === 'error') {
                console.error(`工具 ${toolName} 返回错误:`, response.error);
                reject(new Error(response.error || '工具调用失败'));
              } else {
                console.log(`工具 ${toolName} 调用成功`);
                resolve(response.result);
              }
              return;
            }
          } catch (lineError) {
            // 这行不是有效的JSON或不匹配当前请求，继续
            console.log(`解析输出行失败，继续尝试: ${line}`);
          }
        }
      } catch (e) {
        // 继续收集数据，直到收到完整JSON
        console.log(`解析输出失败，继续等待更多数据: ${e.message}`);
      }
    };

    // 设置错误处理
    mcpSession.process.on('error', error => {
      clearTimeout(timeout);
      mcpSession.process.stdout.removeListener('data', dataHandler);
      mcpSession.process.stderr.removeListener('data', errorHandler);
      console.error(`工具 ${toolName} 调用过程发生错误:`, error);
      reject(new Error(`MCP进程错误: ${error.message}`));
    });

    // 监听输出
    mcpSession.process.stdout.on('data', dataHandler);
    mcpSession.process.stderr.on('data', errorHandler);

    // 发送请求
    try {
      mcpSession.process.stdin.write(JSON.stringify(request) + '\n');
      console.log(`已发送请求到MCP进程`);
    } catch (writeError) {
      clearTimeout(timeout);
      mcpSession.process.stdout.removeListener('data', dataHandler);
      mcpSession.process.stderr.removeListener('data', errorHandler);
      console.error(`向MCP发送请求失败:`, writeError);
      reject(new Error(`发送请求失败: ${writeError.message}`));
    }
  });
}

// 自动检测和添加本地工具
function getLocalTools() {
  return tools.getToolDefinitions();
}

// MCP连接处理函数
async function connectStdioMcp(sessionId, name, command) {
  if (!sessions[sessionId]) {
    console.log(`会话不存在: ${sessionId}，自动创建新会话`);
    sessionId = createSession('anonymous');
    console.log(`已创建新会话: ${sessionId}`);
  }

  if (sessions[sessionId].mcpSessions[name]) {
    disconnectMcp(sessionId, name);
  }

  console.log(`尝试连接MCP: ${name}, 命令: ${command}, 会话ID: ${sessionId}`);

  try {
    // 解析命令
    const parts = command.trim().split(' ');
    const executableCmd = parts[0];
    const args = parts.slice(1);

    console.log(`执行命令: ${executableCmd}, 参数: ${args.join(' ')}`);

    // 检查命令是否在允许的列表中（这里简化处理）
    const allowedExecutables = ['node', 'npm', 'npx', 'python', 'python3'];
    const baseCmd = executableCmd.split('/').pop().split('\\').pop();

    // 允许直接执行js文件
    if (!allowedExecutables.includes(baseCmd) && !baseCmd.endsWith('.js')) {
      console.error(`命令不在允许列表中: ${baseCmd}`);
      return {
        success: false,
        error: `命令 ${baseCmd} 不在允许的列表中`,
      };
    }

    // 创建子进程
    console.log(`启动子进程: ${executableCmd} ${args.join(' ')}`);

    try {
      const process = spawn(executableCmd, args);

      process.on('error', error => {
        console.error(`进程启动错误: ${error.message}`);
      });

      // 处理进程退出
      process.on('exit', code => {
        console.log(`MCP进程退出，退出码: ${code}`);
        if (sessions[sessionId]?.mcpSessions[name]) {
          sessions[sessionId].mcpSessions[name].status = 'failed';
          // 通知客户端
          io.to(sessionId).emit('mcp_status_changed', {
            name,
            status: 'failed',
          });
        }
      });

      // 更详细的日志
      process.stdout.on('data', data => {
        console.log(`MCP 输出: ${data.toString()}`);
      });

      // 日志处理
      process.stderr.on('data', data => {
        console.error(`MCP错误输出: ${data}`);
      });

      // 尝试获取工具列表
      let toolsList;
      try {
        // 尝试从MCP服务获取工具列表
        console.log('等待获取工具列表...');
        toolsList = await getToolsFromProcess(process);
        console.log(`从MCP获取的工具列表:`, toolsList);
      } catch (error) {
        console.error(`无法从MCP获取工具列表: ${error.message}`);
        // 如果无法从MCP获取工具列表，使用本地工具列表
        toolsList = getLocalTools();
        console.log('使用本地工具列表:', toolsList);
      }

      // 存储MCP会话
      sessions[sessionId].mcpSessions[name] = {
        name,
        process,
        clientType: 'stdio',
        command,
        tools: toolsList,
        status: 'connected',
        createdAt: new Date(),
        isExternal: true, // 标记为外部MCP
      };

      console.log(`MCP添加成功: ${name}`);
      return {
        success: true,
        mcp: {
          name,
          clientType: 'stdio',
          command,
          tools: toolsList,
          status: 'connected',
        },
      };
    } catch (spawnError) {
      console.error(`子进程创建失败: ${spawnError.message}`);
      return {
        success: false,
        error: `创建MCP进程失败: ${spawnError.message}`,
      };
    }
  } catch (error) {
    console.error('MCP连接错误:', error);
    return {
      success: false,
      error: `无法连接到MCP: ${error.message}`,
    };
  }
}

function connectSseMcp(sessionId, name, url) {
  if (!sessions[sessionId]) {
    console.log(`会话不存在: ${sessionId}，自动创建新会话`);
    sessionId = createSession('anonymous');
    console.log(`已创建新会话: ${sessionId}`);
  }

  if (sessions[sessionId].mcpSessions[name]) {
    disconnectMcp(sessionId, name);
  }

  try {
    // 获取本地工具定义（SSE类型需要实现RESTful API）
    const toolsList = getLocalTools();

    sessions[sessionId].mcpSessions[name] = {
      name,
      url,
      clientType: 'sse',
      tools: toolsList,
      status: 'connected',
      createdAt: new Date(),
      isExternal: false, // 目前SSE还不支持真实外部MCP
    };

    return {
      success: true,
      mcp: {
        name,
        clientType: 'sse',
        url,
        tools: toolsList,
        status: 'connected',
      },
    };
  } catch (error) {
    console.error('SSE MCP连接错误:', error);
    return {
      success: false,
      error: `无法连接到SSE MCP: ${error.message}`,
    };
  }
}

function disconnectMcp(sessionId, name) {
  if (!sessions[sessionId] || !sessions[sessionId].mcpSessions[name]) {
    return { success: false, error: 'MCP会话不存在' };
  }

  try {
    const mcpSession = sessions[sessionId].mcpSessions[name];

    // 如果是stdio类型，终止进程
    if (mcpSession.clientType === 'stdio' && mcpSession.process) {
      mcpSession.process.kill();
    }

    // 从会话中删除MCP
    delete sessions[sessionId].mcpSessions[name];

    return { success: true };
  } catch (error) {
    console.error('断开MCP错误:', error);
    return {
      success: false,
      error: `无法断开MCP连接: ${error.message}`,
    };
  }
}

// API端点
app.post('/api/session', (req, res) => {
  const { userId } = req.body;
  const sessionId = createSession(userId || 'anonymous');
  res.json({ success: true, sessionId });
});

app.post('/api/mcp', async (req, res) => {
  const { sessionId, name, clientType, url, fullCommand } = req.body;

  console.log('收到添加MCP请求:', {
    sessionId,
    name,
    clientType,
    url: url ? '有值' : undefined,
    fullCommand: fullCommand ? '有值' : undefined,
  });

  if (!sessionId || !name || !clientType) {
    const missingParams = [];
    if (!sessionId) missingParams.push('sessionId');
    if (!name) missingParams.push('name');
    if (!clientType) missingParams.push('clientType');

    console.error(`缺少必要参数: ${missingParams.join(', ')}`);
    return res.status(400).json({
      success: false,
      error: `缺少必要参数: ${missingParams.join(', ')}`,
    });
  }

  // 始终验证会话是否存在，如果不存在则自动创建
  let actualSessionId = sessionId;
  if (!sessions[sessionId]) {
    console.log(`会话 ${sessionId} 不存在，自动创建新会话`);
    actualSessionId = createSession('anonymous');
    console.log(`已创建新会话: ${actualSessionId}`);
  }

  let result;
  try {
    if (clientType === 'stdio') {
      if (!fullCommand) {
        console.error('缺少命令参数');
        return res.status(400).json({
          success: false,
          error: '缺少命令参数',
        });
      }
      console.log(`开始连接stdio MCP: ${name}, 命令: ${fullCommand}`);
      result = await connectStdioMcp(actualSessionId, name, fullCommand);
    } else if (clientType === 'sse') {
      if (!url) {
        console.error('缺少URL参数');
        return res.status(400).json({
          success: false,
          error: '缺少URL参数',
        });
      }
      console.log(`开始连接sse MCP: ${name}, URL: ${url}`);
      result = connectSseMcp(actualSessionId, name, url);
    } else {
      console.error(`不支持的MCP类型: ${clientType}`);
      return res.status(400).json({
        success: false,
        error: `不支持的MCP类型: ${clientType}`,
      });
    }

    if (result instanceof Promise) {
      // 处理异步结果
      try {
        const actualResult = await result;
        console.log(`MCP连接结果:`, actualResult);

        if (actualResult.success) {
          // 通知所有连接的客户端
          io.to(actualSessionId).emit('mcp_connected', actualResult.mcp);

          // 如果使用了新会话，返回新会话ID
          if (actualSessionId !== sessionId) {
            actualResult.newSessionId = actualSessionId;
          }

          res.json(actualResult);
        } else {
          console.error(`MCP连接失败:`, actualResult.error);
          res.status(400).json(actualResult);
        }
      } catch (asyncError) {
        console.error(`处理异步MCP连接结果时出错:`, asyncError);
        res.status(500).json({
          success: false,
          error: `MCP连接失败: ${asyncError.message}`,
        });
      }
    } else {
      // 处理同步结果
      console.log(`MCP连接结果:`, result);

      if (result.success) {
        // 通知所有连接的客户端
        io.to(actualSessionId).emit('mcp_connected', result.mcp);

        // 如果使用了新会话，返回新会话ID
        if (actualSessionId !== sessionId) {
          result.newSessionId = actualSessionId;
        }

        res.json(result);
      } else {
        console.error(`MCP连接失败:`, result.error);
        res.status(400).json(result);
      }
    }
  } catch (error) {
    console.error(`处理MCP请求时出错:`, error);
    res.status(500).json({
      success: false,
      error: `添加MCP服务失败: ${error.message}`,
    });
  }
});

// 创建一个适配器函数，用于处理OpenAI函数调用和远程MCP工具调用之间的参数差异
async function mcpToolAdapter(sessionId, mcpName, toolName, params) {
  console.log(
    `准备调用MCP工具: sessionId=${sessionId}, mcpName=${mcpName}, toolName=${toolName}, 参数:`,
    JSON.stringify(params, null, 2),
  );

  if (!sessions[sessionId] || !sessions[sessionId].mcpSessions[mcpName]) {
    console.error(`找不到MCP会话: ${mcpName}`);
    throw new Error(`找不到MCP会话: ${mcpName}`);
  }

  // 获取工具定义，以检查参数规范
  const mcpSession = sessions[sessionId].mcpSessions[mcpName];
  const toolDef = mcpSession.tools.find(t => t.name === toolName);

  if (!toolDef) {
    console.error(`找不到工具定义: ${toolName}`);
    throw new Error(`在MCP ${mcpName} 中找不到工具 ${toolName}`);
  }

  // 确保参数是对象
  const safeParams = params && typeof params === 'object' ? params : {};

  // 记录工具定义信息，帮助调试
  console.log(`工具 ${toolName} 的定义:`, {
    名称: toolDef.name,
    描述: toolDef.description,
    参数规范: toolDef.parameters,
  });

  // 处理必需参数检查，确保工具执行正确
  if (toolDef.parameters && toolDef.parameters.required && toolDef.parameters.required.length > 0) {
    // 记录需要的必需参数
    console.log(`工具 ${toolName} 需要的必需参数:`, toolDef.parameters.required);

    // 检查必需参数是否提供
    const missingParams = toolDef.parameters.required.filter(
      param =>
        safeParams[param] === undefined || safeParams[param] === null || safeParams[param] === '',
    );

    if (missingParams.length > 0) {
      console.warn(`调用工具 ${toolName} 缺少必需参数: ${missingParams.join(', ')}`);
      // 添加更多详细的警告信息，但仍然允许工具自行处理
      console.warn(`缺少的参数可能导致工具无法正常工作，继续尝试调用`);

      // 对于图像生成等特殊工具，可以添加一些默认值
      if (toolName === 'image-gen' && missingParams.includes('prompt')) {
        console.warn(`图像生成工具缺少必要的prompt参数，返回错误信息`);
        return {
          error: '缺少必需参数',
          message: '图像生成需要提供prompt参数，请提供描述图像内容的文本',
        };
      }
    }
  }

  try {
    // 调用远程MCP工具，确保正确传递参数
    console.log(`最终传递给工具 ${toolName} 的参数:`, JSON.stringify(safeParams, null, 2));
    const result = await callRemoteMcpTool(mcpSession, toolName, safeParams);
    return result;
  } catch (error) {
    console.error(`调用工具 ${toolName} 时发生错误:`, error);
    throw error; // 继续抛出错误，让上层处理
  }
}

// 工具调用API端点
app.post('/api/mcp/call', async (req, res) => {
  const { sessionId, mcpName, tool, params } = req.body;

  console.log(`收到工具调用请求:`, {
    sessionId,
    mcpName,
    tool,
    params: params ? '参数存在' : '无参数',
  });

  if (params) {
    console.log(`工具调用参数详情:`, JSON.stringify(params, null, 2));
  }

  if (!sessionId || !mcpName || !tool) {
    const missingParams = [];
    if (!sessionId) missingParams.push('sessionId');
    if (!mcpName) missingParams.push('mcpName');
    if (!tool) missingParams.push('tool');

    console.error(`工具调用 - 缺少必要参数: ${missingParams.join(', ')}`);
    return res.status(400).json({
      success: false,
      error: `缺少必要参数: ${missingParams.join(', ')}`,
    });
  }

  // 检查会话是否存在，如果不存在则自动创建
  let actualSessionId = sessionId;
  if (!sessions[sessionId]) {
    console.log(`工具调用 - 会话 ${sessionId} 不存在，自动创建新会话`);
    actualSessionId = createSession('anonymous');
    console.log(`已创建新会话: ${actualSessionId}`);

    // 检查是否有任何MCP连接到了旧会话
    // 遍历所有会话查找匹配的MCP名称
    let foundMcp = false;
    let foundSessionId = null;

    Object.keys(sessions).forEach(sid => {
      if (sessions[sid].mcpSessions && sessions[sid].mcpSessions[mcpName]) {
        foundMcp = true;
        foundSessionId = sid;
      }
    });

    if (foundMcp) {
      console.log(`在会话 ${foundSessionId} 中找到了名为 ${mcpName} 的MCP，使用此会话`);
      actualSessionId = foundSessionId;
    } else {
      // 如果创建了新会话，但没有找到请求的MCP，返回错误
      console.error(`找不到名为 ${mcpName} 的MCP会话`);
      return res.status(400).json({
        success: false,
        error: '找不到指定的MCP会话，已创建新会话，请先连接MCP',
        newSessionId: actualSessionId,
      });
    }
  }

  if (!sessions[actualSessionId].mcpSessions[mcpName]) {
    console.error(`在会话 ${actualSessionId} 中找不到名为 ${mcpName} 的MCP`);

    // 尝试在其他会话中查找相同名称的MCP
    let foundMcp = false;
    let foundSessionId = null;

    Object.keys(sessions).forEach(sid => {
      if (sessions[sid].mcpSessions && sessions[sid].mcpSessions[mcpName]) {
        foundMcp = true;
        foundSessionId = sid;
      }
    });

    if (foundMcp) {
      console.log(`在会话 ${foundSessionId} 中找到了名为 ${mcpName} 的MCP，使用此会话`);
      actualSessionId = foundSessionId;
    } else {
      return res.status(400).json({
        success: false,
        error: `找不到名为 ${mcpName} 的MCP会话`,
        availableMcps: Object.keys(sessions[actualSessionId].mcpSessions),
      });
    }
  }

  try {
    const mcpSession = sessions[actualSessionId].mcpSessions[mcpName];
    console.log(`使用会话 ${actualSessionId} 的 ${mcpName} MCP调用工具 ${tool}`);

    // 确保参数是一个有效的对象
    const safeParams = params && typeof params === 'object' ? params : {};

    // 获取工具定义以验证参数
    const toolDef = mcpSession.tools.find(t => t.name === tool);

    if (toolDef && toolDef.parameters && toolDef.parameters.required) {
      const missingParams = toolDef.parameters.required.filter(
        param =>
          safeParams[param] === undefined || safeParams[param] === null || safeParams[param] === '',
      );

      if (missingParams.length > 0) {
        console.warn(`工具 ${tool} 缺少必需参数: ${missingParams.join(', ')}`);
      }
    }

    let result;

    if (mcpSession.isExternal && mcpSession.clientType === 'stdio') {
      // 如果是外部MCP，调用远程工具
      console.log(`调用外部工具: ${tool}，参数:`, JSON.stringify(safeParams, null, 2));
      result = await callRemoteMcpTool(mcpSession, tool, safeParams);
    } else {
      // 否则调用本地工具
      console.log(`调用本地工具: ${tool}，参数:`, JSON.stringify(safeParams, null, 2));
      result = await tools.executeToolCall(tool, safeParams);
    }

    console.log(`工具调用成功: ${tool}，结果:`, result);

    // 如果使用的是重定向的会话ID，在返回结果中包含
    const response = {
      success: true,
      result,
    };

    if (actualSessionId !== sessionId) {
      response.sessionId = actualSessionId;
    }

    res.json(response);
  } catch (error) {
    console.error(`工具调用失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `工具调用失败: ${error.message}`,
    });
  }
});

// 初始化聊天历史
function initChatHistory(sessionId) {
  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [];
  }
  return chatHistories[sessionId];
}

// 聊天API端点
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  console.log(`收到聊天请求:`, { sessionId, message: message ? '消息存在' : '无消息' });

  if (!sessionId || !message) {
    const missingParams = [];
    if (!sessionId) missingParams.push('sessionId');
    if (!message) missingParams.push('message');

    console.error(`聊天API - 缺少必要参数: ${missingParams.join(', ')}`);
    return res.status(400).json({
      success: false,
      error: `缺少必要参数: ${missingParams.join(', ')}`,
    });
  }

  // 检查会话是否存在
  if (!sessions[sessionId]) {
    console.error(`聊天API - 会话不存在: ${sessionId}`);
    return res.status(404).json({
      success: false,
      error: '会话不存在',
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

    // 准备工具列表
    const allTools = [];
    const mcpSessions = sessions[sessionId].mcpSessions;

    // 收集所有MCP工具并转换为OpenAI格式
    for (const mcpName in mcpSessions) {
      const mcpSession = mcpSessions[mcpName];
      if (mcpSession.tools && mcpSession.tools.length > 0) {
        const openaiTools = openai.convertMcpToolsToOpenAIFormat(mcpSession.tools);
        allTools.push(...openaiTools);
      }
    }

    console.log(`为会话 ${sessionId} 找到 ${allTools.length} 个工具`);

    // 调用OpenAI API
    const response = await openai.callChatCompletion(
      chatHistory,
      allTools.length > 0 ? allTools : null,
    );

    // 处理OpenAI响应，包括可能的函数调用
    const processedResponse = await openai.handleFunctionCalling(
      response,
      sessionId,
      mcpSessions,
      mcpToolAdapter,
    );

    // 根据响应类型处理
    if (processedResponse.type === 'text') {
      // 添加助手回复到聊天历史
      chatHistory.push({
        role: 'assistant',
        content: processedResponse.content,
      });

      res.json({
        success: true,
        type: 'text',
        content: processedResponse.content,
      });
    } else if (processedResponse.type === 'function_call') {
      // 处理函数调用的情况

      // 记录函数调用到聊天历史
      chatHistory.push({
        role: 'assistant',
        content: null,
        tool_calls: processedResponse.calls,
      });

      // 添加函数结果到聊天历史
      for (const result of processedResponse.results) {
        chatHistory.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.result,
        });
      }

      // 继续与模型对话，将函数结果传回
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

        res.json({
          success: true,
          type: 'function_result',
          function_calls: processedResponse.calls,
          results: processedResponse.results,
          final_response: finalContent,
        });
      } else {
        throw new Error('无法获取模型的最终回复');
      }
    }
  } catch (error) {
    console.error('聊天API错误:', error);
    res.status(500).json({
      success: false,
      error: `聊天失败: ${error.message}`,
    });
  }
});

// 获取聊天历史API端点
app.get('/api/chat/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: '缺少会话ID',
    });
  }

  if (!chatHistories[sessionId]) {
    return res.json({
      success: true,
      history: [],
    });
  }

  res.json({
    success: true,
    history: chatHistories[sessionId],
  });
});

// 清除聊天历史API端点
app.delete('/api/chat/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: '缺少会话ID',
    });
  }

  if (chatHistories[sessionId]) {
    delete chatHistories[sessionId];
  }

  res.json({
    success: true,
    message: '聊天历史已清除',
  });
});

app.delete('/api/mcp', (req, res) => {
  const { sessionId, name } = req.body;

  if (!sessionId || !name) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数',
    });
  }

  const result = disconnectMcp(sessionId, name);

  if (result.success) {
    // 通知所有连接的客户端
    io.to(sessionId).emit('mcp_disconnected', { name });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.get('/api/mcp', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({
      success: false,
      error: '会话不存在',
    });
  }

  const mcpList = Object.values(sessions[sessionId].mcpSessions).map(mcp => ({
    name: mcp.name,
    clientType: mcp.clientType,
    tools: mcp.tools,
    status: mcp.status,
    command: mcp.command,
    url: mcp.url,
    isExternal: mcp.isExternal,
  }));

  res.json({ success: true, mcps: mcpList });
});

// 测试OpenAI函数调用的API端点
app.post('/api/test/function-call', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: sessionId和message',
    });
  }

  try {
    // 检查会话是否存在
    if (!sessions[sessionId]) {
      return res.status(404).json({
        success: false,
        error: '会话不存在',
      });
    }

    console.log('====== 测试函数调用 ======');
    console.log(`会话ID: ${sessionId}`);
    console.log(`消息: ${message}`);

    // 准备工具列表
    const allTools = [];
    const mcpSessions = sessions[sessionId].mcpSessions;

    // 收集所有MCP工具并转换为OpenAI格式
    for (const mcpName in mcpSessions) {
      const mcpSession = mcpSessions[mcpName];
      if (mcpSession.tools && mcpSession.tools.length > 0) {
        const openaiTools = openai.convertMcpToolsToOpenAIFormat(mcpSession.tools);
        allTools.push(...openaiTools);
      }
    }

    console.log(`找到 ${allTools.length} 个工具，可供函数调用`);

    // 仅使用工具，构建消息
    const messages = [
      {
        role: 'system',
        content:
          '你是一个能够调用工具的AI助手。当用户请求需要使用工具解决的任务时，请优先使用可用的工具。',
      },
      {
        role: 'user',
        content: message,
      },
    ];

    // 强制使用函数调用(如果有工具的话)
    const toolChoice = allTools.length > 0 ? 'auto' : 'none';

    // 调用OpenAI API
    const response = await openai.callChatCompletion(
      messages,
      allTools.length > 0 ? allTools : null,
      toolChoice,
    );

    // 处理OpenAI响应
    const processedResponse = await openai.handleFunctionCalling(
      response,
      sessionId,
      mcpSessions,
      mcpToolAdapter,
    );

    // 处理函数调用结果并获取最终答案
    if (processedResponse.type === 'function_call') {
      console.log('函数调用成功，准备发送结果回OpenAI获取最终回答');

      // 添加函数调用到消息历史
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: processedResponse.calls,
      });

      // 添加所有工具调用结果到消息历史
      for (const result of processedResponse.results) {
        messages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.result,
        });
      }

      // 再次调用OpenAI，将工具结果传回给模型
      console.log('向OpenAI发送工具调用结果...');
      const followUpResponse = await openai.callChatCompletion(messages);

      // 确保返回的是文本内容
      if (
        followUpResponse.choices &&
        followUpResponse.choices[0] &&
        followUpResponse.choices[0].message
      ) {
        const finalContent = followUpResponse.choices[0].message.content;

        // 添加最终回复
        messages.push({
          role: 'assistant',
          content: finalContent,
        });

        // 返回完整结果
        return res.json({
          success: true,
          type: 'function_result',
          function_calls: processedResponse.calls,
          results: processedResponse.results,
          final_response: finalContent,
          messages: messages,
        });
      } else {
        throw new Error('无法获取模型的最终回复');
      }
    }

    // 返回处理结果(非函数调用情况)
    res.json({
      success: true,
      type: 'text',
      content: processedResponse.content,
      response: processedResponse,
      messages: messages,
    });
  } catch (error) {
    console.error('测试函数调用失败:', error);
    res.status(500).json({
      success: false,
      error: `测试失败: ${error.message}`,
    });
  }
});

// WebSocket连接
io.on('connection', socket => {
  console.log('客户端已连接:', socket.id);

  socket.on('join_session', sessionId => {
    if (sessions[sessionId]) {
      socket.join(sessionId);
      console.log(`客户端 ${socket.id} 加入会话 ${sessionId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('客户端已断开连接:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器已启动，端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 管理您的MCP`);
});
