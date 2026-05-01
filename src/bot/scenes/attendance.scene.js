const { Scenes, Markup } = require('telegraf');
const { supabase } = require('../../config/supabase');

const attendanceScene = new Scenes.WizardScene(
  'ATTENDANCE_SCENE',
  async (ctx) => {
    try {
      const { data: groups, error } = await supabase
        .from('groups')
        .select('id, subject, schedule_info')
        .eq('teacher_id', ctx.state.user.id)
        .eq('status', 'active');

      if (error || !groups || groups.length === 0) {
        await ctx.reply('No active groups found for you.');
        return ctx.scene.leave();
      }

      const buttons = groups.map(g => [Markup.button.callback(`${g.subject} (${g.schedule_info || 'No schedule'})`, `GROUP_${g.id}`)]);
      
      await ctx.reply('Please select a group for attendance:', Markup.inlineKeyboard(buttons));
      return ctx.wizard.next();
    } catch (err) {
      console.error(err);
      await ctx.reply('Error fetching groups.');
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('GROUP_')) {
      return ctx.reply('Please select a group from the buttons.');
    }

    const groupId = ctx.callbackQuery.data.replace('GROUP_', '');
    ctx.scene.session.groupId = groupId;

    try {
      const { data: activeStudents, error } = await supabase
        .from('group_students')
        .select(`
          student_id,
          students!inner (
            id,
            full_name,
            status
          )
        `)
        .eq('group_id', groupId)
        .is('left_at', null);

      if (error) {
        console.error('Error fetching students:', error);
        await ctx.reply('Failed to fetch students.');
        return ctx.scene.leave();
      }

      const actualStudents = activeStudents.filter(s => s.students.status === 'active');
      
      if (actualStudents.length === 0) {
        await ctx.reply('No active students found in this group.');
        return ctx.scene.leave();
      }

      const attendanceState = {};
      actualStudents.forEach(s => {
        attendanceState[s.student_id] = {
          name: s.students.full_name,
          status: 'present'
        };
      });
      ctx.scene.session.attendanceState = attendanceState;

      await renderAttendanceKeyboard(ctx);
      return ctx.wizard.next();
    } catch (err) {
      console.error(err);
      await ctx.reply('Error initializing attendance.');
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const data = ctx.callbackQuery.data;

    if (data === 'SAVE_ATTENDANCE') {
      const state = ctx.scene.session.attendanceState;
      const groupId = ctx.scene.session.groupId;
      const recordedBy = ctx.state.user.id;
      const tzOffset = 5 * 60 * 60 * 1000;
      const localDate = new Date(Date.now() + tzOffset).toISOString().split('T')[0];

      const records = Object.keys(state).map(studentId => ({
        group_id: groupId,
        student_id: studentId,
        date: localDate,
        status: state[studentId].status,
        recorded_by: recordedBy
      }));

      try {
        const { error } = await supabase
          .from('attendance')
          .upsert(records, {
            onConflict: 'group_id,student_id,date',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('Upsert error:', error);
          await ctx.reply('Failed to save attendance.');
        } else {
          const presentCount = Object.values(state).filter(s => s.status === 'present').length;
          await ctx.editMessageText(`Attendance saved successfully! ✅\nDate: ${localDate}\nPresent: ${presentCount}/${records.length}`);
        }
      } catch (err) {
        console.error(err);
        await ctx.reply('Internal error saving attendance.');
      }
      return ctx.scene.leave();
    } else if (data.startsWith('TOGGLE_')) {
      const studentId = data.replace('TOGGLE_', '');
      const state = ctx.scene.session.attendanceState;
      
      if (state[studentId]) {
        state[studentId].status = state[studentId].status === 'present' ? 'absent' : 'present';
        await renderAttendanceKeyboard(ctx, true);
      }
      return;
    }
  }
);

async function renderAttendanceKeyboard(ctx, isEdit = false) {
  const state = ctx.scene.session.attendanceState;
  const buttons = [];

  for (const [studentId, info] of Object.entries(state)) {
    const icon = info.status === 'present' ? '✅' : '❌';
    buttons.push([Markup.button.callback(`${info.name} ${icon}`, `TOGGLE_${studentId}`)]);
  }

  buttons.push([Markup.button.callback('Save 💾', 'SAVE_ATTENDANCE')]);

  const markup = Markup.inlineKeyboard(buttons);
  const text = 'Toggle attendance and click Save:';

  if (isEdit) {
    await ctx.editMessageText(text, markup).catch(e => console.error(e));
  } else {
    await ctx.reply(text, markup);
  }
}

module.exports = { attendanceScene };
