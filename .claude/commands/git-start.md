main 브랜치를 최신화하고 새 작업 브랜치를 만들어라.

1. `$env:PATH += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"` 로 git 경로 추가
2. 현재 브랜치 확인
3. 커밋되지 않은 변경사항이 있으면 사용자에게 알리고 중단
4. main 브랜치로 이동 (`git checkout main`)
5. 원격 최신화 (`git pull origin main`)
6. 현재 날짜시간으로 새 브랜치 생성 및 이동 (`git checkout -b local/YYYYMMDD-HHmm` 형식)
7. 완료 후 생성된 브랜치 이름을 사용자에게 알림
