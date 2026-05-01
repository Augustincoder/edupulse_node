const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
  global: {
    headers: {
      'x-application-name': 'edupulse-backend'
    }
  }
});

module.exports = { supabase };
