const { Composer } = require('telegraf');

const teacherComposer = new Composer();

teacherComposer.command('menu', (ctx) => {
  const user = ctx.state.user;
  ctx.reply(`Welcome ${user.full_name}! Here are your options:\n\n/attendance - Record student attendance\n/expense - Log a new expense`,
    {
      reply_markup: {
        keyboard: [
          [{ text: '/attendance' }, { text: '/expense' }]
        ],
        resize_keyboard: true
      }
    }
  );
});

module.exports = { teacherComposer };
