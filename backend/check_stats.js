require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('Querying for min/max coordinates...');

    // Just get random 10 buildings to check
    const { data: rand, error: err1 } = await supabase.from('buildings').select('latitude, longitude').limit(10);
    console.log('Random buildings:', rand);

    // Let's get the bounds manually using PostGIS or just sorting
    const { data: minLng, error: err2 } = await supabase.from('buildings').select('latitude, longitude').order('longitude', { ascending: true }).limit(5);
    console.log('5 Buildings with smallest longitude:', minLng);

    const { data: maxLng, error: err3 } = await supabase.from('buildings').select('latitude, longitude').order('longitude', { ascending: false }).limit(5);
    console.log('5 Buildings with largest longitude:', maxLng);

    const { data: minLat, error: err4 } = await supabase.from('buildings').select('latitude, longitude').order('latitude', { ascending: true }).limit(5);
    console.log('5 Buildings with smallest latitude:', minLat);

    const { data: maxLat, error: err5 } = await supabase.from('buildings').select('latitude, longitude').order('latitude', { ascending: false }).limit(5);
    console.log('5 Buildings with largest latitude:', maxLat);

}
run();
