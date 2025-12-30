const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test');
    process.exit(1);
}

// Seed file
const filename = 'seed-test-data.sql';

async function executeSQL(sql) {
    return new Promise((resolve, reject) => {
        // Using RPC 'exec' (assuming it exists from previous setup or enabled)
        // If 'exec' rpc doesn't exist, we might fail. 
        // Migration 000 or similar usually enables it or we use pg driver.
        // deploy-migrations.cjs uses 'exec'.
        const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec`);
        const postData = JSON.stringify({ query: sql });
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => reject(error));
        req.write(postData);
        req.end();
    });
}

async function run() {
    const filePath = path.join(__dirname, filename); // in backend root
    console.log(`\n📄 Reading: ${filename}`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`⚙️  Executing: ${filename}`);

    try {
        await executeSQL(sql);
        console.log(`✅ Successfully deployed ${filename}`);
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        process.exit(1);
    }
}

run();
