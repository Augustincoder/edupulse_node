const { Scenes, Markup } = require('telegraf');
const { supabase } = require('../../config/supabase');

const expenseScene = new Scenes.WizardScene(
  'EXPENSE_SCENE',
  async (ctx) => {
    await ctx.reply('Please enter the expense amount (numbers only):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const amount = parseFloat(ctx.message.text);
    
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Invalid amount. Please enter a valid number:');
    }
    ctx.scene.session.amount = amount;

    try {
      const { data: categories, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('branch_id', ctx.state.user.branch_id)
        .eq('is_active', true);

      if (error || !categories || categories.length === 0) {
        await ctx.reply('No active expense categories found for your branch.');
        return ctx.scene.leave();
      }

      const buttons = categories.map(c => [Markup.button.callback(c.name, `CAT_${c.id}`)]);
      await ctx.reply('Select an expense category:', Markup.inlineKeyboard(buttons));
      return ctx.wizard.next();
    } catch (err) {
      console.error(err);
      await ctx.reply('Error fetching categories.');
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('CAT_')) {
      return ctx.reply('Please select a category from the buttons.');
    }
    const categoryId = ctx.callbackQuery.data.replace('CAT_', '');
    ctx.scene.session.categoryId = categoryId;

    await ctx.editMessageText('Is this a Payroll (Salary) expense or an External expense?', 
      Markup.inlineKeyboard([
        [Markup.button.callback('Payroll (Salary)', 'TYPE_PAYROLL')],
        [Markup.button.callback('External', 'TYPE_EXTERNAL')]
      ])
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const type = ctx.callbackQuery.data;

    if (type === 'TYPE_PAYROLL') {
      ctx.scene.session.isPayroll = true;
      try {
        const { data: employees, error } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('branch_id', ctx.state.user.branch_id)
          .eq('is_active', true);

        if (error || !employees || employees.length === 0) {
          await ctx.reply('No active employees found.');
          return ctx.scene.leave();
        }

        const buttons = employees.map(e => [Markup.button.callback(e.full_name, `EMP_${e.id}`)]);
        await ctx.editMessageText('Select the employee:', Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
      } catch (err) {
        console.error(err);
        await ctx.reply('Error fetching employees.');
        return ctx.scene.leave();
      }
    } else if (type === 'TYPE_EXTERNAL') {
      ctx.scene.session.isPayroll = false;
      await ctx.editMessageText('Please type the name of the external payee:');
      return ctx.wizard.next();
    }
  },
  async (ctx) => {
    if (ctx.scene.session.isPayroll) {
      if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('EMP_')) {
        return ctx.reply('Please select an employee from the buttons.');
      }
      ctx.scene.session.employeeId = ctx.callbackQuery.data.replace('EMP_', '');
      await ctx.editMessageText('Please enter a description for this expense:');
    } else {
      if (!ctx.message || !ctx.message.text) return;
      ctx.scene.session.externalPayee = ctx.message.text;
      await ctx.reply('Please enter a description for this expense:');
    }
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const description = ctx.message.text;

    try {
      const expenseData = {
        branch_id: ctx.state.user.branch_id,
        recorded_by: ctx.state.user.id,
        amount: ctx.scene.session.amount,
        category_id: ctx.scene.session.categoryId,
        description: description,
        is_payroll: ctx.scene.session.isPayroll,
      };

      if (ctx.scene.session.isPayroll) {
        expenseData.employee_id = ctx.scene.session.employeeId;
      } else {
        expenseData.external_payee = ctx.scene.session.externalPayee;
      }

      const { error } = await supabase.from('expenses').insert([expenseData]);

      if (error) {
        console.error('Error saving expense:', error);
        await ctx.reply('Failed to save the expense.');
      } else {
        await ctx.reply('Expense logged successfully! ✅');
      }
    } catch (err) {
      console.error(err);
      await ctx.reply('Internal error while saving expense.');
    }
    return ctx.scene.leave();
  }
);

module.exports = { expenseScene };
