# Seed Test Data Script
# Populates database with test data for Phase 4 testing

$PROJECT_REF = "kivwoupcuguiuwkxwphc"

Write-Host "🌱 Seeding Test Data..." -ForegroundColor Cyan
Write-Host "Project: $PROJECT_REF" -ForegroundColor Yellow
Write-Host ""

# Run the seed SQL file
Write-Host "📦 Running seed script..." -ForegroundColor White

$result = supabase db execute --file seed-test-data.sql --project-ref $PROJECT_REF 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Test data seeded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Data Created:" -ForegroundColor Cyan
    Write-Host "   - Material Categories" -ForegroundColor White
    Write-Host "   - Materials (5 items)" -ForegroundColor White
    Write-Host "   - Product Categories" -ForegroundColor White
    Write-Host "   - Products (3 items)" -ForegroundColor White
    Write-Host "   - Vendors (2 items)" -ForegroundColor White
    Write-Host "   - Customers (2 items)" -ForegroundColor White
    Write-Host "   - Warehouses (2 items)" -ForegroundColor White
    Write-Host "   - Warehouse Bins (4 items)" -ForegroundColor White
    Write-Host "   - Sizes (4 items)" -ForegroundColor White
    Write-Host "   - Colors (4 items)" -ForegroundColor White
    Write-Host "   - Accounting Periods (2 items)" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Ready for testing!" -ForegroundColor Green
}
else {
    Write-Host "❌ Failed to seed data" -ForegroundColor Red
    Write-Host "Error: $result" -ForegroundColor Red
}
