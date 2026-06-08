# RE:VALUE MATRIX 처음부터 배포하기

이 폴더는 새 GitHub repository에 그대로 올리는 최종 정리본입니다.

구조는 단순합니다.

- GitHub Pages: 사용자가 보는 화면
- Cloudflare Worker: VWorld/건축물대장 API를 대신 호출하는 서버
- GitHub Secrets: API 키를 숨겨서 Worker 배포에 사용
- `config.js`: 화면이 어느 Worker 서버를 호출할지 알려주는 파일

중요: `config.js`의 `REVALUE_API_BASE`에는 `github.io` 주소가 아니라 Cloudflare Worker 주소가 들어가야 합니다.

## 1. 새 GitHub repository 만들기

기존 repository가 꼬였으면 새로 만드는 편이 가장 깔끔합니다.

1. GitHub에서 새 repository를 만듭니다.
2. 이 폴더 안의 파일과 폴더를 repository 루트에 업로드합니다.
3. 업로드 후 repository 첫 화면에 아래 파일들이 보여야 합니다.

```text
index.html
styles.css
app.js
config.js
START_HERE.md
.github/
worker/
```

zip 파일 자체를 올리면 안 됩니다. zip을 푼 뒤 내용물을 올려야 합니다.

## 2. GitHub Secrets 넣기

GitHub repository에서 `Settings` → `Secrets and variables` → `Actions` → `New repository secret`으로 들어가 아래 이름 그대로 추가합니다.

필수:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SITE_ACCESS_TOKEN
VWORLD_API_KEY
```

선택:

```text
MOLIT_BUILDING_API_KEY
DATA_GO_KR_API_KEY
```

`SITE_ACCESS_TOKEN`은 직접 만든 긴 접속 코드입니다. 예를 들면 영어 대소문자, 숫자, 특수문자를 섞어 30자 이상으로 만드세요.

API 키를 `app.js`, `config.js`, `index.html`에 직접 넣지 마세요.

## 3. Cloudflare Worker 배포하기

1. GitHub repository의 `Actions` 탭으로 갑니다.
2. `Deploy REVALUE API Worker`를 누릅니다.
3. `Run workflow`를 누릅니다.
4. 성공하면 Cloudflare Workers & Pages에서 Worker 주소를 확인합니다.

주소 예시:

```text
https://revalue-matrix-api.your-subdomain.workers.dev
```

## 4. config.js에 Worker 주소 넣기

GitHub에서 `config.js`를 열고 아래 부분만 수정합니다.

```js
window.REVALUE_API_BASE = "https://revalue-matrix-api.your-subdomain.workers.dev";
window.REVALUE_SITE_TOKEN = "";
```

공개 repository라면 `REVALUE_SITE_TOKEN`은 비워두는 것을 권장합니다. 대신 친구에게 접속 코드를 따로 알려주면 됩니다.

수정 후 commit합니다.

## 5. GitHub Pages 켜기

1. GitHub repository의 `Settings` → `Pages`로 갑니다.
2. `Build and deployment`에서 `Deploy from a branch`를 선택합니다.
3. Branch는 `main`, folder는 `/root`로 설정합니다.
4. 저장 후 몇 분 기다립니다.

사이트 주소 예시:

```text
https://yourname.github.io/repository-name/
```

## 6. 정상 작동 확인

사이트가 열리면 브라우저에서 새로고침을 강하게 합니다.

Mac:

```text
Command + Shift + R
```

Windows:

```text
Ctrl + Shift + R
```

그 다음 건물명이나 주소를 검색합니다.

## 7. 문제가 생겼을 때 확인 순서

`검색 실패: Failed to execute 'text' on 'Response': body stream already read`

- 예전 `app.js`가 배포된 상태입니다.
- 이 최종 폴더의 `app.js`로 다시 업로드하고 Pages 배포가 끝난 뒤 강력 새로고침하세요.

`검색 실패: Page not found · GitHub Pages`

- `config.js`의 `REVALUE_API_BASE`가 비어 있거나 `github.io` 주소로 되어 있는 상태입니다.
- 반드시 Cloudflare Worker의 `workers.dev` 주소나 연결한 API 도메인을 넣어야 합니다.

`접속 코드가 필요합니다`

- 정상입니다.
- `SITE_ACCESS_TOKEN`에 넣은 접속 코드를 입력하면 됩니다.

`접속 코드가 맞지 않습니다`

- GitHub Secrets의 `SITE_ACCESS_TOKEN`과 사용자가 입력한 코드가 다릅니다.
- 공백까지 복사되지 않았는지 확인하세요.

`VWorld 검색 결과가 없습니다`

- API 서버 연결은 된 상태입니다.
- 주소 표현을 더 구체적으로 바꾸거나 도로명/지번을 번갈아 입력하세요.

## 8. 절대 하지 말아야 할 것

- API 키를 공개 GitHub 파일에 직접 적기
- `REVALUE_API_BASE`에 GitHub Pages 주소 넣기
- zip 파일 자체를 repository에 올리기
- 오래된 repository 파일과 새 파일을 섞어서 올리기

처음부터 다시 할 때는 이 폴더 내용물만 새 repository에 올리는 것이 가장 안전합니다.
