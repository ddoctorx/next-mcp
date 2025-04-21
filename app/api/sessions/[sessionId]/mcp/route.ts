import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

// 简化版 MCP 会话结构
type McpSession = {
  name: string;
  process?: any;
  tools?: any[];
  url?: string;
};

// 存储会话和 MCP 连接
const sessions: Record<
  string,
  {
    id: string;
    userId: string;
    mcpSessions: Record<string, McpSession>;
    createdAt: Date;
  }
> = {};

// 连接到 MCP
export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const { name, command, args } = body;

    if (!sessionId || !sessions[sessionId]) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    if (!name || !command) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 已经有同名 MCP 连接
    if (sessions[sessionId].mcpSessions[name]) {
      return NextResponse.json({ error: '已存在同名 MCP 连接' }, { status: 400 });
    }

    // 创建子进程
    const process = spawn(command, args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // 存储 MCP 会话
    sessions[sessionId].mcpSessions[name] = {
      name,
      process,
    };

    return NextResponse.json({
      message: `已连接到 MCP: ${name}`,
    });
  } catch (error) {
    console.error('连接 MCP 错误:', error);
    return NextResponse.json({ error: '连接 MCP 失败' }, { status: 500 });
  }
}

// 获取会话的所有 MCP 连接
export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  if (!sessionId || !sessions[sessionId]) {
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }

  const mcpSessions = Object.keys(sessions[sessionId].mcpSessions).map(mcpName => ({
    name: mcpName,
    hasTools: Boolean(sessions[sessionId].mcpSessions[mcpName].tools?.length),
  }));

  return NextResponse.json({ mcpSessions });
}

// 断开 MCP 连接
export async function DELETE(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params;
    const url = new URL(request.url);
    const mcpName = url.searchParams.get('name');

    if (!sessionId || !sessions[sessionId]) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    if (!mcpName || !sessions[sessionId].mcpSessions[mcpName]) {
      return NextResponse.json({ error: 'MCP 连接不存在' }, { status: 404 });
    }

    // 关闭进程
    const mcpSession = sessions[sessionId].mcpSessions[mcpName];
    if (mcpSession.process) {
      mcpSession.process.kill();
    }

    // 移除 MCP 会话
    delete sessions[sessionId].mcpSessions[mcpName];

    return NextResponse.json({
      message: `已断开 MCP 连接: ${mcpName}`,
    });
  } catch (error) {
    console.error('断开 MCP 错误:', error);
    return NextResponse.json({ error: '断开 MCP 连接失败' }, { status: 500 });
  }
}
