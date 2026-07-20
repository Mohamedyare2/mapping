require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('Querying for buildings with longitude < 43.0 (Outside Somaliland western border)');

    let deletedCount = 0;

    while (true) {
        const { data, error } = await supabase
            .from('buildings')
            .select('id')
            .lt('longitude', 43.0)
            .limit(1000);

        if (error) {
            console.error('Error fetching:', error);
            break;
        }

        if (!data || data.length === 0) {
            console.log('No more buildings found outside boundary.');
            break;
        }

        const ids = data.map(b => b.id);
        const { error: delError } = await supabase.from('buildings').delete().in('id', ids);

        if (delError) {
            console.error('Error deleting batch:', delError);
            break;
        }

        deletedCount += ids.length;
        console.log(`Deleted ${deletedCount} buildings so far...`);
    }

    console.log('Finished deleting out-of-bounds buildings (West). Total deleted:', deletedCount);

    // Check East (>49.0)
    while (true) {
        const { data } = await supabase.from('buildings').select('id').gt('longitude', 49.0).limit(1000);
        if (!data || data.length === 0) break;
        const ids = data.map(b => b.id);
        await supabase.from('buildings').delete().in('id', ids);
        console.log(`Deleted ${ids.length} in East.`);
    }

    // Check South (<8.0)
    while (true) {
        const { data } = await supabase.from('buildings').select('id').lt('latitude', 8.0).limit(1000);
        if (!data || data.length === 0) break;
        const ids = data.map(b => b.id);
        await supabase.from('buildings').delete().in('id', ids);
        console.log(`Deleted ${ids.length} in South.`);
    }

    // Check North (>11.5)
    while (true) {
        const { data } = await supabase.from('buildings').select('id').gt('latitude', 11.5).limit(1000);
        if (!data || data.length === 0) break;
        const ids = data.map(b => b.id);
        await supabase.from('buildings').delete().in('id', ids);
        console.log(`Deleted ${ids.length} in North.`);
    }
}
run();
