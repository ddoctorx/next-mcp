'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddMcpForm from '@/components/mcp/add-mcp-form';
import McpList from '@/components/mcp/mcp-list';
import ChatInterface from '@/components/mcp/chat-interface';
import FunctionCallTest from '@/components/mcp/function-call-test';
import SessionSelector from '@/components/session/session-selector';

export default function McpPage() {
  const [activeMcps, setActiveMcps] = useState(0);

  return (
    <main>
      <SessionSelector />

      <Tabs defaultValue="add-mcp">
        <TabsList className="w-full">
          <TabsTrigger value="add-mcp" className="flex-1" id="add-mcp-trigger">
            添加MCP
          </TabsTrigger>
          <TabsTrigger value="list-mcp" className="flex-1">
            已连接MCP
            <span className="ml-1 rounded-full h-5 w-5 bg-background text-xs flex items-center justify-center font-medium">
              {activeMcps}
            </span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1">
            聊天
          </TabsTrigger>
          <TabsTrigger value="test-function-call" className="flex-1">
            测试Function Call
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add-mcp" className="bg-card shadow-sm rounded-md p-6 mt-4">
          <AddMcpForm onMcpAdded={() => setActiveMcps(prev => prev + 1)} />
        </TabsContent>

        <TabsContent value="list-mcp" className="bg-card shadow-sm rounded-md p-6 mt-4">
          <McpList onMcpCountChange={setActiveMcps} />
        </TabsContent>

        <TabsContent value="chat" className="bg-card shadow-sm rounded-md p-6 mt-4">
          <ChatInterface />
        </TabsContent>

        <TabsContent value="test-function-call" className="bg-card shadow-sm rounded-md p-6 mt-4">
          <FunctionCallTest />
        </TabsContent>
      </Tabs>
    </main>
  );
}
