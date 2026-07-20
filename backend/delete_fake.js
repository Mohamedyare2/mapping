require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        console.log('Deleting fake 5000 buildings imported recently (number >= 215552)...');
        const { data, error } = await supabase
            .from('buildings')
            .delete()
            .gte('number', 215552);

        if (error) throw error;

        console.log('✅ Deleted successfully.');
    } catch (err) {
        console.error('Failure:', err);
    }
}

run();
