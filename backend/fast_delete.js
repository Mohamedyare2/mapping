const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:Naqiyoroob4@db.doqgakklrbcuzqnpbjrx.supabase.co:5432/postgres'
});

async function run() {
    try {
        await client.connect();

        console.log("Connected to Supabase Postgres.");

        // First, check how many buildings there are
        const res = await client.query('SELECT COUNT(*) FROM buildings WHERE longitude < 43.0;');
        console.log(`Buildings to delete (longitude < 43.0): ${res.rows[0].count}`);

        if (res.rows[0].count > 0) {
            console.log("Executing bulk delete...");
            const deleteRes = await client.query('DELETE FROM buildings WHERE longitude < 43.0;');
            console.log(`Successfully deleted ${deleteRes.rowCount} buildings.`);
        }

        // Also check if any are extremely far East (e.g. past 49.0)
        const eastRes = await client.query('DELETE FROM buildings WHERE longitude > 49.0;');
        if (eastRes.rowCount > 0) console.log(`Deleted ${eastRes.rowCount} buildings too far east.`);

        // Also check south (south of Somaliland is around 8.0, but to be safe, < 7.9)
        const southRes = await client.query('DELETE FROM buildings WHERE latitude < 7.9;');
        if (southRes.rowCount > 0) console.log(`Deleted ${southRes.rowCount} buildings too far south.`);

        // Check north (north of 11.5)
        const northRes = await client.query('DELETE FROM buildings WHERE latitude > 11.5;');
        if (northRes.rowCount > 0) console.log(`Deleted ${northRes.rowCount} buildings too far north.`);

    } catch (err) {
        console.error("Database operation failed:", err);
    } finally {
        await client.end();
    }
}

run();
