import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 -mt-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between">
        <h1 className="text-4xl font-bold mb-4">MCP 注册实现</h1>
        <p className="text-xl mb-8">欢迎使用我们的全栈 MCP 注册与管理系统</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-2xl font-bold mb-4">会话管理</h2>
            <p className="mb-4 text-muted-foreground">创建和管理您的 MCP 会话，组织您的连接。</p>
            <Link href="/sessions">
              <Button>进入会话管理</Button>
            </Link>
          </div>

          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-2xl font-bold mb-4">MCP 连接</h2>
            <p className="mb-4 text-muted-foreground">
              连接和管理各种 MCP 服务，使用多种工具功能。
            </p>
            <Link href="/mcp">
              <Button>管理 MCP</Button>
            </Link>
          </div>
        </div>

        <div className="border-t pt-8">
          <h2 className="text-2xl font-bold mb-4">功能特点</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <li className="flex items-start">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2 text-sm">
                ✓
              </div>
              <div>
                <h3 className="font-medium">多会话管理</h3>
                <p className="text-sm text-muted-foreground">组织和管理多个独立的会话</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2 text-sm">
                ✓
              </div>
              <div>
                <h3 className="font-medium">多类型 MCP</h3>
                <p className="text-sm text-muted-foreground">支持 stdio 和 sse 类型的 MCP 连接</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2 text-sm">
                ✓
              </div>
              <div>
                <h3 className="font-medium">聊天界面</h3>
                <p className="text-sm text-muted-foreground">通过 AI 聊天直接使用 MCP 工具</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2 text-sm">
                ✓
              </div>
              <div>
                <h3 className="font-medium">函数调用测试</h3>
                <p className="text-sm text-muted-foreground">测试 MCP 的函数调用能力</p>
              </div>
            </li>
          </ul>

          <div className="text-center mt-8">
            <Link href="/api/sessions" target="_blank">
              <Button variant="outline">API 文档</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
