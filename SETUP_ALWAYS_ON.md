# 처음부터 설정하는 방법

이 방식은 네 컴퓨터를 계속 켜두지 않아도 됩니다.

다만 GitHub Pages만으로는 비밀 API 키를 숨긴 채 실시간 API 호출을 할 수 없습니다. GitHub Secrets는 GitHub Actions에서만 읽을 수 있기 때문에, 실제 API 호출은 Cloudflare Worker라는 작은 서버리스 백엔드가 담당합니다.

## 1. GitHub에 올릴 파일

이 폴더 안의 파일과 폴더를 저장소 맨 위에 올립니다.

```text
index.html
styles.css
app.js
config.js
README.md
SETUP_ALWAYS_ON.md
.gitignore
.github/
worker/
```

절대 올리면 안 되는 파일:

```text
.env
.dev.vars
.worker-secrets.json
node_modules
```

## 2. GitHub Pages 켜기

1. GitHub 저장소 `Settings`
2. `Pages`
3. `Source`를 `Deploy from a branch`
4. Branch는 `main`
5. Folder는 `/ root`
6. `Save`

그러면 화면 주소가 생깁니다.

```text
https://깃허브아이디.github.io/저장소이름/
```

## 3. Cloudflare 계정 준비

1. Cloudflare 계정을 만듭니다.
2. Workers & Pages 메뉴로 들어갑니다.
3. API Token을 만듭니다.
4. Account ID를 확인합니다.

GitHub Actions에서 Worker를 배포하려면 아래 두 값이 필요합니다.

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## 4. GitHub Secrets 입력

GitHub 저장소에서:

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`

아래 이름으로 추가합니다.

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SITE_ACCESS_TOKEN
VWORLD_API_KEY
MOLIT_BUILDING_API_KEY
DATA_GO_KR_API_KEY
```

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

`SITE_ACCESS_TOKEN`은 사용자가 사이트에 들어갈 때 입력하는 접속 코드입니다. VWorld 키가 아닙니다.

## 5. Worker 배포

GitHub 저장소에서:

1. `Actions`
2. `Deploy REVALUE API Worker`
3. `Run workflow`

성공하면 Cloudflare Worker 주소가 생깁니다.

대략 이런 형태입니다.

```text
https://revalue-matrix-api.너의서브도메인.workers.dev
```

## 6. config.js 연결

`config.js`를 열고 Worker 주소를 넣습니다.

```js
window.REVALUE_API_BASE = "https://revalue-matrix-api.너의서브도메인.workers.dev";
window.REVALUE_SITE_TOKEN = "";
```

`REVALUE_SITE_TOKEN`은 비워두세요. 그러면 사용자가 사이트에서 접속 코드만 입력하면 됩니다.

수정 후 GitHub에 다시 `Commit changes`하면 GitHub Pages 화면이 Worker를 호출합니다.

## 7. CORS 설정

처음에는 Worker가 요청을 받아줄 수 있도록 `ALLOWED_ORIGINS`를 비워둔 상태로 시작합니다.

더 안전하게 하려면 `worker/wrangler.toml`의 아래 값을 GitHub Pages 주소의 **도메인까지만** 바꿉니다.

```toml
ALLOWED_ORIGINS = "https://깃허브아이디.github.io"
```

아래처럼 저장소 경로까지 넣으면 브라우저의 CORS origin과 달라져서 `Failed to fetch`가 날 수 있습니다.

```toml
# 잘못된 예
ALLOWED_ORIGINS = "https://깃허브아이디.github.io/revalue-matrix/"
```

GitHub Pages 주소가 `https://깃허브아이디.github.io/revalue-matrix/`라면 CORS에는 이렇게 넣습니다.

```toml
ALLOWED_ORIGINS = "https://깃허브아이디.github.io"
```

## 8. 보안 주의

- GitHub 저장소 파일에 API 키를 직접 쓰면 안 됩니다.
- GitHub Secrets는 GitHub Actions에서만 읽을 수 있습니다.
- GitHub Secrets 값을 `config.js`에 넣어 배포하면 브라우저에서 노출됩니다.
- 이 프로젝트는 과제/소규모 시연용 구조입니다.
- 실제 서비스로 공개하려면 사용자별 로그인, 사용량 제한, 키 회전이 필요합니다.

## 9. `검색 실패: Failed to fetch` 체크

이 오류는 보통 JavaScript 코드가 아니라 브라우저가 요청을 보내기 전에 막았다는 뜻입니다.

가장 많이 틀리는 지점은 아래입니다.

1. `config.js`의 `REVALUE_API_BASE`가 GitHub Pages 주소로 되어 있음

```js
// 잘못된 예
window.REVALUE_API_BASE = "https://깃허브아이디.github.io/revalue-matrix";
```

```js
// 올바른 예
window.REVALUE_API_BASE = "https://revalue-matrix-api.너의서브도메인.workers.dev";
```

2. `REVALUE_API_BASE` 끝에 `/api/search`까지 넣음

```js
// 잘못된 예
window.REVALUE_API_BASE = "https://revalue-matrix-api.너의서브도메인.workers.dev/api/search";
```

```js
// 올바른 예
window.REVALUE_API_BASE = "https://revalue-matrix-api.너의서브도메인.workers.dev";
```

3. Worker가 배포되지 않았거나 Actions가 실패함

GitHub `Actions`에서 `Deploy REVALUE API Worker`가 초록색 성공 상태인지 확인합니다.

4. CORS 도메인을 경로까지 넣음

```toml
// 잘못된 예
ALLOWED_ORIGINS = "https://깃허브아이디.github.io/revalue-matrix/"
```

```toml
// 올바른 예
ALLOWED_ORIGINS = "https://깃허브아이디.github.io"
```

5. GitHub Pages가 이전 `config.js`를 캐시 중

브라우저에서 강력 새로고침을 합니다.

```text
Mac: command + shift + R
Windows: ctrl + F5
```

6. Secrets에 API 주소를 넣음

GitHub Secrets에는 API 주소가 아니라 실제 키값을 넣습니다.

```text
VWORLD_API_KEY = VWorld에서 발급받은 키값
MOLIT_BUILDING_API_KEY = 공공데이터포털에서 발급받은 키값
SITE_ACCESS_TOKEN = 내가 만든 접속 코드
```

Worker 주소는 `config.js`에만 넣습니다.
