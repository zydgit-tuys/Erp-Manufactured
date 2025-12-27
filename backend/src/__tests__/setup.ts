/**
 * Load environment variables for tests
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
const envPath = resolve(__dirname, '../../.env.test');
config({ path: envPath });

// Set test timeout
jest.setTimeout(30000);

// Log test environment
console.log('Test environment loaded:', {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL ? '✓ Set' : '✗ Not set',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Not set',
});
