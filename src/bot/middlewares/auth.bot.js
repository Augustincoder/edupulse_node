const { supabase } = require('../../config/supabase');

const authenticateTelegramUser = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('Authentication failed');

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !user || !user.is_active) {
      return ctx.reply('Access Denied: You are not authorized to use this bot.');
    }

    if (!ctx.state) ctx.state = {};
    ctx.state.user = user;
    
    await next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return ctx.reply('An error occurred during authentication.');
  }
};

module.exports = { authenticateTelegramUser };
