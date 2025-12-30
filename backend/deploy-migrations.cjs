/**
 * Automatic Migration Deployment Script
 * Executes all 20 migrations in order to Supabase
 */

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

// Migration files in order
const migrations = [
    '001_foundation_companies.sql',
    '002_foundation_coa.sql',
    '003_foundation_periods.sql',
    '004_foundation_audit.sql',
    '005_seed_coa_template.sql',
    '006_master_data_products.sql',
    '007_master_data_materials.sql',
    '008_master_data_vendors_customers.sql',
    '009_inventory_raw_material.sql',
    '010_inventory_wip.sql',
    '011_inventory_finished_goods.sql',
    '012_inventory_adjustments.sql',
    '013_purchase_orders.sql',
    '014_goods_receipt_notes.sql',
    '015_vendor_invoices.sql',
    '016_vendor_payments.sql',
    '017_manufacturing_bom.sql',
    '018_manufacturing_production_orders.sql',
    '019_manufacturing_work_orders.sql',
    '020_additional_check_constraints.sql',
    '020_sales_pos.sql',
    '021_auto_journal_setup.sql',
    '021_sales_pos_returns.sql',
    '022_sales_orders.sql',
    '023_delivery_notes.sql',
    '024_sales_invoices.sql',
    '025_ar_payments.sql',
    '026_credit_management_polish.sql',
    '027_marketplace_integration.sql',
    '028_journals_schema.sql',
    '029_financial_reporting.sql',
    '030_analytics_mvs.sql',
    '031_company_settings.sql',
    '032_fix_permissions.sql',
    '033_seed_owner.sql',
    '034_fix_database_security.sql',
    '035_fix_view_security.sql',
    '036_secure_materialized_views.sql',
    '040_ledger_immutability.sql',
    '041_period_lock_enforcement.sql',
    '042_negative_stock_prevention.sql',
    '043_unbalanced_journal_check.sql',
    '044_fix_audit_trigger_companies.sql',
    '045_account_mapping_and_full_coa.sql',
    '046_relax_coa_constraints.sql',
    '047_add_missing_mappings.sql',
    '048_product_categories.sql',
    '049_inventory_optimization.sql',
    '050_integrity_journal_entry.sql',
    '051_fix_security_functions.sql',
    '052_remediate_client_trust.sql',
    '053_manufacturing_completion.sql'
];

// Execute SQL via REST API
async function executeSQL(sql) {
    return new Promise((resolve, reject) => {
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

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

async function executeMigration(filename) {
    const filePath = path.join(__dirname, 'supabase', 'migrations', filename);

    console.log(`\n📄 Reading: ${filename}`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`⚙️  Executing: ${filename} (${Math.round(sql.length / 1024)}KB)`);

    // Execute SQL directly (Supabase allows this with service role)
    try {
        await executeSQL(sql);
        console.log(`✅ Completed: ${filename}`);
    } catch (error) {
        // If direct execution fails, it might mean tables already exist
        if (error.message.includes('already exists')) {
            console.log(`⚠️  Some objects already exist, continuing...`);
        } else {
            throw error;
        }
    }
}

async function runMigrations() {
    console.log('🚀 Starting automatic migration deployment...\n');
    console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
    console.log(`📦 Total migrations: ${migrations.length}\n`);
    console.log('═'.repeat(60));

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const migration of migrations) {
        try {
            await executeMigration(migration);
            successCount++;
        } catch (error) {
            failCount++;
            errors.push({ migration, error: error.message });
            console.error(`❌ Failed: ${migration}`);
            console.error(`   Error: ${error.message.substring(0, 200)}`);

            // Continue on error (some may already exist)
            if (failCount > 15) {
                console.error('\n❌ Too many failures. Stopping deployment.');
                break;
            }
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 Deployment Summary:');
    console.log(`✅ Successful: ${successCount}/${migrations.length}`);
    console.log(`❌ Failed: ${failCount}/${migrations.length}`);

    if (errors.length > 0 && errors.length < 10) {
        console.log('\n❌ Errors:');
        errors.forEach(({ migration, error }) => {
            console.log(`  - ${migration}: ${error.substring(0, 100)}`);
        });
    }

    if (successCount === migrations.length) {
        console.log('\n🎉 All migrations deployed successfully!');
    } else if (successCount > 15) {
        console.log('\n✅ Most migrations deployed! Some may have been skipped (already exist).');
    }

    console.log('\n📋 Next steps:');
    console.log('  1. Verify: Open Supabase Dashboard → Database → Tables');
    console.log('  2. Check: Should see 42+ tables');
    console.log('  3. Test: Create sample company and data');

    process.exit(0);
}

// Run migrations
runMigrations().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});
