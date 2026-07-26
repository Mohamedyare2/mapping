const { execSync } = require('child_process');

try {
    execSync('npx vercel env rm NEXT_PUBLIC_API_URL production --yes', { stdio: 'ignore' });
} catch (e) { }

try {
    execSync('npx vercel env add NEXT_PUBLIC_API_URL production', {
        input: 'https://backend-gilt-five-29.vercel.app/api',
        stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log('Successfully set NEXT_PUBLIC_API_URL');
} catch (e) {
    console.error('Failed to set NEXT_PUBLIC_API_URL', e);
}
