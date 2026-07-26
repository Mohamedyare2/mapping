const { execSync } = require('child_process');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const lines = envFile.split('\n').filter(l => l.trim() && !l.startsWith('#'));

for (const line of lines) {
    const [key, ...rest] = line.split('=');
    let value = rest.join('=').replace(/\r$/, '');

    // Override for production
    if (key === 'CORS_ORIGIN') {
        value = 'https://caasha.vercel.app,http://localhost:3000,http://localhost:3002';
    }
    if (key === 'NODE_ENV') {
        value = 'production';
    }
    if (key === 'PORT') continue; // Vercel sets its own PORT

    if (key && value) {
        console.log(`Setting ${key}...`);
        try {
            execSync(`npx vercel env rm ${key} production --yes`, { stdio: 'ignore' });
        } catch (e) { }
        try {
            execSync(`npx vercel env add ${key} production`, { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
            console.log(`Set ${key} successfully.`);
        } catch (e) {
            console.error(`Failed to set ${key}`);
        }
    }
}
console.log('All environment variables pushed.');
