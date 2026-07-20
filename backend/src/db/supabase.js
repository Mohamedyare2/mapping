/**
 * Supabase client — uses service role key for privileged server-side operations
 */
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables. ' +
        'Please copy backend/.env.example to backend/.env and fill in your Supabase credentials.'
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false },
        db: { schema: 'public' },
    }
);

module.exports = supabase;
