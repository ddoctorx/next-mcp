# MCPClient 领域驱动开发 PRD

## 领域概述

MCPClient 是模型控制协议(Model Control Protocol)客户端的核心实现，用于与 AI 大模型进行交互并管理本地或远程工具调用。该系统允许用户通过会话管理、MCP 服务连接、工具调用以及与 OpenAI API 集成等功能，实现 AI 模型与工具之间的无缝通信。

## 核心领域

### 1. MCP 连接管理领域（MCP Connection Domain）

#### 聚合根：MCPSession

- **标识**：MCP 名称和会话 ID
- **实体**：
  - 进程对象（stdio 类型）
  - 连接状态
  - 工具列表
  - 连接配置

#### 值对象：

- MCPConnectionConfig: 包含类型(stdio/sse)、命令或 URL
- ToolDefinition: 工具定义，包含名称、描述和参数架构

#### 领域服务：

- **MCPConnectionService**：
  - connectStdioMcp(sessionId, name, command): 通过标准输入输出连接 MCP
  - connectSseMcp(sessionId, name, url): 通过 SSE 连接 MCP
  - disconnectMcp(sessionId, name): 断开 MCP 连接
  - getToolsFromProcess(process): 从 MCP 进程获取工具列表

#### 用例：

1. 通过命令行启动并连接到 MCP 服务
2. 通过 SSE URL 连接到远程 MCP 服务
3. 获取 MCP 服务提供的工具列表
4. 断开与 MCP 服务的连接

### 2. 工具调用领域（Tool Invocation Domain）

#### 聚合根：ToolInvocation

- **标识**：请求 ID
- **实体**：
  - 工具名称
  - 参数对象
  - 调用结果

#### 值对象：

- ToolRequest: 包含请求 ID、工具名称和参数
- ToolResponse: 包含响应 ID、状态和结果

#### 领域服务：

- **ToolInvocationService**：
  - callRemoteMcpTool(mcpSession, toolName, params): 调用远程 MCP 工具
  - mcpToolAdapter(sessionId, mcpName, toolName, params): MCP 工具调用适配器
  - executeToolCall(toolName, params): 执行本地工具调用

#### 用例：

1. 调用远程 MCP 工具并获取结果
2. 调用本地工具并获取结果
3. 处理工具调用超时和错误

### 3. OpenAI 集成领域（OpenAI Integration Domain）

#### 聚合根：AIInteraction

- **标识**：与会话 ID 关联
- **实体**：
  - 消息列表
  - 工具调用配置

#### 值对象：

- ChatMessage: 包含角色、内容和工具调用
- ToolFormatting: 工具格式化配置

#### 领域服务：

- **OpenAIService**：
  - callChatCompletion(messages, tools, toolChoice): 调用 OpenAI 聊天 API
  - convertMcpToolsToOpenAIFormat(mcpTools): 将 MCP 工具转换为 OpenAI 工具格式
  - handleFunctionCalling(response, sessionId, mcpSessions, callMcpTool): 处理 OpenAI 函数调用响应

#### 用例：

1. 发送消息到 OpenAI 并获取响应
2. 将工具定义转换为 OpenAI 可识别的格式
3. 处理函数调用并执行相应工具

### 4. 内置工具领域（Built-in Tools Domain）

#### 聚合根：ToolRegistry

- **标识**：工具名称映射
- **实体**：
  - 搜索工具
  - 计算器工具
  - 天气工具

#### 值对象：

- ToolDefinition: 工具定义，包含名称、描述和参数架构
- ToolExecutionResult: 工具执行结果

#### 领域服务：

- **ToolRegistryService**：
  - getToolDefinitions(): 获取所有工具定义
  - executeToolCall(toolName, params): 执行工具调用

#### 用例：

1. 注册和管理内置工具
2. 执行特定工具调用
3. 获取所有可用工具的定义

### 5. 会话管理领域（Session Management Domain）

#### 聚合根：Session

- **标识**：会话 ID
- **实体**：
  - 用户 ID
  - MCP 会话列表
  - 聊天历史

#### 值对象：

- SessionInfo: 包含会话 ID、创建时间和用户 ID
- ChatHistory: 聊天消息历史记录

#### 领域服务：

- **SessionService**：
  - createSession(userId): 创建新会话
  - initChatHistory(sessionId): 初始化聊天历史
  - handleChatRequest(sessionId, message): 处理聊天请求

#### 用例：

1. 创建并初始化新会话
2. 管理会话的 MCP 连接
3. 存储和管理聊天历史

## 应用服务层

### MCPClientService

- 协调各个领域服务的主服务

### WebSocketService

- 管理与前端的 WebSocket 通信

### APIGatewayService

- 处理 HTTP API 请求

## 接口层

### API 接口

- `/api/session` (POST): 创建新会话
- `/api/mcp` (GET): 获取 MCP 列表
- `/api/mcp` (POST): 添加 MCP
- `/api/mcp/:name` (DELETE): 删除 MCP
- `/api/mcp/:name/reconnect` (POST): 重新连接 MCP
- `/api/mcp/:name/tools` (GET): 获取 MCP 工具列表
- `/api/mcp/:name/tools/:tool` (POST): 调用 MCP 工具
- `/api/chat/message` (POST): 发送聊天消息
- `/api/chat/history` (GET): 获取聊天历史
- `/api/function-test` (POST): 测试函数调用

### WebSocket 事件

- `connection`: 客户端连接
- `disconnect`: 客户端断开
- `join-session`: 加入会话
- `mcp-status-update`: MCP 状态更新
- `chat-message`: 聊天消息

## 基础设施层

### 外部服务适配器

- `OpenAIAdapter`: 与 OpenAI API 交互的适配器

### 进程管理服务

- `ProcessManager`: 管理子进程和 MCP 服务进程

### 实时通信服务

- `SocketServer`: 管理 WebSocket 连接和事件

## 技术实现细节

### MCP 通信协议

1. **Stdio 通信(命令行)**

   - 使用子进程的标准输入输出进行 JSON 消息交换
   - 请求格式：`{ id, type, tool, params }`
   - 响应格式：`{ id, status, result|error }`

2. **SSE 通信(HTTP)**
   - 通过 HTTP 请求与远程 MCP 服务通信
   - 使用 Server-Sent Events 接收实时更新

### 工具调用流程

1. 客户端发送消息到服务器
2. 服务器将消息转发给 OpenAI
3. OpenAI 返回包含工具调用的响应
4. 服务器处理工具调用:
   - 查找对应的 MCP 服务
   - 执行工具调用
   - 获取结果
5. 将工具调用结果发送回 OpenAI
6. OpenAI 提供最终响应
7. 服务器将最终响应发送给客户端

### 内置工具实现

1. **搜索工具**

   - 在预定义数据库中执行文本搜索
   - 参数：`{ query }`
   - 返回匹配项列表

2. **计算器工具**

   - 执行基本数学计算
   - 参数：`{ expression }`
   - 返回计算结果

3. **天气工具**
   - 获取指定位置的天气信息
   - 参数：`{ location }`
   - 返回天气数据

## 错误处理策略

1. **通信错误**

   - MCP 连接失败时的重试机制
   - 工具调用超时处理
   - 子进程错误捕获和记录

2. **数据验证**

   - 会话 ID 验证
   - 工具参数验证
   - API 请求验证

3. **状态一致性**
   - MCP 会话状态维护
   - 错误时的资源清理
   - 异常情况下的恢复机制

## 测试策略

根据 TDD 原则，需要确保测试覆盖率达到 90%以上：

1. **单元测试**

   - 工具执行逻辑
   - 消息解析
   - 格式转换

2. **集成测试**

   - MCP 连接流程
   - 工具调用流程
   - OpenAI API 集成

3. **端到端测试**
   - 完整聊天流程
   - 函数调用测试

## 文档规范

按照 DDD-文档驱动开发规范，所有公共接口需要：

1. **API 文档**

   - OpenAPI 规范文档
   - 请求/响应示例
   - 错误处理说明

2. **工具文档**
   - 工具参数架构
   - 工具功能描述
   - 使用示例

## 实现优先级

1. **核心功能(P0)**

   - MCP 连接管理
   - 工具调用
   - OpenAI 集成

2. **重要功能(P1)**

   - 内置工具实现
   - 会话管理
   - 错误处理

3. **增强功能(P2)**
   - SSE 连接支持
   - 更多工具类型
   - 性能优化

## 扩展性考虑

1. **新工具集成**

   - 遵循工具注册接口
   - 提供标准化的工具定义

2. **新模型支持**

   - 抽象化 AI 服务接口
   - 可替换的模型适配器

3. **分布式部署**
   - 会话状态持久化
   - 无状态 API 设计
