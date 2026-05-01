const { Telegraf, Scenes } = require('telegraf');
const Redis = require('ioredis');
const { env } = require('../config/env');
const { authenticateTelegramUser } = require('./middlewares/auth.bot');
const { teacherComposer } = require('./composers/teacher.composer');
const { attendanceScene } = require('./scenes/attendance.scene');
const { expenseScene } = require('./scenes/expense.scene');

const bot = new Telegraf(env.BOT_TOKEN);

const redis = new Redis(env.REDIS_URL, { lazyConnect: true });
redis.on('error', (err) => console.error('Redis error:', err));

const redisSession = () => async (ctx, next) => {
  const key = `session:${ctx.from?.id}:${ctx.chat?.id}`;
  if (!ctx.from || !ctx.chat) return next();

  try {
    const sessionData = await redis.get(key);
    ctx.session = sessionData ? JSON.parse(sessionData) : {};
  } catch (err) {
    ctx.session = {};
  }

  await next();

  try {
    if (ctx.session) {
      await redis.set(key, JSON.stringify(ctx.session));
    }
  } catch (err) {
    console.error('Failed to save session:', err);
  }
};

bot.use(redisSession());

const stage = new Scenes.Stage([attendanceScene, expenseScene]);
bot.use(stage.middleware());

bot.use(authenticateTelegramUser);
bot.use(teacherComposer);

bot.command('attendance', (ctx) => ctx.scene.enter('ATTENDANCE_SCENE'));
bot.command('expense', (ctx) => ctx.scene.enter('EXPENSE_SCENE'));

bot.start((ctx) => {
  ctx.reply('Welcome to EduPulse Bot! Type /menu to see options.');
});

module.exports = { bot };
