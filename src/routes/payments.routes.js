const { Router } = require('express');
const { z } = require('zod');
const { supabase } = require('../config/supabase');
const { AppError } = require('../utils/errors');

const router = Router();

const paymentSchema = z.object({
  student_id: z.string().uuid(),
  group_id: z.string().uuid(),
  amount: z.number().positive(),
  for_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']),
  type: z.enum(['payment', 'refund'])
});

// Auth stub
router.use((req, res, next) => {
  req.user = { id: '00000000-0000-0000-0000-000000000000' }; // Stub
  next();
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }

    const paymentData = {
      ...parsed.data,
      recorded_by: req.user.id
    };

    const { error } = await supabase
      .from('payments')
      .insert([paymentData]);

    if (error) throw new AppError('Failed to record payment: ' + error.message, 500);

    res.json({ status: 'success', message: 'Payment recorded' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
