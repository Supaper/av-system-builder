작업 완료 후 커밋하고 GitHub에 푸시하라.

1. `$env:PATH += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"` 로 git 경로 추가
2. main 브랜치이면 중단하고 사용자에게 알림
3. 변경된 파일 목록 출력
4. 변경사항이 없으면 사용자에게 알리고 중단
5. 사용자에게 커밋 메시지를 물어봄 (입력 없으면 중단)
6. 전체 스테이징 (`git add .`) 후 커밋
7. GitHub에 푸시 (`git push -u origin 현재브랜치`)
8. PR 생성 링크 출력: `https://github.com/Supaper/av-system-builder/compare/브랜치명?expand=1`
