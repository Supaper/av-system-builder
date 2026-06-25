# ============================================================
#  git-start.ps1  —  작업 시작 전 실행
#  사용법: .\git-start.ps1
# ============================================================

$env:PATH += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AV Builder — 작업 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. main 최신화
Write-Host "[1/3] main 브랜치 최신 내용 받아오는 중..." -ForegroundColor Yellow
git checkout main 2>&1 | Out-Null
git pull origin main
Write-Host ""

# 2. 새 작업 브랜치 생성 (날짜+시간 기반)
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$branch = "local/$timestamp"

Write-Host "[2/3] 작업 브랜치 생성 중..." -ForegroundColor Yellow
git checkout -b $branch
Write-Host ""

# 3. 완료 안내
Write-Host "[3/3] 준비 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "  현재 브랜치 : " -NoNewline
Write-Host $branch -ForegroundColor Cyan
Write-Host "  작업이 끝나면: " -NoNewline
Write-Host ".\git-done.ps1 실행" -ForegroundColor Cyan
Write-Host ""
