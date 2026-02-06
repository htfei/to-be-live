"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

import {
  Send,
  MessageCircle,
  LogOut,
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from 'sonner';

export default function ToBeLiveApp() {
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // 消息相关状态
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false); // 消息发送状态
  // 在线人数状态
  const [onlineCount, setOnlineCount] = useState(0);

  // 更新网页标题，包含在线人数
  useEffect(() => {
    document.title = `摸了么 - ${onlineCount}人在线`;
  }, [onlineCount]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // 如果用户未登录，使用Supabase提供的匿名登录接口
        if (!user) {
          // 使用Supabase的匿名认证
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
          
          if (authError) {
            throw authError;
          }
          
          if (authData.user) {
            setUser(authData.user);
          }
        } else {
          // 用户已登录
          setUser(user);
        }
      } catch (err) {
        console.error("认证错误:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase]);

  // 获取消息列表
  const fetchMessages = async (limit = 10) => {
    if (!user) return;
    
    setLoadingMessages(true);
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false }) // 降序获取最新的消息
        .limit(limit);
      
      if (error) {
        throw error;
      }
      
      // 反转数组，保持最新的消息在最下方
      setMessages(data.reverse());
    } catch (err) {
      console.error('获取消息失败:', err);
      toast.error('获取消息失败，请重试');
    } finally {
      setLoadingMessages(false);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!user || !newMessage.trim() || isSendingMessage) return;
    
    setIsSendingMessage(true);
    const messageContent = newMessage.trim();
    
    try {
      // 只插入消息，不获取返回值
      const { error } = await supabase
        .from('messages')
        .insert({
          content: messageContent,
          user_id: user.id,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        throw error;
      }
      
      // 清空输入框
      setNewMessage('');
      
      toast.success('消息发送成功');
    } catch (err) {
      console.error('发送消息失败:', err);
      toast.error('发送消息失败，请重试');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // 根据字符串生成哈希颜色
  const stringToColor = (str) => {
    const hash = str.split('').reduce((acc, char) => {
      acc = ((acc << 5) - acc) + char.charCodeAt(0);
      return acc & acc;
    }, 0);
    const c = (hash & 0x00FFFFFF)
      .toString(16)
      .toUpperCase();
    return `#${'00000'.substring(0, 6 - c.length)}${c}`;
  };

  // 初始化消息订阅和在线人数统计
  useEffect(() => {
    if (!user) return;
    
    // 首次加载消息
    fetchMessages();
    
    // 创建带有 Presence 功能的通道
    const channel = supabase
      .channel('online-users', {
        config: {
          presence: {
            key: user.id // 使用用户ID作为 Presence 的 key
          }
        }
      })
      // 订阅消息变更
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        // 检查消息是否已经存在，避免重复添加
        setMessages(prev => {
          // 检查消息ID是否已存在
          const exists = prev.some(msg => msg.id === payload.new.id);
          if (exists) {
            return prev;
          }
          // 新消息添加到列表
          return [...prev, payload.new];
        });
      })
      // 订阅 Presence 状态变更
      .on('presence', { event: 'sync' }, () => {
        const presences = channel.presenceState();
        // 计算在线人数
        const count = Object.keys(presences).reduce((acc, key) => {
          return acc + presences[key].length;
        }, 0);
        setOnlineCount(count);
      })
      // 订阅用户加入事件
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presences = channel.presenceState();
        // 计算在线人数
        const count = Object.keys(presences).reduce((acc, key) => {
          return acc + presences[key].length;
        }, 0);
        setOnlineCount(count);
      })
      // 订阅用户离开事件
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const presences = channel.presenceState();
        // 计算在线人数
        const count = Object.keys(presences).reduce((acc, key) => {
          return acc + presences[key].length;
        }, 0);
        setOnlineCount(count);
      })
      .subscribe();
    
    // 广播用户在线状态
    channel.track({
      user_id: user.id,
      online_at: new Date().toISOString()
    });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 消息加载状态
  if (loading)
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-text">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-app-bg text-app-text flex flex-col items-center p-4 relative overflow-hidden transition-colors duration-300">
      {/* 消息列表 */}
      <div className="flex-1 w-full w-full overflow-hidden flex flex-col">
        {/* 消息内容区域 */}
        <div 
          className="flex-1 overflow-y-auto pb-4 space-y-4"
          style={{ 
            maxHeight: 'calc(100vh - 150px)',
            // 隐藏滚动条
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none' /* IE and Edge */
          }}
        >
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-app-text opacity-50">
              <p className="text-center">暂无消息，开始聊天吧！</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                // 检查是否是当前用户的消息
                const isCurrentUser = message.user_id === user?.id;
                // 生成头像颜色
                const avatarColor = stringToColor(message.user_id || 'default');
                // 生成用户名（前6个字母小写）
                const username = message.user_id?.substring(0, 6).toLowerCase() || 'user';
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col"
                  >
                    {isCurrentUser ? (
                      // 当前用户的消息显示在右侧
                      <div className="flex items-start justify-end gap-3">
                        {/* 消息气泡 */}
                        <div className="flex-1">
                          <div className="bg-app-bg rounded-2xl p-4 max-w-[80%] border border-app-border shadow-sm ml-auto">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs opacity-60">
                                {new Date(message.created_at).toLocaleString()}
                              </p>
                              <p className="text-sm font-medium">
                                {username}
                              </p>
                            </div>
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                        </div>
                        {/* 用户头像 */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                          {username.substring(0, 1).toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      // 其他用户的消息显示在左侧
                      <div className="flex items-start gap-3">
                        {/* 用户头像 */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                          {username.substring(0, 1).toUpperCase()}
                        </div>
                        {/* 消息气泡 */}
                        <div className="flex-1">
                          <div className="bg-app-bg rounded-2xl p-4 max-w-[80%] border border-app-border shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium">
                                {username}
                              </p>
                              <p className="text-xs opacity-60">
                                {new Date(message.created_at).toLocaleString()}
                              </p>
                            </div>
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </>
          )}
        </div>

        {/* 消息输入区域 */}
        <div className="border-t border-app-border pt-4 mt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="输入消息..."
              className="flex-1 bg-app-bg border border-app-border rounded-2xl py-3 pl-4 pr-12 focus:ring-1 focus:ring-app-accent outline-none text-app-text"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSendingMessage}
              className="p-3 bg-app-accent text-white rounded-2xl flex items-center justify-center disabled:opacity-50"
            >
              {isSendingMessage ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}