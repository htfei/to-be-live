import "./globals.css";
import { ThemeProvider } from '@/components/theme-provider'
import { InstallPWA } from '@/components/InstallPWA'
import { Toaster } from 'sonner';

export const metadata = {
  title: '摸了么 - 极简聊天室',
  description: '简单纯粹的匿名聊天应用',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '摸了么',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          {/* 配置移动端友好的弹出位置 */}
          <Toaster position="top-center" richColors />
          <InstallPWA /> {/* 添加到桌面引导 */}
        </ThemeProvider>
      </body>
    </html>
  );
}
