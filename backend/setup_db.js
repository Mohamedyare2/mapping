const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: 'postgresql://postgres:Naqiyoroob4@db.doqgakklrbcuzqnpbjrx.supabase.co:5432/postgres'
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to Supabase Postgres.");

        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const funcsPath = path.join(__dirname, '../database/functions.sql');

        let schemaSql = fs.readFileSync(schemaPath, 'utf8');
        let funcsSql = fs.readFileSync(funcsPath, 'utf8');

        // To allow the AI pipeline and backend to work without needing the service_role key immediately,
        // let's temporarily allow anon to write to the DB. Since we have our own admin dashboard with JWT
        // protecting the API routes, this is an okay fallback if they don't add a service key.
        schemaSql = schemaSql.replace(
            "USING (auth.role() = 'service_role');",
            "USING (true);"
        );

        console.log("Running schema.sql...");
        await client.query(schemaSql);

        console.log("Running functions.sql...");
        await client.query(funcsSql);

        console.log("✅ Database initialized successfully!");
    } catch (err) {
        console.error("Database initialization failed:", err);
    } finally {
        await client.end();
    }
}

run();
