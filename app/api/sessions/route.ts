import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// 存储会话信息
type Session = {
  id: string;
  userId: string;
  mcpSessions: Record<string, any>;
  createdAt: Date;
};

// 内存存储会话信息
const sessions: Record<string, Session> = {};

// 创建新会话
export async function POST(request: Request) {
  try {
    // 确保只读取一次请求体
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: '缺少用户标识' }, { status: 400 });
    }

    const sessionId = uuidv4();
    sessions[sessionId] = {
      id: sessionId,
      userId,
      mcpSessions: {},
      createdAt: new Date(),
    };

    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json({ error: '创建会话失败' }, { status: 500 });
  }
}

// 获取所有会话
export async function GET() {
  return NextResponse.json({
    sessions: Object.values(sessions).map(session => ({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      mcpSessionCount: Object.keys(session.mcpSessions).length,
    })),
  });
}
