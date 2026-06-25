# ============================================================
#  git-done.ps1  —  작업 완료 후 실행
#  사용법: .\git-done.ps1
#          .\git-done.ps1 "feat: 커밋 메시지 직접 입력"
# ============================================================

param([string]$Message = "")

$env:PATH += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AV Builder — 작업 완료" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 현재 브랜치 확인
$branch = git branch --show-current
Write-Host "  현재 브랜치: " -NoNewline
Write-Host $branch -ForegroundColor Cyan
Write-Host ""

# main 브랜치 직접 push 방지
if ($branch -eq "main") {
    Write-Host "[오류] main 브랜치에서는 직접 push할 수 없습니다." -ForegroundColor Red
    Write-Host "       먼저 git-start.ps1 을 실행해 작업 브랜치를 만드세요." -ForegroundColor Red
    exit 1
}

# 변경사항 확인
$status = git status --porcelain
if (-not $status) {
    Write-Host "변경사항이 없습니다. 커밋할 내용이 없어요." -ForegroundColor Yellow
    exit 0
}

Write-Host "변경된 파일:" -ForegroundColor Yellow
git status --short
Write-Host ""

# 커밋 전 체크리스트
Write-Host "--------------------------------------------" -ForegroundColor DarkCyan
Write-Host "  커밋 전 체크리스트" -ForegroundColor DarkCyan
Write-Host "--------------------------------------------" -ForegroundColor DarkCyan
Write-Host "  [ ] CLAUDE.md '완료된 기능'에 추가했나요?" -ForegroundColor White
Write-Host "  [ ] CLAUDE.md 'Backlog'에서 완성 항목 제거했나요?" -ForegroundColor White
Write-Host "  [ ] CHANGELOG.md 업데이트했나요?" -ForegroundColor White
Write-Host ""
$ready = Read-Host "위 항목을 확인했으면 y, 아직이면 n"
if ($ready -ne 'y') {
    Write-Host ""
    Write-Host "  → 먼저 CLAUDE.md와 CHANGELOG.md를 업데이트하세요." -ForegroundColor Yellow
    Write-Host "     (Claude Code에서 작업했다면 Claude가 이미 했을 수도 있어요)" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}
Write-Host ""

# 커밋 메시지 입력
if (-not $Message) {
    $Message = Read-Host "커밋 메시지를 입력하세요 (예: feat: 오토레이아웃 개선)"
    if (-not $Message) {
        Write-Host "[오류] 커밋 메시지를 입력해야 합니다." -ForegroundColor Red
        exit 1
    }
}

# 커밋
Write-Host ""
Write-Host "[1/3] 커밋 중..." -ForegroundColor Yellow
git add .
git commit -m $Message
Write-Host ""

# Push
Write-Host "[2/3] GitHub에 push 중..." -ForegroundColor Yellow
git push -u origin $branch
Write-Host ""

# PR 페이지 열기
Write-Host "[3/3] PR 페이지 열기..." -ForegroundColor Yellow
$encodedBranch = [uri]::EscapeDataString($branch)
$prUrl = "https://github.com/Supaper/av-system-builder/compare/$encodedBranch`?expand=1"
Start-Process $prUrl

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  브라우저에서 PR을 생성하고 Merge하세요." -ForegroundColor White
Write-Host "  다음 작업 시작 시 git-start.ps1 을 실행하세요." -ForegroundColor White
Write-Host ""
