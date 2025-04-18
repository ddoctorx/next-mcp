# MCP 管理系统

这是一个简单的 MCP（Model Control Protocol）管理系统，允许您连接和管理多个 MCP 服务，并通过 OpenAI API 与这些工具对话。

## 功能

- 🚀 注册和管理多个 MCP 服务
- 🔌 支持 stdio 和 sse 类型的 MCP
- 🔧 查看和调用 MCP 提供的工具
- 💬 通过 OpenAI API 与 MCP 工具对话
- 🤖 支持 OpenAI 的函数调用功能

## 安装

1. 克隆项目

```bash
git clone https://github.com/yourusername/node-mcp.git
cd node-mcp
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

```bash
cp .env.example .env
```

然后编辑`.env`文件，填写您的 OpenAI API 密钥:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## 启动

```bash
npm start
```

服务器将在 http://localhost:3000 启动。

## 使用说明

### 添加 MCP 服务

1. 打开浏览器访问 http://localhost:3000
2. 在"添加 MCP"标签页中填写表单:
   - 名称: 为 MCP 服务指定一个名称
   - 类型: 选择 stdio 或 sse
   - 命令: 例如 `npx -y @stripe/mcp --tools=all --api-key=YOUR_KEY`, `npx -y external-mcp-service`
3. 点击"添加 MCP"按钮

### 使用聊天功能

1. 添加至少一个 MCP 服务
2. 切换到"聊天"标签页
3. 在输入框中输入消息，例如询问如何使用某个工具
4. AI 会根据您的问题提供回答，并在需要时调用 MCP 工具

### 示例对话

用户: "我需要查询天气信息"

AI: "我可以帮您查询天气信息。请告诉我您想查询哪个城市的天气？"

用户: "北京"

AI: _调用天气工具_ "北京当前天气为晴，温度 22°C，湿度 45%..."

## 开发

### 项目结构

- `src/server.js`: 主服务器文件
- `src/openai.js`: OpenAI API 集成
- `src/tools/`: 内置工具目录
- `public/`: 前端文件

### 添加新工具

1. 在`src/tools/`目录下创建新的工具文件
2. 在`src/tools/index.js`中注册工具
3. 工具必须实现`execute`方法

## 许可证

MIT
