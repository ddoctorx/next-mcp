# MCP 注册实现系统

这是一个使用 Next.js + Tailwind CSS + shadcn/ui 的全栈应用程序，用于管理 MCP（机器控制协议）的注册和连接。

## 技术栈

### 前端

- Next.js 14
- React 18
- Tailwind CSS
- shadcn/ui 组件库
- TypeScript
- Socket.io 客户端

### 后端

- Node.js
- Express
- Socket.io 服务器
- TypeScript

## 功能特点

- 会话管理：创建和查看会话
- MCP 连接管理：连接、断开和监控 MCP 进程
- 实时通信：使用 Socket.io 实现实时更新
- 响应式 UI：适配各种设备屏幕尺寸
- 类型安全：使用 TypeScript 确保代码质量

## 安装和运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm start
```

## 项目结构

```
/
├── app/                # Next.js 应用代码
│   ├── api/            # API 路由
│   ├── sessions/       # 会话相关页面
│   ├── globals.css     # 全局样式
│   ├── layout.tsx      # 应用布局
│   └── page.tsx        # 首页
├── components/         # React 组件
│   └── ui/             # UI 组件库
├── lib/                # 工具函数
├── public/             # 静态资源
└── src/                # 后端源码（兼容旧版）
```

## API 路由

- `GET /api/sessions` - 获取所有会话
- `POST /api/sessions` - 创建新会话
- `GET /api/sessions/:id/mcp` - 获取会话的 MCP 连接
- `POST /api/sessions/:id/mcp` - 创建 MCP 连接
- `DELETE /api/sessions/:id/mcp` - 断开 MCP 连接

## 使用方法

1. 访问首页，点击"会话管理"进入会话列表
2. 创建新会话或查看现有会话
3. 在会话详情页连接新的 MCP 或管理现有连接

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
