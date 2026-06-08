# CORS / 404 빠른 해결 체크리스트

현재 GitHub Pages 주소:

```text
https://mindoryvault-coder.github.io
```

현재 Cloudflare Worker 주소:

```text
https://revalue-matrix.mindoryvault.workers.dev
```

## 1. config.js 확인

GitHub Pages에 올라가는 `config.js`에는 아래처럼 Worker 주소가 들어가야 합니다.

```js
window.REVALUE_API_BASE = "https://revalue-matrix.mindoryvault.workers.dev";
```

여기에 `github.io` 주소를 넣으면 검색 API가 작동하지 않습니다.

## 2. wrangler.toml 확인

Worker 쪽 `worker/wrangler.toml`은 아래처럼 맞춥니다.

```toml
name = "revalue-matrix"
main = "src/worker.js"
compatibility_date = "2026-06-08"

[vars]
ALLOWED_ORIGINS = "https://mindoryvault-coder.github.io"
MOLIT_SIGUNGU_CD = ""
MOLIT_BJDONG_CD = ""
```

`name`이 `revalue-matrix-api`이면 주소도 `https://revalue-matrix-api...workers.dev`로 달라집니다.

## 3. Cloudflare Worker가 진짜 배포됐는지 확인

브라우저에서 아래 주소를 엽니다.

```text
https://revalue-matrix.mindoryvault.workers.dev/api/health
```

정상이라면 JSON 형태의 메시지가 나와야 합니다.  
404가 나오면 현재 주소에는 RE:VALUE API Worker 코드가 배포되지 않은 것입니다.

## 4. GitHub Actions 다시 실행

GitHub 저장소에서:

```text
Actions > Deploy REVALUE API Worker > Run workflow
```

또는 파일을 다시 업로드한 뒤 자동 배포가 끝날 때까지 기다립니다.

## 5. 브라우저 캐시 새로고침

GitHub Pages에서 수정한 `config.js`가 늦게 반영될 수 있습니다.

```text
Cmd + Shift + R
```

또는 브라우저 시크릿 창에서 다시 접속합니다.

