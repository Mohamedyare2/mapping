require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        console.log('Reading berbera_buildings.geojson...');
        const raw = fs.readFileSync('berbera_buildings.geojson', 'utf8');
        const geojson = JSON.parse(raw);
        const features = geojson.features || [];

        console.log(`Loaded ${features.length} buildings.`);

        const { data: maxRow } = await supabase
            .from('buildings')
            .select('number')
            .order('number', { ascending: false })
            .limit(1)
            .single();

        let number = (maxRow?.number || 0) + 1;
        console.log(`Starting insertion from number ${number}...`);

        const rows = features.map(feat => {
            let coords = feat.geometry.coordinates;
            if (feat.geometry.type === 'MultiPolygon') coords = coords[0][0][0];
            else if (feat.geometry.type === 'Polygon') coords = coords[0][0];
            else if (feat.geometry.type === 'Point') coords = coords;

            return {
                number: number++,
                longitude: coords[0],
                latitude: coords[1]
            };
        });

        console.log(`Inserting ${rows.length} rows...`);
        const CHUNK = 1000;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { error } = await supabase.from('buildings').upsert(chunk, { onConflict: 'number' });
            if (error) {
                console.error('Error inserting chunk:', error);
                throw error;
            }
            inserted += chunk.length;
            if (inserted % 2000 === 0) console.log(`Inserted ${inserted} buildings...`);
        }

        console.log('✅ Successfully appended all Berbera buildings from geojson!');
    } catch (err) {
        console.error('Script failed:', err);
    }
}

run();
