# Quick Deployment Script for PowerShell
# Combines all migrations into one file for SQL Editor

Write-Host "🚀 Ziyada ERP - Migration Combiner" -ForegroundColor Green
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Gray

$migrations = @(
    "001_foundation_companies.sql",
    "002_foundation_coa.sql",
    "003_foundation_periods.sql",
    "004_foundation_audit.sql",
    "005_seed_coa_template.sql",
    "006_master_data_products.sql",
    "007_master_data_materials.sql",
    "008_master_data_vendors_customers.sql",
    "009_inventory_raw_material.sql",
    "010_inventory_wip.sql",
    "011_inventory_finished_goods.sql",
    "012_inventory_adjustments.sql",
    "013_purchase_orders.sql",
    "014_goods_receipt_notes.sql",
    "015_vendor_invoices.sql",
    "016_vendor_payments.sql",
    "017_manufacturing_bom.sql",
    "018_manufacturing_production_orders.sql",
    "019_manufacturing_work_orders.sql",
    "020_sales_pos.sql"
)

$outputFile = "supabase\ALL_MIGRATIONS_COMBINED.sql"
$migrationsDir = "supabase\migrations"

# Clear output file
"" | Out-File -FilePath $outputFile -Encoding UTF8

# Header
@"
-- ══════════════════════════════════════════════════════════════════
-- ZIYADA ERP - ALL MIGRATIONS COMBINED
-- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- Total Migrations: $($migrations.Count)
-- ══════════════════════════════════════════════════════════════════
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run" to execute all migrations
--
-- ══════════════════════════════════════════════════════════════════

"@ | Out-File -FilePath $outputFile -Append -Encoding UTF8

$count = 0
foreach ($migration in $migrations) {
    $count++
    $filePath = Join-Path $migrationsDir $migration
    
    if (Test-Path $filePath) {
        Write-Host "[$count/$($migrations.Count)] Adding: $migration" -ForegroundColor Cyan
        
        # Add separator
        @"


-- ══════════════════════════════════════════════════════════════════
-- MIGRATION $count of $($migrations.Count): $migration
-- ══════════════════════════════════════════════════════════════════

"@ | Out-File -FilePath $outputFile -Append -Encoding UTF8
        
        # Add file content
        Get-Content $filePath -Raw | Out-File -FilePath $outputFile -Append -Encoding UTF8
        
    } else {
        Write-Host "❌ NOT FOUND: $migration" -ForegroundColor Red
    }
}

# Footer
@"


-- ══════════════════════════════════════════════════════════════════
-- END OF MIGRATIONS
-- ══════════════════════════════════════════════════════════════════
-- 
-- Deployment complete! $count migrations combined.
-- File: $outputFile
--
-- ══════════════════════════════════════════════════════════════════
"@ | Out-File -FilePath $outputFile -Append -Encoding UTF8

Write-Host "`n✅ Combined $count migrations" -ForegroundColor Green
Write-Host "📄 Output file: $outputFile" -ForegroundColor Yellow
Write-Host "`n📋 Next steps:" -ForegroundColor White
Write-Host "  1. Open: https://supabase.com/dashboard/project/kivwoupcuguiuwkxwphc/sql/new" -ForegroundColor Gray
Write-Host "  2. Copy content from: $outputFile" -ForegroundColor Gray
Write-Host "  3. Paste and click 'Run'" -ForegroundColor Gray
Write-Host "`n🎉 Ready to deploy!" -ForegroundColor Green
