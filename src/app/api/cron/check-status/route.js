import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// 安全创建 Resend 客户端，避免缺少 API 密钥时构建失败
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 安全创建 Supabase 客户端，避免缺少 Service Role Key 时构建失败
const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

// 定义延时函数，用于规避 Resend 每秒 2 封的限制
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request) {
  // 1. 安全校验
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 检查必要的客户端是否可用
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        message: 'Supabase Service Role Key 未配置，无法查询用户数据',
        status: 500
      });
    }

    if (!resend) {
      return NextResponse.json({ 
        message: 'Resend API 密钥未配置，无法发送邮件',
        status: 500
      });
    }

    // 2. 获取所有待检查用户（包含自定义周期字段）
    const { data: allUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, emergency_email, last_check_in, check_interval_hours')
      .eq('is_alerted', false)
      .not('emergency_email', 'is', null);

    if (error) throw error;

    // 3. 在内存中筛选真正“失联”的用户
    const now = Date.now();
    const riskyUsers = (allUsers || []).filter(user => {
      const interval = (user.check_interval_hours || 40) * 60 * 60 * 1000;
      const lastCheckIn = new Date(user.last_check_in).getTime();
      return (now - lastCheckIn) > interval;
    });

    if (riskyUsers.length === 0) {
      return NextResponse.json({ message: '目前所有效用户均安全' });
    }

    const results = [];

    // 4. 串行发送邮件，防止触发 Rate Limit (429)
    for (const user of riskyUsers) {
      try {
        const { data: mailData, error: mailError } = await resend.emails.send({
          // 重要：改为你 Resend 验证成功的根域名
          from: '摸了么 <chat@mo-le-me.com>', 
          to: user.emergency_email,
          subject: `【消息通知】您的好友 ${user.email} 有新消息`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #3b82f6;">消息通知</h2>
              <p>您好，</p>
              <p>您的好友 <strong>${user.email}</strong> 在摸了么聊天室发送了新消息。</p>
              <p>发送时间：<strong>${new Date().toLocaleString()}</strong></p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="background: #eff6ff; padding: 15px; border-radius: 8px; color: #1e40af;">
                <strong>建议操作：</strong> 打开摸了么聊天室查看详细消息。
              </p>
              <p style="font-size: 11px; color: #999; margin-top: 30px;">
                此邮件由 摸了么 (mo-le-me.com) 自动发出。
              </p>
            </div>
          `
        });

        if (mailError) {
          results.push({ id: user.id, status: 'failed', error: mailError });
        } else {
          // 发送成功后更新数据库
          await supabaseAdmin
            .from('profiles')
            .update({ is_alerted: true })
            .eq('id', user.id);
          
          results.push({ id: user.id, status: 'sent', messageId: mailData.id });
        }
      } catch (innerErr) {
        results.push({ id: user.id, status: 'error', message: innerErr.message });
      }

      // 关键：每处理完一个用户，暂停 600 毫秒，确保每秒发信不超过 2 封
      await delay(600);
    }

    return NextResponse.json({ 
      totalProcessed: riskyUsers.length,
      details: results 
    });

  } catch (err) {
    console.error('Cron Global Error:', err);
    return new Response(err.message, { status: 500 });
  }
}