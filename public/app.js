// 常量和设置
const API_BASE_URL = '/api';
let sessionId = null;
let socket = null;
let mcpList = [];

// MCP预设配置
const MCP_PRESETS = {
  'amap-maps': {
    name: '高德地图 MCP',
    command: 'npx',
    args: ['-y', '@amap/amap-maps-mcp-server'],
    env: {
      AMAP_MAPS_API_KEY: '您在高德官网上申请的key',
    },
  },
  stripe: {
    name: 'Stripe MCP',
    command: 'npx',
    args: ['-y', '@stripe/mcp-server'],
    env: {
      STRIPE_API_KEY: '您的Stripe API密钥',
    },
  },
  openai: {
    name: 'OpenAI MCP',
    command: 'npx',
    args: ['-y', '@openai/mcp-server'],
    env: {
      OPENAI_API_KEY: '您的OpenAI API密钥',
    },
  },
};

// 事件总线模块
const eventBus = (() => {
  const events = {};

  function init() {
    // 初始化事件总线
  }

  function on(eventName, callback) {
    if (!events[eventName]) {
      events[eventName] = [];
    }
    events[eventName].push(callback);
  }

  function emit(eventName, data) {
    if (events[eventName]) {
      events[eventName].forEach(callback => {
        callback(data);
      });
    }
  }

  return {
    init,
    on,
    emit,
  };
})();

// 提示消息管理模块
const toastManager = (() => {
  function init() {
    // 初始化提示管理器
  }

  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');

    // 根据类型选择不同的样式类
    let bgColorClass = 'bg-primary';
    if (type === 'error') bgColorClass = 'bg-destructive';
    if (type === 'success') bgColorClass = 'bg-green-500';
    if (type === 'warning') bgColorClass = 'bg-yellow-500 text-black';

    toast.className = `${bgColorClass} text-white px-4 py-3 rounded-md shadow-md animate-in fade-in slide-in-from-right-full`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
      toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-full');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  return {
    init,
    showToast,
  };
})();

// 会话管理模块
const sessionManager = (() => {
  function init() {
    // 初始化会话管理器
  }

  function getSessionId() {
    return sessionId;
  }

  function createNewSession() {
    // 禁用UI元素，显示加载状态
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => (btn.disabled = true));
    toastManager.showToast('正在创建新会话...', 'info');

    return fetch(`${API_BASE_URL}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'user-' + Date.now() }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`创建会话失败: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          sessionId = data.sessionId;
          localStorage.setItem('mcpSessionId', sessionId);

          console.log(`新会话已创建: ${sessionId}`);

          // 更新UI
          updateSessionDisplay();

          // 连接WebSocket
          connectWebSocket();

          // 清空现有MCP列表
          mcpList = [];
          renderMcpList();

          eventBus.emit('session-changed', sessionId);

          toastManager.showToast('会话已创建', 'info');

          // 重新启用UI元素
          allButtons.forEach(btn => (btn.disabled = false));

          return sessionId;
        } else {
          throw new Error(data.error || '创建会话失败');
        }
      })
      .catch(error => {
        console.error('创建会话失败:', error);
        toastManager.showToast('创建会话失败: ' + error.message, 'error');

        // 重新启用UI元素
        allButtons.forEach(btn => (btn.disabled = false));

        throw error;
      });
  }

  return {
    init,
    getSessionId,
    createNewSession,
  };
})();

// MCP管理模块
const mcpManager = (() => {
  function init() {
    // 初始化MCP管理器
  }

  function getAllMcps() {
    return mcpList.reduce((acc, mcp) => {
      acc[mcp.name] = mcp;
      return acc;
    }, {});
  }

  function loadMcpList() {
    if (!sessionId) {
      console.warn('尝试加载MCP列表，但会话ID不存在');
      return Promise.reject(new Error('会话ID不存在'));
    }

    return fetch(`${API_BASE_URL}/mcp?sessionId=${sessionId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          mcpList = data.mcps || [];
          renderMcpList();
          eventBus.emit('mcps-updated', mcpList);
          return mcpList;
        } else {
          throw new Error(data.error || '加载MCP列表失败');
        }
      });
  }

  function addMcp(payload) {
    return fetch(`${API_BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(response => response.json())
      .then(data => {
        if (data.success && data.mcp) {
          // 添加到列表并渲染
          const existingIndex = mcpList.findIndex(m => m.name === data.mcp.name);

          if (existingIndex >= 0) {
            mcpList[existingIndex] = data.mcp;
          } else {
            mcpList.push(data.mcp);
          }

          renderMcpList();
          eventBus.emit('mcps-updated', mcpList);

          return data.mcp;
        } else {
          throw new Error(data.error || 'MCP添加失败');
        }
      });
  }

  function reconnectMcp(mcp) {
    // 根据类型准备不同的载荷
    const payload = {
      sessionId,
      name: mcp.name,
      clientType: mcp.clientType,
    };

    if (mcp.clientType === 'stdio') {
      payload.command = mcp.command;
      payload.args = mcp.args;
      payload.env = mcp.env;
    } else {
      payload.url = mcp.url;
    }

    toastManager.showToast(`正在重新连接 ${mcp.name}...`, 'info');

    return addMcp(payload)
      .then(updatedMcp => {
        toastManager.showToast(`${mcp.name} 已重新连接`, 'success');
        return updatedMcp;
      })
      .catch(error => {
        toastManager.showToast(`重新连接 ${mcp.name} 失败: ${error.message}`, 'error');
        throw error;
      });
  }

  function deleteMcp(mcp) {
    toastManager.showToast(`正在移除 ${mcp.name}...`, 'info');

    return fetch(`${API_BASE_URL}/mcp`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        name: mcp.name,
      }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // 从列表中移除
          mcpList = mcpList.filter(m => m.name !== mcp.name);
          renderMcpList();
          eventBus.emit('mcps-updated', mcpList);

          toastManager.showToast(`${mcp.name} 已移除`, 'success');
          return true;
        } else {
          throw new Error(data.error || `移除 ${mcp.name} 失败`);
        }
      })
      .catch(error => {
        toastManager.showToast(`移除 ${mcp.name} 失败: ${error.message}`, 'error');
        throw error;
      });
  }

  return {
    init,
    getAllMcps,
    loadMcpList,
    addMcp,
    reconnectMcp,
    deleteMcp,
  };
})();

// DOM元素
const sessionIdDisplay = document.getElementById('session-id-display');
const newSessionBtn = document.getElementById('new-session-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const serverTypeSelect = document.getElementById('server-type');
const serverNameInput = document.getElementById('server-name');
const serverCommandInput = document.getElementById('server-command');
const serverArgsInput = document.getElementById('server-args');
const serverEnvInput = document.getElementById('server-env');
const serverUrlInput = document.getElementById('server-url');
const commandGroup = document.getElementById('command-group');
const argsGroup = document.getElementById('args-group');
const envGroup = document.getElementById('env-group');
const urlGroup = document.getElementById('url-group');
const addMcpBtn = document.getElementById('add-mcp-btn');
const mcpListContainer = document.getElementById('mcp-list');
const emptyState = document.getElementById('empty-state');
const mcpCountElement = document.getElementById('mcp-count');
const addFirstMcpBtn = document.querySelector('.add-first-mcp-btn');
const presetMcpSelect = document.getElementById('preset-mcp-select');
const configFileInput = document.getElementById('config-file');
const importConfigBtn = document.getElementById('import-config-btn');

// 聊天功能实现
const chatModule = (() => {
  let isChatAvailable = false;

  function init() {
    setupEventListeners();
    checkChatAvailability();
  }

  function setupEventListeners() {
    // 聊天相关事件监听
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) {
        sendMessage();
      }
    });
    document.getElementById('clear-chat-btn').addEventListener('click', clearChat);

    // 监听会话变化
    eventBus.on('session-changed', onSessionChanged);
    eventBus.on('mcps-updated', checkChatAvailability);
  }

  function onSessionChanged(newSessionId) {
    if (newSessionId) {
      loadChatHistory();
    }
  }

  function checkChatAvailability() {
    // 检查是否有OpenAI MCP可用
    const mcps = mcpManager.getAllMcps();
    const openAIMcp = Object.values(mcps).find(
      mcp =>
        (mcp.name.toLowerCase().includes('openai') || mcp.name.toLowerCase().includes('ai')) &&
        mcp.status === 'connected',
    );

    if (openAIMcp) {
      enableChat();
    } else {
      disableChat('等待连接OpenAI MCP服务');
    }
  }

  function enableChat() {
    const chatStatus = document.getElementById('chat-status');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');

    isChatAvailable = true;
    chatStatus.textContent = '已连接';
    chatStatus.classList.remove('text-destructive');
    chatStatus.classList.add('text-green-500');
    chatInput.disabled = false;
    sendBtn.disabled = false;
  }

  function disableChat(message) {
    const chatStatus = document.getElementById('chat-status');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');

    isChatAvailable = false;
    chatStatus.textContent = message || '等待连接MCP服务';
    chatStatus.classList.remove('text-green-500');
    chatStatus.classList.add('text-destructive');
    chatInput.disabled = true;
    sendBtn.disabled = true;
  }

  // 加载聊天历史
  async function loadChatHistory() {
    const currentSessionId = sessionManager.getSessionId();
    if (!currentSessionId) {
      console.warn('尝试加载聊天历史，但会话ID不存在');
      return;
    }

    try {
      clearChatMessages();
      addSystemMessage('加载聊天历史...');

      const response = await fetch(`/api/chat/history/${currentSessionId}`);

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.history && data.history.length > 0) {
        clearChatMessages();

        // 重建聊天历史
        for (const message of data.history) {
          if (message.role === 'user') {
            addUserMessage(message.content);
          } else if (message.role === 'assistant' && message.content) {
            addAssistantMessage(message.content);
          } else if (message.role === 'assistant' && message.tool_calls) {
            // 处理函数调用，但不渲染，因为后面会有最终结果
            // 这里可以根据需求改进，例如显示函数调用过程
          }
        }
      } else {
        addSystemMessage('开始新的对话');
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      addSystemMessage('加载聊天历史失败: ' + error.message);
    }
  }

  // 发送消息
  async function sendMessage() {
    const message = document.getElementById('chat-input').value.trim();
    if (!message || !isChatAvailable) return;

    const currentSessionId = sessionManager.getSessionId();
    if (!currentSessionId) {
      addSystemMessage('未找到会话，请重新连接');
      return;
    }

    // 禁用输入和发送按钮
    document.getElementById('send-message-btn').disabled = true;

    // 显示用户消息
    addUserMessage(message);

    // 清空输入框
    document.getElementById('chat-input').value = '';

    try {
      addSystemMessage('AI思考中...');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message,
        }),
      });

      // 移除"思考中"消息
      removeSystemMessages();

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        if (data.type === 'text') {
          // 普通文本响应
          addAssistantMessage(data.content);
        } else if (data.type === 'function_result') {
          // 函数调用结果
          addFunctionCallInfo(data);

          // 添加最终响应
          if (data.final_response) {
            addAssistantMessage(data.final_response);
          }
        }
      } else {
        addSystemMessage(`错误: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      removeSystemMessages();
      addSystemMessage(`发送失败: ${error.message}`);
    } finally {
      // 恢复输入和发送按钮
      document.getElementById('send-message-btn').disabled = false;
      document.getElementById('chat-input').focus();
    }
  }

  // 清除聊天历史
  async function clearChat() {
    const currentSessionId = sessionManager.getSessionId();
    if (!currentSessionId) {
      addSystemMessage('未找到会话，无法清除聊天历史');
      return;
    }

    try {
      const response = await fetch(`/api/chat/history/${currentSessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`清除失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        clearChatMessages();
        addSystemMessage('聊天历史已清除');
      } else {
        addSystemMessage(`清除失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('清除聊天历史失败:', error);
      addSystemMessage(`清除失败: ${error.message}`);
    }
  }

  // 清除聊天消息
  function clearChatMessages() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
  }

  // 移除系统消息
  function removeSystemMessages() {
    const systemMessages = document
      .getElementById('chat-messages')
      .querySelectorAll('.system-message');
    systemMessages.forEach(msg => msg.remove());
  }

  // 添加系统消息
  function addSystemMessage(message) {
    removeSystemMessages();
    const messagesContainer = document.getElementById('chat-messages');
    const systemMessage = document.createElement('div');
    systemMessage.className =
      'text-center text-sm text-muted-foreground italic py-2 system-message';
    systemMessage.textContent = message;
    messagesContainer.appendChild(systemMessage);
    scrollToBottom();
  }

  // 添加用户消息
  function addUserMessage(message) {
    removeSystemMessages();
    const messagesContainer = document.getElementById('chat-messages');
    const template = document.getElementById('chat-message-template');
    const messageElement = template.content.cloneNode(true);

    messageElement
      .querySelector('.message')
      .classList.add('user', 'bg-primary', 'text-primary-foreground', 'ml-auto');
    messageElement.querySelector('.message-sender').textContent = '用户';
    messageElement.querySelector('.message-time').textContent = getCurrentTime();
    messageElement.querySelector('.message-content').textContent = message;

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  // 添加助手消息
  function addAssistantMessage(message) {
    removeSystemMessages();
    const messagesContainer = document.getElementById('chat-messages');
    const template = document.getElementById('chat-message-template');
    const messageElement = template.content.cloneNode(true);

    messageElement
      .querySelector('.message')
      .classList.add('assistant', 'bg-background', 'border', 'border-border', 'mr-auto');
    messageElement.querySelector('.message-sender').textContent = '助手';
    messageElement.querySelector('.message-time').textContent = getCurrentTime();

    // 支持渲染简单的Markdown
    const contentElement = messageElement.querySelector('.message-content');
    contentElement.innerHTML = formatMessage(message);

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }

  // 添加函数调用信息
  function addFunctionCallInfo(data) {
    // 只显示第一个函数调用，如果需要可以扩展为显示多个
    if (!data.function_calls || !data.function_calls.length) return;

    const call = data.function_calls[0];
    const result = data.results.find(r => r.tool_call_id === call.id);

    if (!call || !result) return;

    const clone = document.getElementById('function-call-template').content.cloneNode(true);

    clone.querySelector('.function-name').textContent = call.function.name;

    try {
      // 格式化参数
      const params = JSON.parse(call.function.arguments);
      clone.querySelector('.function-params').textContent = JSON.stringify(params, null, 2);

      // 格式化结果
      let resultObj;
      try {
        resultObj = JSON.parse(result.result);
      } catch (e) {
        resultObj = result.result;
      }

      clone.querySelector('.function-result').textContent = JSON.stringify(resultObj, null, 2);
    } catch (e) {
      console.error('解析函数调用信息失败:', e);
      // 降级处理
      clone.querySelector('.function-params').textContent = call.function.arguments;
      clone.querySelector('.function-result').textContent = result.result;
    }

    const functionCallContainer = document.createElement('div');
    functionCallContainer.className = 'mt-2 flex flex-wrap gap-1';

    functionCallContainer.appendChild(clone.querySelector('.function-name'));
    functionCallContainer.appendChild(clone.querySelector('.function-params'));
    functionCallContainer.appendChild(clone.querySelector('.function-result'));

    const functionCallElement = document.createElement('div');
    functionCallElement.className = 'text-sm text-muted-foreground italic py-2 system-message';
    functionCallElement.textContent = '函数调用:';
    functionCallElement.appendChild(functionCallContainer);

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(functionCallElement);
    scrollToBottom();
  }

  // 格式化消息，处理代码块
  function formatMessage(message) {
    // 简单的代码块检测和转换
    let formatted = message;

    // 替换代码块
    formatted = formatted.replace(
      /```([a-z]*)\n([\s\S]*?)\n```/g,
      function (match, language, code) {
        return `<pre><code>${code}</code></pre>`;
      },
    );

    // 替换换行符
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  // 获取当前时间 (HH:MM)
  function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // 滚动到底部
  function scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  return {
    init,
    checkChatAvailability,
    enableChat,
    disableChat,
    sendMessage,
    clearChat,
    addSystemMessage,
    addUserMessage,
    addAssistantMessage,
    addFunctionCallInfo,
  };
})();

// Function Call测试模块
const functionTestModule = (() => {
  let isTestAvailable = false;

  function init() {
    setupEventListeners();
    checkAvailability();
  }

  function setupEventListeners() {
    document.getElementById('run-function-test').addEventListener('click', runTest);
    document.getElementById('clear-function-test').addEventListener('click', clearResults);

    eventBus.on('session-changed', checkAvailability);
    eventBus.on('mcps-updated', checkAvailability);
  }

  function checkAvailability() {
    // 检查是否有MCP可用
    const mcps = mcpManager.getAllMcps();
    const availableMcps = Object.values(mcps).filter(mcp => mcp.status === 'connected');

    if (availableMcps.length > 0) {
      enableTest();
    } else {
      disableTest('等待连接MCP服务');
    }
  }

  function enableTest() {
    const testStatus = document.getElementById('function-test-status');
    const testButton = document.getElementById('run-function-test');

    isTestAvailable = true;
    testStatus.textContent = '已连接';
    testStatus.classList.remove('text-destructive');
    testStatus.classList.add('text-green-500');
    testButton.disabled = false;
  }

  function disableTest(message) {
    const testStatus = document.getElementById('function-test-status');
    const testButton = document.getElementById('run-function-test');

    isTestAvailable = false;
    testStatus.textContent = message || '等待连接MCP服务';
    testStatus.classList.remove('text-green-500');
    testStatus.classList.add('text-destructive');
    testButton.disabled = true;
  }

  // 运行测试
  async function runTest() {
    const message = document.getElementById('function-test-message').value.trim();
    if (!message || !isTestAvailable) return;

    const currentSessionId = sessionManager.getSessionId();
    if (!currentSessionId) {
      addOutputMessage('未找到会话，请重新连接', 'error');
      return;
    }

    // 禁用输入和运行按钮
    document.getElementById('run-function-test').disabled = true;

    clearResults();
    addOutputMessage('正在向OpenAI发送请求...');

    try {
      const response = await fetch('/api/test/function-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        displayTestResult(data.response);
      } else {
        addOutputMessage(`错误: ${data.error || '未知错误'}`, 'error');
      }
    } catch (error) {
      console.error('函数调用测试失败:', error);
      addOutputMessage(`测试失败: ${error.message}`, 'error');
    } finally {
      // 恢复输入和运行按钮
      document.getElementById('run-function-test').disabled = false;
    }
  }

  // 清除结果
  function clearResults() {
    const outputContainer = document.getElementById('function-test-output');
    outputContainer.innerHTML = '';
  }

  // 添加输出消息
  function addOutputMessage(message, type = 'info') {
    const outputContainer = document.getElementById('function-test-output');
    const messageElement = document.createElement('div');
    messageElement.className = `text-sm ${
      type === 'error'
        ? 'text-destructive'
        : type === 'success'
        ? 'text-green-500'
        : 'text-muted-foreground'
    } italic py-2 system-message ${type}`;
    messageElement.textContent = message;
    outputContainer.appendChild(messageElement);
  }

  // 显示测试结果
  function displayTestResult(response) {
    if (response.type === 'text') {
      // 显示文本响应
      const responseBlock = document.createElement('div');
      responseBlock.className = 'response-block';

      const responseTitle = document.createElement('div');
      responseTitle.className = 'response-title';
      responseTitle.textContent = 'AI响应:';

      const responseContent = document.createElement('div');
      responseContent.className = 'response-content';
      responseContent.textContent = response.content;

      responseBlock.appendChild(responseTitle);
      responseBlock.appendChild(responseContent);
      document.getElementById('function-test-output').appendChild(responseBlock);
    } else if (response.type === 'function_call') {
      // 显示函数调用
      const responseBlock = document.createElement('div');
      responseBlock.className = 'response-block';

      const responseTitle = document.createElement('div');
      responseTitle.className = 'response-title';
      responseTitle.textContent = 'AI请求调用函数:';
      responseBlock.appendChild(responseTitle);

      // 显示所有工具调用
      response.calls.forEach((call, index) => {
        if (call.type === 'function') {
          const toolCall = document.createElement('div');
          toolCall.className = 'tool-call';

          // 工具名称
          const toolName = document.createElement('div');
          toolName.className = 'tool-name';
          toolName.textContent = `工具: ${call.function.name}`;
          toolCall.appendChild(toolName);

          // 参数
          try {
            const args = JSON.parse(call.function.arguments);
            const argsEl = document.createElement('div');
            argsEl.className = 'tool-args';
            argsEl.textContent = JSON.stringify(args, null, 2);
            toolCall.appendChild(argsEl);
          } catch (e) {
            console.error('解析参数失败:', e);
          }

          // 结果
          const result = response.results.find(r => r.tool_call_id === call.id);
          if (result) {
            const resultEl = document.createElement('div');
            resultEl.className = 'tool-result';

            try {
              const resultValue = JSON.parse(result.result);
              resultEl.textContent = JSON.stringify(resultValue, null, 2);
            } catch (e) {
              resultEl.textContent = result.result;
            }

            toolCall.appendChild(resultEl);
          }

          responseBlock.appendChild(toolCall);
        }
      });

      document.getElementById('function-test-output').appendChild(responseBlock);
    }
  }

  return {
    init,
    checkAvailability,
    enableTest,
    disableTest,
    runTest,
    clearResults,
  };
})();

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  // 初始化各模块
  eventBus.init();
  toastManager.init();
  sessionManager.init();
  mcpManager.init();
  chatModule.init();
  functionTestModule.init();

  // 设置UI交互
  initTabSwitching();
  initFormListeners();

  // 尝试恢复会话
  restoreSession();

  // 添加首个MCP的按钮
  document.querySelector('.add-first-mcp-btn').addEventListener('click', () => {
    switchTab('add-mcp');
  });

  // 创建新会话按钮
  document.getElementById('new-session-btn').addEventListener('click', createNewSession);

  // 预设MCP选择器事件
  document.getElementById('preset-mcp-select').addEventListener('change', handlePresetSelect);

  // 导入配置按钮事件
  document.getElementById('import-config-btn').addEventListener('click', handleConfigImport);

  // 配置JSON区域事件监听器
  document.getElementById('validate-json-btn').addEventListener('click', validateJSON);
  document.getElementById('format-json-btn').addEventListener('click', formatJSON);
  document.getElementById('clear-json-btn').addEventListener('click', clearJSON);
  document.getElementById('parse-config-btn').addEventListener('click', handleConfigParse);

  // 命令行解析事件监听器
  document.getElementById('parse-command-btn').addEventListener('click', parseCommandLine);
});

// 初始化标签页切换
function initTabSwitching() {
  const tabTriggers = document.querySelectorAll('.tab-trigger');
  tabTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const tabId = trigger.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

// 切换标签页
function switchTab(tabId) {
  // 更新tab按钮状态
  document.querySelectorAll('.tab-trigger').forEach(trigger => {
    const isActive = trigger.getAttribute('data-tab') === tabId;
    trigger.setAttribute('data-state', isActive ? 'active' : 'inactive');
    trigger.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // 更新tab内容区域
  document.querySelectorAll('.tab-content').forEach(content => {
    const isActive = content.id === tabId;
    content.classList.toggle('hidden', !isActive);
    content.setAttribute('data-state', isActive ? 'active' : 'inactive');
    content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}

// 初始化表单监听器
function initFormListeners() {
  // 监听服务器类型变化，切换表单
  document.getElementById('server-type').addEventListener('change', () => {
    const selectedType = document.getElementById('server-type').value;

    if (selectedType === 'stdio') {
      commandGroup.style.display = 'block';
      argsGroup.style.display = 'block';
      envGroup.style.display = 'block';
      urlGroup.style.display = 'none';
    } else {
      commandGroup.style.display = 'none';
      argsGroup.style.display = 'none';
      envGroup.style.display = 'none';
      urlGroup.style.display = 'block';
    }

    validateForm();
  });

  // 监听输入变化，验证表单
  document.getElementById('server-name').addEventListener('input', validateForm);
  document.getElementById('server-command').addEventListener('input', validateForm);
  document.getElementById('server-args').addEventListener('input', validateForm);
  document.getElementById('server-env').addEventListener('input', validateForm);
  document.getElementById('server-url').addEventListener('input', validateForm);

  // 添加MCP按钮点击事件
  document.getElementById('add-mcp-btn').addEventListener('click', addMcp);
}

// 验证表单
function validateForm() {
  const serverName = document.getElementById('server-name').value.trim();
  const serverType = document.getElementById('server-type').value;
  let isValid = !!serverName;

  if (serverType === 'stdio') {
    isValid = isValid && !!document.getElementById('server-command').value.trim();
  } else {
    isValid = isValid && !!document.getElementById('server-url').value.trim();
  }

  document.getElementById('add-mcp-btn').disabled = !isValid || !sessionId;

  return isValid;
}

// 处理预设选择
function handlePresetSelect() {
  const selectedPreset = document.getElementById('preset-mcp-select').value;

  if (selectedPreset && MCP_PRESETS[selectedPreset]) {
    const preset = MCP_PRESETS[selectedPreset];

    // 将预设转换为JSON配置格式
    const jsonConfig = {
      mcpServers: {
        [preset.name]: {
          command: preset.command,
          args: preset.args,
          env: preset.env,
        },
      },
    };

    // 填充到JSON输入框并格式化
    document.getElementById('config-json').value = JSON.stringify(jsonConfig, null, 2);

    // 填充表单
    document.getElementById('server-name').value = preset.name;
    document.getElementById('server-command').value = preset.command;
    document.getElementById('server-args').value = preset.args.join('\n');

    // 格式化环境变量
    const envText = Object.entries(preset.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    document.getElementById('server-env').value = envText;

    // 切换到stdio类型
    document.getElementById('server-type').value = 'stdio';
    document.getElementById('server-type').dispatchEvent(new Event('change'));

    // 验证表单
    validateForm();

    // 重置选择器
    document.getElementById('preset-mcp-select').value = '';

    toastManager.showToast(`已加载预设: ${preset.name}`, 'info');
  }
}

// 处理配置文件导入
function handleConfigImport() {
  const file = document.getElementById('config-file').files[0];

  if (!file) {
    toastManager.showToast('请选择配置文件', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = e => {
    try {
      const config = JSON.parse(e.target.result);

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new Error('无效的配置文件格式');
      }

      // 添加所有配置的MCP
      const mcpPromises = [];

      for (const [name, mcpConfig] of Object.entries(config.mcpServers)) {
        const payload = {
          sessionId,
          name,
          clientType: 'stdio',
          command: mcpConfig.command,
          args: mcpConfig.args,
          env: mcpConfig.env,
        };

        mcpPromises.push(mcpManager.addMcp(payload));
      }

      Promise.all(mcpPromises)
        .then(() => {
          toastManager.showToast('配置文件导入成功', 'success');
          switchTab('list-mcp');
        })
        .catch(error => {
          toastManager.showToast(`导入失败: ${error.message}`, 'error');
        });
    } catch (error) {
      toastManager.showToast(`配置文件解析失败: ${error.message}`, 'error');
    }
  };

  reader.readAsText(file);
}

// JSON配置处理函数
function validateJSON() {
  const configJson = document.getElementById('config-json').value.trim();

  if (!configJson) {
    toastManager.showToast('请输入配置信息', 'error');
    return false;
  }

  try {
    const config = JSON.parse(configJson);

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      toastManager.showToast('无效的配置格式，需要包含mcpServers对象', 'error');
      return false;
    }

    toastManager.showToast('JSON格式有效', 'success');
    return true;
  } catch (error) {
    toastManager.showToast(`JSON格式无效: ${error.message}`, 'error');
    return false;
  }
}

function formatJSON() {
  const configJson = document.getElementById('config-json').value.trim();

  if (!configJson) {
    toastManager.showToast('请输入配置信息', 'error');
    return;
  }

  try {
    const parsed = JSON.parse(configJson);
    document.getElementById('config-json').value = JSON.stringify(parsed, null, 2);
    toastManager.showToast('已格式化JSON', 'success');
  } catch (error) {
    toastManager.showToast(`无法格式化: ${error.message}`, 'error');
  }
}

function clearJSON() {
  document.getElementById('config-json').value = '';
}

function handleConfigParse() {
  const configJson = document.getElementById('config-json').value.trim();

  if (!configJson) {
    toastManager.showToast('请输入配置信息', 'error');
    return;
  }

  try {
    const config = JSON.parse(configJson);

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      throw new Error('无效的配置格式，需要包含mcpServers对象');
    }

    // 添加所有配置的MCP
    const mcpPromises = [];

    for (const [name, mcpConfig] of Object.entries(config.mcpServers)) {
      const payload = {
        sessionId,
        name,
        clientType: 'stdio',
        command: mcpConfig.command,
        args: Array.isArray(mcpConfig.args) ? mcpConfig.args : [],
        env: mcpConfig.env || {},
      };

      mcpPromises.push(mcpManager.addMcp(payload));
    }

    Promise.all(mcpPromises)
      .then(() => {
        toastManager.showToast('配置已成功应用', 'success');
        switchTab('list-mcp');
        // 清空输入框
        document.getElementById('config-json').value = '';
      })
      .catch(error => {
        toastManager.showToast(`应用配置失败: ${error.message}`, 'error');
      });
  } catch (error) {
    toastManager.showToast(`JSON解析失败: ${error.message}`, 'error');
  }
}

// 命令行解析函数
function parseCommandLine() {
  const commandLine = document.getElementById('command-line-input').value.trim();

  if (!commandLine) {
    toastManager.showToast('请输入命令行', 'error');
    return;
  }

  try {
    // 解析命令行
    const parsed = parseCommandToConfig(commandLine);

    // 显示生成的JSON配置
    document.getElementById('config-json').value = JSON.stringify(parsed, null, 2);

    // 自动切换到配置粘贴区域
    const configPasteSection = document.querySelector('.config-paste-section');
    configPasteSection.scrollIntoView({ behavior: 'smooth' });

    toastManager.showToast('已解析命令行为配置', 'success');
  } catch (error) {
    toastManager.showToast(`解析失败: ${error.message}`, 'error');
  }
}

// 命令行解析辅助函数
function parseCommandToConfig(commandLine) {
  const parts = parseCommandLineString(commandLine);

  if (parts.length === 0) {
    throw new Error('无效的命令行');
  }

  const command = parts[0];
  const args = [];
  const env = {};
  let serverName = '';

  // 解析参数
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // 检查是否是环境变量格式 (--KEY=value)
    if (part.startsWith('--') && part.includes('=')) {
      const [key, ...valueParts] = part.substring(2).split('=');
      env[key] = valueParts.join('=');
    } else {
      args.push(part);

      // 尝试从参数中提取服务器名称
      if (part.startsWith('@') && !serverName) {
        // 例如 @amap/amap-maps-mcp-server -> amap-maps
        serverName = part.split('/').pop().replace('-mcp-server', '');
      }
    }
  }

  // 如果没有解析出服务器名称，使用默认名称
  if (!serverName) {
    serverName = `mcp-${Date.now()}`;
  }

  // 构建配置对象
  const config = {
    mcpServers: {
      [serverName]: {
        command: command,
        args: args,
      },
    },
  };

  // 只有当有环境变量时才添加env字段
  if (Object.keys(env).length > 0) {
    config.mcpServers[serverName].env = env;
  }

  return config;
}

// 解析命令行字符串的辅助函数（处理引号等情况）
function parseCommandLineString(commandLine) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];

    if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
      inQuotes = !inQuotes;
      if (inQuotes) {
        quoteChar = char;
      } else {
        quoteChar = '';
      }
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

// 从本地存储恢复会话
function restoreSession() {
  const savedSessionId = localStorage.getItem('mcpSessionId');

  if (savedSessionId) {
    // 验证会话是否存在
    fetch(`${API_BASE_URL}/mcp?sessionId=${savedSessionId}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          // 如果会话不存在，创建新会话
          console.log('保存的会话无效，创建新会话');
          throw new Error('会话不存在或已过期');
        }
      })
      .then(data => {
        if (data.success) {
          sessionId = savedSessionId;
          updateSessionDisplay();
          connectWebSocket();
          mcpList = data.mcps || [];
          renderMcpList();
          eventBus.emit('mcps-updated', mcpList);
        } else {
          throw new Error(data.error || '无法加载MCP列表');
        }
      })
      .catch(error => {
        console.error('恢复会话失败:', error);
        // 创建新会话
        localStorage.removeItem('mcpSessionId');
        sessionManager.createNewSession();
      });
  } else {
    sessionManager.createNewSession();
  }
}

// 连接WebSocket
function connectWebSocket() {
  if (socket) {
    socket.disconnect();
  }

  socket = io();

  socket.on('connect', () => {
    console.log('WebSocket已连接');
    socket.emit('join_session', sessionId);
  });

  socket.on('mcp_connected', mcp => {
    const existingIndex = mcpList.findIndex(m => m.name === mcp.name);

    if (existingIndex >= 0) {
      mcpList[existingIndex] = mcp;
    } else {
      mcpList.push(mcp);
    }

    renderMcpList();
  });

  socket.on('mcp_disconnected', data => {
    mcpList = mcpList.filter(mcp => mcp.name !== data.name);
    renderMcpList();
  });

  socket.on('disconnect', () => {
    console.log('WebSocket已断开');
  });
}

// 更新会话显示
function updateSessionDisplay() {
  sessionIdDisplay.textContent = `会话ID: ${sessionId.substring(0, 8)}...`;
}

// 渲染MCP列表
function renderMcpList() {
  const mcpListContainer = document.getElementById('mcp-list');
  const emptyState = document.getElementById('empty-state');
  const mcpCountElement = document.getElementById('mcp-count');

  // 清空列表
  const existingItems = mcpListContainer.querySelectorAll('.mcp-item');
  existingItems.forEach(item => {
    if (item.id !== 'empty-state') {
      item.remove();
    }
  });

  // 更新计数
  mcpCountElement.textContent = mcpList.length;

  // 如果列表为空，显示空状态
  if (mcpList.length === 0) {
    emptyState.style.display = 'block';
    return;
  } else {
    emptyState.style.display = 'none';
  }

  // 渲染每个MCP
  const template = document.getElementById('mcp-item-template');

  mcpList.forEach(mcp => {
    const mcpElement = template.content.cloneNode(true);
    const mcpItem = mcpElement.querySelector('div');
    mcpItem.id = `mcp-${mcp.name}`;

    // 设置MCP名称
    mcpElement.querySelector('.mcp-name').textContent = mcp.name;

    // 设置MCP类型
    mcpElement.querySelector('.mcp-type').textContent = `类型: ${mcp.clientType}`;

    // 设置MCP状态
    const statusElement = mcpElement.querySelector('.mcp-status');
    if (mcp.status === 'connected') {
      statusElement.textContent = '状态: 已连接';
      statusElement.classList.add('text-green-500');
    } else {
      statusElement.textContent = `状态: ${mcp.status === 'failed' ? '连接失败' : '正在连接...'}`;
      statusElement.classList.add(mcp.status === 'failed' ? 'text-destructive' : 'text-amber-500');
    }

    // 显示MCP提供的工具
    const toolsElement = mcpElement.querySelector('.mcp-tools');
    if (mcp.tools && mcp.tools.length > 0) {
      const toolsContainer = document.createElement('div');
      toolsContainer.className = 'mt-2 flex flex-wrap gap-1';

      toolsElement.textContent = '可用工具: ';

      mcp.tools.forEach(tool => {
        const toolButton = document.createElement('button');
        toolButton.className =
          'px-2 py-1 text-xs rounded bg-muted text-secondary-foreground hover:bg-muted/80 transition-colors';
        toolButton.textContent = tool;
        toolButton.addEventListener('click', () => showToolDialog(mcp.name, tool));
        toolsContainer.appendChild(toolButton);
      });

      toolsElement.appendChild(toolsContainer);
    } else {
      toolsElement.textContent = '工具: 无可用工具';
      toolsElement.classList.add('text-muted-foreground');
    }

    // 添加重连按钮事件
    mcpElement.querySelector('.reconnect-btn').addEventListener('click', () => reconnectMcp(mcp));

    // 添加删除按钮事件
    mcpElement.querySelector('.delete-btn').addEventListener('click', () => deleteMcp(mcp));

    // 将MCP添加到列表
    mcpListContainer.appendChild(mcpElement);
  });
}

// 工具调用函数
function callMcpTool(mcpName, toolName, params) {
  if (!sessionId) return Promise.reject(new Error('未连接会话'));

  return fetch(`${API_BASE_URL}/mcp/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      mcpName,
      tool: toolName,
      params,
    }),
  }).then(response => response.json());
}

// 显示工具对话框
function showToolDialog(mcpName, toolName) {
  // 根据工具名创建相应的对话框
  let dialogHTML = '';
  let params = {};

  switch (toolName) {
    case 'search':
      dialogHTML = `
        <h3>搜索工具</h3>
        <div class="form-group">
          <label for="search-query">搜索关键词</label>
          <input type="text" id="search-query" placeholder="输入关键词...">
        </div>
      `;
      break;
    case 'calculator':
      dialogHTML = `
        <h3>计算器工具</h3>
        <div class="form-group">
          <label for="calc-expression">数学表达式</label>
          <input type="text" id="calc-expression" placeholder="例如: 2+2*3">
        </div>
      `;
      break;
    case 'weather':
      dialogHTML = `
        <h3>天气工具</h3>
        <div class="form-group">
          <label for="weather-city">城市名称</label>
          <input type="text" id="weather-city" placeholder="例如: 北京">
        </div>
      `;
      break;
    default:
      dialogHTML = `<h3>${toolName}</h3><p>此工具暂无交互界面</p>`;
  }

  // 创建对话框
  const dialog = document.createElement('div');
  dialog.className = 'tool-dialog';
  dialog.innerHTML = `
    <div class="tool-dialog-content">
      ${dialogHTML}
      <div class="dialog-actions">
        <button class="cancel-btn">取消</button>
        <button class="execute-btn">执行</button>
      </div>
      <div class="result-container" style="display:none;"></div>
    </div>
  `;

  document.body.appendChild(dialog);

  // 添加事件监听
  dialog.querySelector('.cancel-btn').addEventListener('click', () => {
    dialog.remove();
  });

  dialog.querySelector('.execute-btn').addEventListener('click', () => {
    // 获取参数
    switch (toolName) {
      case 'search':
        params = { query: dialog.querySelector('#search-query').value };
        break;
      case 'calculator':
        params = { expression: dialog.querySelector('#calc-expression').value };
        break;
      case 'weather':
        params = { city: dialog.querySelector('#weather-city').value };
        break;
    }

    // 执行工具调用
    const executeBtn = dialog.querySelector('.execute-btn');
    executeBtn.disabled = true;
    executeBtn.textContent = '执行中...';

    callMcpTool(mcpName, toolName, params)
      .then(result => {
        const resultContainer = dialog.querySelector('.result-container');
        resultContainer.style.display = 'block';

        if (result.success) {
          resultContainer.innerHTML = `
            <div class="success-result">
              <h4>执行结果</h4>
              <pre>${JSON.stringify(result.result, null, 2)}</pre>
            </div>
          `;
        } else {
          resultContainer.innerHTML = `
            <div class="error-result">
              <h4>执行失败</h4>
              <p>${result.error}</p>
            </div>
          `;
        }
      })
      .catch(error => {
        const resultContainer = dialog.querySelector('.result-container');
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
          <div class="error-result">
            <h4>执行失败</h4>
            <p>${error.message}</p>
          </div>
        `;
      })
      .finally(() => {
        executeBtn.disabled = false;
        executeBtn.textContent = '执行';
      });
  });
}

// 创建新会话
function createNewSession() {
  sessionManager.createNewSession().catch(error => {
    console.error('创建会话失败:', error);
    toastManager.showToast('创建会话失败: ' + error.message, 'error');
  });
}

// 添加MCP
function addMcp() {
  if (!validateForm() || !sessionId) return;

  const name = document.getElementById('server-name').value.trim();
  const type = document.getElementById('server-type').value;
  const command = document.getElementById('server-command').value.trim();
  const url = document.getElementById('server-url').value.trim();

  const payload = {
    sessionId,
    name,
    clientType: type,
  };

  if (type === 'stdio') {
    // 确保命令存在
    if (command) {
      payload.command = command;
    } else {
      toastManager.showToast('请输入命令', 'error');
      return;
    }

    // 解析参数（每行一个）
    const argsText = document.getElementById('server-args').value.trim();
    if (argsText) {
      payload.args = argsText
        .split('\n')
        .map(arg => arg.trim())
        .filter(arg => arg);
    } else {
      payload.args = [];
    }

    // 解析环境变量（键值对）
    const envText = document.getElementById('server-env').value.trim();
    if (envText) {
      payload.env = {};
      envText.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.includes('=')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          payload.env[key.trim()] = valueParts.join('=').trim();
        }
      });
    }

    // 打印表单值和解析后的数据
    console.log('表单值:', {
      command: document.getElementById('server-command').value,
      args: document.getElementById('server-args').value,
      env: document.getElementById('server-env').value,
    });

    console.log('解析后的参数:', payload.args);
    if (payload.env) {
      console.log('解析后的环境变量:', payload.env);
    }
  } else {
    payload.url = url;
  }

  // 显示加载状态
  document.getElementById('add-mcp-btn').disabled = true;
  toastManager.showToast('正在添加MCP...', 'info');

  console.log('准备发送的 payload:', JSON.stringify(payload, null, 2));

  mcpManager
    .addMcp(payload)
    .then(mcp => {
      // 重置表单
      resetForm();

      // 切换到列表标签页
      switchTab('list-mcp');

      toastManager.showToast('MCP已添加', 'success');
    })
    .catch(error => {
      console.error('添加MCP失败:', error);
      toastManager.showToast('添加MCP失败: ' + error.message, 'error');
    })
    .finally(() => {
      document.getElementById('add-mcp-btn').disabled = false;
    });
}

// 重置表单
function resetForm() {
  document.getElementById('server-name').value = '';
  document.getElementById('server-command').value = '';
  document.getElementById('server-args').value = '';
  document.getElementById('server-env').value = '';
  document.getElementById('server-url').value = '';
  validateForm();
}

// 重新连接MCP
function reconnectMcp(mcp) {
  mcpManager.reconnectMcp(mcp).catch(error => {
    console.error('重新连接MCP失败:', error);
  });
}

// 删除MCP
function deleteMcp(mcp) {
  mcpManager.deleteMcp(mcp).catch(error => {
    console.error('删除MCP失败:', error);
  });
}

// 显示通知
function showToast(message, type = 'info') {
  toastManager.showToast(message, type);
}
