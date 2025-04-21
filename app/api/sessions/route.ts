import { NextResponse } from 'next/server';
import axios from 'axios';

// 存储会话信息
type Session = {
  id: string;
  userId: string;
  mcpSessions: Record<string, any>;
  createdAt: Date;
};

// 内存存储会话信息
const sessions: Record<string, Session> = {};

// 使用 Express 服务接口获取会话数据
export async function GET() {
  try {
    // 调用 Express 服务器的会话接口
    // 这避免了维护两套独立的会话存储
    const response = await axios.get('http://localhost:3000/api/sessions/list');
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json({ error: '获取会话列表失败', success: false }, { status: 500 });
  }
}

// 创建新会话
export async function POST(request: Request) {
  try {
    // 获取请求体，确保只解析一次
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);

    // 调用 Express 服务器创建会话
    const response = await axios.post('http://localhost:3000/api/sessions', body);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json({ error: '创建会话失败', success: false }, { status: 500 });
  }
}
