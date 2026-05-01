const { Router } = require('express');
const { supabase } = require('../config/supabase');
const { AppError } = require('../utils/errors');

const router = Router();

router.get('/churn-features', async (req, res, next) => {
  try {
    const { data: students, error: stdError } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('status', 'active');

    if (stdError) throw new AppError('Error fetching students', 500);

    const features = [];
    
    const tzOffset = 5 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(Date.now() + tzOffset - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const { data: attendances } = await supabase
      .from('attendance')
      .select('student_id, status')
      .gte('date', thirtyDaysAgo);
      
    const { data: assessments } = await supabase
      .from('student_assessments')
      .select('student_id, score, max_score');
      
    const { data: payments } = await supabase
      .from('payments')
      .select('student_id, for_month, paid_at');

    for (const student of students) {
      const studentId = student.id;
      
      const studentAtt = attendances?.filter(a => a.student_id === studentId) || [];
      const totalAtt = studentAtt.length;
      const presentCount = studentAtt.filter(a => a.status === 'present').length;
      const attendanceRate = totalAtt > 0 ? presentCount / totalAtt : 0;
      
      const studentAsses = assessments?.filter(a => a.student_id === studentId) || [];
      let totalScore = 0;
      let totalMaxScore = 0;
      studentAsses.forEach(a => {
        totalScore += Number(a.score);
        totalMaxScore += Number(a.max_score);
      });
      const avgScore = totalMaxScore > 0 ? totalScore / totalMaxScore : 0;
      
      const studentPayments = payments?.filter(a => a.student_id === studentId) || [];
      let paymentDelays = 0;
      studentPayments.forEach(p => {
        const forMonthDate = new Date(p.for_month);
        const paidDate = new Date(p.paid_at);
        if (paidDate > forMonthDate) {
          paymentDelays++;
        }
      });
      
      features.push({
        student_id: studentId,
        attendance_rate_30d: attendanceRate,
        avg_score: avgScore,
        payment_delays: paymentDelays
      });
    }

    res.json(features);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
