const https = require('https');
const data = '[out:json];\n(\n  way["building"](10.30,44.90,10.55,45.10);\n  relation["building"](10.30,44.90,10.55,45.10);\n);\nout center;';

const options = {
    hostname: 'overpass-api.de',
    path: '/api/interpreter',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            console.log('OSM Buildings found:', parsed.elements ? parsed.elements.length : 0);
        } catch (e) {
            console.error('Error parsing response');
        }
    });
});
req.write(data);
req.end();
