# RE:VALUE MATRIX

노후 건축물의 건축재생 가능성, 예상 사업비, 수익성 변화, 재생 전략, 실행 로드맵을 확인하는 웹 기반 분석 도구입니다.

이 버전은 로컬 컴퓨터와 ngrok을 계속 켜두지 않는 구조입니다.

```text
GitHub Pages 화면
  → Cloudflare Worker API
  → VWorld / 건축물대장 API
```

API 키는 GitHub 저장소 파일에 직접 들어가지 않습니다. GitHub `Secrets`에 저장한 뒤, GitHub Actions가 Cloudflare Worker에 배포할 때만 주입합니다.

자세한 설정 순서는 `SETUP_ALWAYS_ON.md`를 보세요.
