/**
 * run_boundary_filter.js
 * ======================
 * Deletes all buildings outside Somaliland using direct SQL via Supabase RPC.
 * Much faster than page-scanning because the DELETE runs server-side.
 *
 * Run: node run_boundary_filter.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'public' } }
);

// Somaliland bounding box (fast first pass)
// lon: 42.65 – 49.90,  lat: 8.00 – 11.55
const BBOX = {
    lon_min: 42.65,
    lon_max: 49.90,
    lat_min: 8.00,
    lat_max: 11.55,
};

async function countBuildings() {
    const { count, error } = await supabase
        .from('buildings')
        .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count;
}

async function deleteOutsideBbox() {
    console.log('\n[STEP 1] Deleting buildings outside Somaliland bounding box via SQL…');

    // We use rpc to run raw SQL because supabase-js REST doesn't support
    // multi-condition deletes across large tables without scanner timeouts.
    const sql = `
        DELETE FROM buildings
        WHERE longitude < ${BBOX.lon_min}
           OR longitude > ${BBOX.lon_max}
           OR latitude  < ${BBOX.lat_min}
           OR latitude  > ${BBOX.lat_max};
    `;

    const { data, error } = await supabase.rpc('run_sql', { query: sql });

    if (error) {
        // Fallback: use REST filter deletes in batches
        console.log('  RPC not available, falling back to REST batched delete…');
        await restBatchDelete();
    } else {
        console.log('  SQL DELETE executed successfully.');
        console.log('  Result:', data);
    }
}

async function restBatchDelete() {
    // Delete West
    await deleteBatch('longitude', 'lt', BBOX.lon_min, 'longitude < ' + BBOX.lon_min);
    // Delete East
    await deleteBatch('longitude', 'gt', BBOX.lon_max, 'longitude > ' + BBOX.lon_max);
    // Delete South
    await deleteBatch('latitude', 'lt', BBOX.lat_min, 'latitude < ' + BBOX.lat_min);
    // Delete North
    await deleteBatch('latitude', 'gt', BBOX.lat_max, 'latitude > ' + BBOX.lat_max);
}

async function deleteBatch(column, op, value, label) {
    let total = 0;
    console.log(`\n  Deleting where ${label}…`);
    while (true) {
        // Fetch IDs to delete
        let query = supabase.from('buildings').select('id').limit(500);
        if (op === 'lt') query = query.lt(column, value);
        else if (op === 'gt') query = query.gt(column, value);

        const { data, error } = await query;
        if (error) { console.error('  Fetch error:', error.message); break; }
        if (!data || data.length === 0) break;

        const ids = data.map(r => r.id);
        const { error: delErr } = await supabase.from('buildings').delete().in('id', ids);
        if (delErr) { console.error('  Delete error:', delErr.message); break; }

        total += ids.length;
        process.stdout.write(`\r    Deleted ${total} (${label})…`);
    }
    console.log(`\n  Done: ${total} deleted for [${label}]`);
    return total;
}

async function main() {
    console.log('='.repeat(60));
    console.log('  Somaliland Boundary Filter — Node.js Version');
    console.log(`  Started: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    const before = await countBuildings();
    console.log(`\nBuildings in DB before filter: ${before.toLocaleString()}`);

    await deleteOutsideBbox();

    const after = await countBuildings();
    console.log(`\nBuildings in DB after filter:  ${after.toLocaleString()}`);
    console.log(`Removed:                       ${(before - after).toLocaleString()}`);

    console.log('\n' + '='.repeat(60));
    console.log(`  Finished: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('\nFatal error:', err.message || err);
    process.exit(1);
});
