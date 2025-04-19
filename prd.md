# MCP 管理平台领域驱动开发 PRD

## 领域概述

MCP（模型控制协议）管理平台是一个用于连接、管理和测试与 AI 大模型交互的服务工具。该平台允许用户创建会话、添加 MCP 服务、进行聊天交互以及测试 Function Call 功能。

## 核心领域

### 1. 会话管理领域（Session Domain）

#### 聚合根：Session

- **标识**：唯一的 sessionId
- **实体**：
  - 用户身份（userId）
  - 创建时间
  - 会话状态

#### 值对象：

- SessionInfo: 包含会话 ID 和状态信息

#### 领域服务：

- **SessionService**：
  - createSession(): 创建新的会话
  - getSessionStatus(): 获取会话状态
  - closeSession(): 关闭会话

#### 用例：

1. 用户创建新会话
2. 用户查看会话状态
3. 用户关闭会话

### 2. MCP 管理领域（MCP Management Domain）

#### 聚合根：MCPInstance

- **标识**：MCP 名称（name）
- **实体**：
  - MCP 类型（stdio/sse）
  - MCP 连接配置
  - MCP 状态
  - MCP 工具列表

#### 值对象：

- MCPConfig: 包含名称、类型、命令或 URL
- MCPStatus: 连接状态（已连接/失败）
- MCPTool: 工具名称和功能

#### 领域服务：

- **MCPService**：
  - addMCP(config): 添加新的 MCP 服务
  - listMCPs(): 列出所有 MCP
  - reconnectMCP(name): 重新连接 MCP
  - deleteMCP(name): 删除 MCP
  - callMCPTool(mcpName, toolName, params): 调用 MCP 工具

#### 用例：

1. 用户添加新的 MCP 服务
2. 用户查看已连接的 MCP 服务列表
3. 用户重新连接 MCP 服务
4. 用户删除 MCP 服务
5. 用户调用 MCP 工具功能

### 3. 聊天交互领域（Chat Domain）

#### 聚合根：ChatHistory

- **标识**：与会话 ID 关联
- **实体**：
  - 消息列表
  - 聊天状态

#### 值对象：

- Message: 包含发送者、内容、时间戳和类型（用户/助手/系统）
- FunctionCall: 函数调用信息（函数名、参数、结果）

#### 领域服务：

- **ChatService**：
  - sendMessage(content): 发送用户消息
  - loadChatHistory(): 加载聊天历史
  - clearChat(): 清除聊天记录

#### 用例：

1. 用户发送消息
2. 用户查看聊天历史
3. 用户清除聊天记录
4. 系统记录函数调用信息

### 4. 功能测试领域（Function Test Domain）

#### 聚合根：FunctionTest

- **标识**：测试 ID
- **实体**：
  - 测试消息
  - 测试结果

#### 值对象：

- TestResult: 包含响应信息、工具调用和最终回复

#### 领域服务：

- **FunctionTestService**：
  - runTest(message): 运行功能测试
  - clearResults(): 清除测试结果

#### 用例：

1. 用户运行 Function Call 测试
2. 用户查看测试结果
3. 用户清除测试结果

## 应用服务层

### EventBusService

- 事件发布订阅服务，管理组件间通信

### NotificationService (Toast 管理)

- 处理用户界面通知

### WebSocketService

- 管理与后端的 WebSocket 连接

## 接口层

### API 接口

- `/api/session` (POST): 创建新会话
- `/api/mcp` (GET): 获取 MCP 列表
- `/api/mcp` (POST): 添加 MCP
- `/api/mcp/:name` (DELETE): 删除 MCP
- `/api/mcp/:name/reconnect` (POST): 重新连接 MCP
- `/api/chat/history` (GET): 获取聊天历史
- `/api/chat/message` (POST): 发送聊天消息
- `/api/chat/clear` (POST): 清除聊天历史
- `/api/function-test` (POST): 运行功能测试

### UI 组件接口

#### 1. 会话管理组件

- `SessionDisplay`: 显示当前会话信息
- `NewSessionButton`: 创建新会话的按钮

#### 2. MCP 管理组件

- `MCPForm`: MCP 添加表单
- `MCPList`: MCP 列表显示
- `MCPItem`: 单个 MCP 项目展示
- `MCPToolDialog`: MCP 工具调用对话框

#### 3. 聊天组件

- `ChatMessages`: 聊天消息显示
- `ChatInput`: 聊天输入框
- `FunctionCallDisplay`: 函数调用信息展示

#### 4. 功能测试组件

- `FunctionTestForm`: 功能测试表单
- `TestResults`: 测试结果显示

## 基础设施层

### 持久化服务

- `LocalStorageService`: 本地存储会话 ID 等信息

### 通信服务

- `APIClient`: 处理 HTTP 请求
- `SocketClient`: 处理 WebSocket 连接

## 用户体验设计规范

### 交互流程

1. **会话初始化流程**

   - 用户打开应用 → 尝试恢复之前的会话 → 若无会话则创建新会话 → 连接 WebSocket

2. **MCP 添加流程**

   - 用户填写 MCP 信息 → 验证表单 → 提交添加请求 → 显示成功/失败消息 → 更新 MCP 列表

3. **聊天交互流程**

   - 用户输入消息 → 发送消息 → 显示用户消息 → 等待 AI 响应 → 显示 AI 响应（包括函数调用）

4. **功能测试流程**
   - 用户输入测试消息 → 运行测试 → 显示测试结果（包括工具调用和最终响应）

### 布局与视觉风格

- 设计语言：简洁、现代、功能性
- 颜色方案：使用主色调 (#4f46e5)、成功色 (#10b981)、错误色 (#ef4444)
- 组件设计：卡片式布局、清晰的状态指示器、响应式设计

### 错误处理与通知

- 使用 Toast 通知系统提供即时反馈
- 详细的错误信息展示
- 状态指示器明确区分成功/失败状态

## 测试策略

根据 TDD 原则，需要确保测试覆盖率达到 90% 以上：

1. **单元测试**

   - 领域实体方法
   - 领域服务方法
   - 值对象验证

2. **集成测试**

   - API 接口测试
   - WebSocket 连接测试

3. **UI 组件测试**
   - 使用 Jest + Testing-Library 测试组件渲染和交互

## 文档规范

按照 DDD-文档驱动开发规范，所有公共接口和组件需要：

1. **组件文档**

   - JSDoc 注释
   - Storybook "Docs" 页面
   - 至少一个交互示例

2. **API 文档**
   - OpenAPI 规范文档
   - 示例请求/响应

## 实现优先级

1. **必要功能（P0）**

   - 会话创建与管理
   - MCP 连接与基本管理
   - 聊天功能

2. **重要功能（P1）**

   - MCP 工具调用
   - 聊天历史记录

3. **增强功能（P2）**
   - Function Call 测试
   - 更丰富的错误处理与反馈
