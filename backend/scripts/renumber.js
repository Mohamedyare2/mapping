require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('Fetching all buildings...');

    let allBuildings = [];
    let page = 0;
    const limit = 500;
    while (true) {
        const { data, error } = await supabase
            .from('buildings')
            .select('id')
            .order('id')
            .range(page * limit, (page + 1) * limit - 1);

        if (error) {
            console.error('Error fetching:', error);
            return;
        }
        if (!data || data.length === 0) break;

        allBuildings = allBuildings.concat(data);
        page++;
    }
    const buildings = allBuildings;

    console.log(`Found ${buildings.length} buildings. Updating numbers sequentially...`);

    // Process in batches so we don't overwhelm Supabase
    const batchSize = 100;

    for (let i = 0; i < buildings.length; i += batchSize) {
        const batch = buildings.slice(i, i + batchSize);
        // We will do a Promise.all for each batch
        console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(buildings.length / batchSize)}...`);

        await Promise.all(batch.map((b, index) => {
            const uniqueNumber = i + index + 1; // start from 1 to N
            return supabase.from('buildings').update({ number: uniqueNumber }).eq('id', b.id);
        }));
    }

    console.log('Successfully renumbered all buildings!');
}

run();
