import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MCP 注册实现',
  description: '简单的 MCP 注册实现',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-4 mb-6">
            <Link href="/" className="text-2xl font-semibold text-primary">
              MCP管理界面
            </Link>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <Link
                href="/sessions"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                会话管理
              </Link>
              <Link href="/mcp" className="text-sm text-muted-foreground hover:text-foreground">
                MCP连接
              </Link>
            </div>
          </header>
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
