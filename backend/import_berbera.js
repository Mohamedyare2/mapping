const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        console.log('Reading addresses.json...');
        const data = JSON.parse(fs.readFileSync('C:/Users/Administrator/Desktop/Hanaqaad/Address/addresses.json', 'utf8'));

        console.log(`Found ${data.length} records. Getting max current number...`);
        const { data: maxRow } = await supabase
            .from('buildings')
            .select('number')
            .order('number', { ascending: false })
            .limit(1)
            .single();

        let nextNumber = (maxRow?.number || 0) + 1;
        console.log(`Starting to assign numbers from ${nextNumber}`);

        const rows = data.map(b => ({
            number: nextNumber++,
            latitude: b.lat,
            longitude: b.lng
        }));

        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { error } = await supabase.from('buildings').upsert(chunk, { onConflict: 'number' });
            if (error) {
                console.error('Error inserting chunk:', error);
                throw error;
            }
            inserted += chunk.length;
            if (inserted % 1000 === 0) console.log(`Inserted ${inserted} buildings...`);
        }
        console.log('✅ Successfully inserted all Berbera buildings!');
    } catch (err) {
        console.error('Script failed:', err);
    }
}

run();
