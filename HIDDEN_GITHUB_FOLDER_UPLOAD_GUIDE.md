# 숨김 폴더가 안 올라갈 때

`.github/workflows/deploy-worker.yml`이 GitHub에 올라가야 `Actions` 탭에 Worker 배포 버튼이 생깁니다.

맥에서 `.github` 폴더가 안 보이거나 업로드가 안 되면 아래 방식 중 하나로 처리합니다.

## 가장 쉬운 방법: GitHub 웹에서 직접 만들기

1. GitHub 저장소로 들어갑니다.
2. `Add file`을 누릅니다.
3. `Create new file`을 누릅니다.
4. 파일 이름 칸에 아래 경로를 그대로 입력합니다.

```text
.github/workflows/deploy-worker.yml
```

5. 로컬 폴더의 `UPLOAD_THIS_WORKFLOW_TO_GITHUB_ACTIONS.yml` 내용을 전부 복사해서 붙여넣습니다.
6. `Commit changes`를 누릅니다.
7. GitHub 상단의 `Actions` 탭에 `Deploy REVALUE API Worker`가 생겼는지 확인합니다.

## 맥 Finder에서 숨김 파일 보이게 하기

Finder에서 아래 키를 누르면 숨김 파일/폴더가 보입니다.

```text
Command + Shift + .
```

그 다음 `.github` 폴더까지 같이 업로드합니다.

## 제대로 됐는지 확인

GitHub 저장소 파일 목록에 아래 파일이 보여야 합니다.

```text
.github/workflows/deploy-worker.yml
```

이 파일이 없으면 Worker 배포가 실행되지 않습니다.
