const { Router } = require('express');
const { supabase } = require('../config/supabase');
const { AppError } = require('../utils/errors');

const router = Router();

// Auth Middleware Stub
const requireAuth = (req, res, next) => {
  // Authentication logic stub
  next();
};

router.use(requireAuth);

router.get('/summary', async (req, res, next) => {
  try {
    const { branch_id, start_date, end_date } = req.query;
    if (!branch_id) throw new AppError('branch_id is required', 400);

    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('amount, type, groups!inner(branch_id)')
      .eq('groups.branch_id', branch_id)
      .gte('paid_at', start_date || '1970-01-01')
      .lte('paid_at', end_date || '2099-12-31');

    if (payError) throw new AppError('Error fetching payments', 500);

    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('amount')
      .eq('branch_id', branch_id)
      .gte('date', start_date || '1970-01-01')
      .lte('date', end_date || '2099-12-31');

    if (expError) throw new AppError('Error fetching expenses', 500);

    let totalRevenue = 0;
    let totalRefunds = 0;
    payments.forEach(p => {
      if (p.type === 'payment') totalRevenue += Number(p.amount);
      if (p.type === 'refund') totalRefunds += Number(p.amount);
    });

    let totalExpenses = 0;
    expenses.forEach(e => {
      totalExpenses += Number(e.amount);
    });

    const netProfit = (totalRevenue - totalRefunds) - totalExpenses;

    res.json({
      status: 'success',
      data: {
        totalRevenue,
        totalRefunds,
        totalExpenses,
        netProfit
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/group-roi/:groupId', async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('monthly_fee, teacher_share_percentage')
      .eq('id', groupId)
      .single();

    if (groupError || !group) throw new AppError('Group not found', 404);

    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('amount, type')
      .eq('group_id', groupId);

    if (payError) throw new AppError('Error fetching payments', 500);

    let totalRevenue = 0;
    payments.forEach(p => {
      if (p.type === 'payment') totalRevenue += Number(p.amount);
      if (p.type === 'refund') totalRevenue -= Number(p.amount);
    });

    const teacherShare = totalRevenue * (group.teacher_share_percentage / 100);
    const roi = totalRevenue - teacherShare;

    res.json({
      status: 'success',
      data: {
        groupId,
        totalRevenue,
        teacherShare,
        roi
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
