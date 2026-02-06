# 摸了么 - 极简聊天室

## 🎯 项目简介

"摸了么" 是一个简单纯粹的匿名聊天应用，专为办公室摸鱼、朋友闲聊而设计。打开应用自动登录，即刻开始聊天，实时显示在线人数，让聊天更加有趣。

## ✨ 核心功能

### 1. 自动匿名登录
- 打开应用自动创建匿名账户
- 无需注册，无需密码
- 快速开始聊天，零门槛

### 2. 实时聊天
- 消息实时同步，秒发送达
- 支持多人同时聊天
- 消息自动排序，最新消息在下方

### 3. 在线人数实时显示
- 标题栏实时显示当前在线人数
- 增强聊天氛围，了解当前活跃度
- 社牛福音，再也不用担心没人回消息

### 4. 个性化消息气泡
- 基于用户ID生成首字母头像
- 随机生成头像颜色，每个人独一无二
- 显示前6个字母作为用户名，保护隐私

### 5. 响应式设计
- 适配移动端和桌面端
- 支持深色和浅色主题
- 界面简洁，无干扰元素

## 🛠 技术栈

### 前端
- **React 19**：使用最新的 React 特性
- **Next.js 16**：App Router、Server Components
- **Tailwind CSS**：响应式设计，快速样式开发
- **Framer Motion**：平滑的动画效果

### 后端
- **Supabase**：一站式后端解决方案
  - PostgreSQL 数据库
  - 实时订阅功能
  - Presence 在线人数统计
  - 匿名认证

## 🚀 快速开始

### 开发环境

1. **克隆项目**
```bash
git clone https://github.com/yourusername/mo-le-me.git
cd mo-le-me
```

2. **安装依赖**
```bash
pnpm install
# 或
npm install
# 或
yarn install
```

3. **配置环境变量**

创建 `.env` 文件，添加以下内容：
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. **启动开发服务器**
```bash
pnpm dev
# 或
npm run dev
# 或
yarn dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 生产构建

```bash
pnpm run build
# 或
npm run build
# 或
yarn build
```

### 部署

项目已部署到 Vercel，访问链接：
- **主域名**：https://mo-le-me.vercel.app

## 📁 项目结构

```
/src
  /app
    /page.js          # 主聊天室页面
    /layout.js        # 根布局
    /api              # API 路由
  /components         # 组件
  /lib               # 工具函数
  /styles            # 样式文件
/public              # 静态资源
```

## 🎨 设计理念

- **简洁**：无干扰的聊天界面，专注于聊天本身
- **实时**：消息和在线人数实时更新，增强互动感
- **个性化**：每个用户都有独特的头像和颜色
- **隐私**：匿名登录，不收集个人信息
- **流畅**：平滑的动画效果，优秀的用户体验

## 🔧 核心代码

### 自动匿名登录
```javascript
if (!user) {
  // 使用 Supabase 的匿名认证
  const { data: authData } = await supabase.auth.signInAnonymously();
  if (authData.user) {
    setUser(authData.user);
  }
}
```

### 实时消息订阅
```javascript
const subscription = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    // 检查消息是否已经存在，避免重复添加
    setMessages(prev => {
      const exists = prev.some(msg => msg.id === payload.new.id);
      if (exists) return prev;
      return [...prev, payload.new];
    });
  })
  .subscribe();
```

### 在线人数统计
```javascript
const channel = supabase
  .channel('online-users', {
    config: {
      presence: {
        key: user.id
      }
    }
  })
  .on('presence', { event: 'sync' }, () => {
    const presences = channel.presenceState();
    const count = Object.keys(presences).reduce((acc, key) => {
      return acc + presences[key].length;
    }, 0);
    setOnlineCount(count);
  })
```

## 📝 未来规划

1. **消息持久化**：添加历史消息加载功能
2. **消息通知**：当有人@你的时候，发送浏览器通知
3. **表情包支持**：增加表情包功能，丰富聊天内容
4. **主题定制**：添加更多有趣的聊天主题
5. **消息撤回**：支持撤回已发送的消息

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

MIT License

## 📞 联系

- **项目地址**：https://github.com/yourusername/mo-le-me
- **在线演示**：https://mo-le-me.vercel.app

---

**摸鱼虽好，可不要贪杯哦～** 适度摸鱼，提高工作效率！