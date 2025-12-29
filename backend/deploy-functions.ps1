# Deploy all Edge Functions to Supabase
# Project: kivwoupcuguiuwkxwphc

$PROJECT_REF = "kivwoupcuguiuwkxwphc"

$functions = @(
    "receive-raw-material",
    "issue-raw-material",
    "receive-finished-goods",
    "issue-finished-goods",
    "post-adjustment",
    "post-transfer",
    "post-goods-receipt",
    "post-delivery-order"
)

Write-Host "🚀 Deploying Edge Functions to Supabase..." -ForegroundColor Cyan
Write-Host "Project: $PROJECT_REF" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($func in $functions) {
    Write-Host "📦 Deploying: $func..." -ForegroundColor White
    
    $result = supabase functions deploy $func --project-ref $PROJECT_REF --no-verify-jwt 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Success: $func" -ForegroundColor Green
        $successCount++
    }
    else {
        Write-Host "   ❌ Failed: $func" -ForegroundColor Red
        Write-Host "   Error: $result" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 Deployment Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Successful: $successCount" -ForegroundColor Green
Write-Host "   ❌ Failed: $failCount" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "🎉 All Edge Functions deployed successfully!" -ForegroundColor Green
    Write-Host "🔗 Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF/functions" -ForegroundColor Cyan
}
else {
    Write-Host ""
    Write-Host "⚠️  Some deployments failed. Please check the errors above." -ForegroundColor Yellow
}
