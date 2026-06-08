# RE:VALUE MATRIX

건축재생 수업용 의사결정 웹사이트입니다. 건물명, 도로명주소, 지번주소를 입력하면 VWorld 검색 후보를 제시하고, 선택한 건물을 기준으로 재생 가능성, 지속가능성, 예상 사업비, 수익성 변화, 보수와 건축재생 접근의 차이를 한 화면에서 분석합니다.

처음 배포할 때는 [START_HERE.md](START_HERE.md)를 순서대로 따라가세요.

## 배포 구조

- 화면: GitHub Pages
- API 서버: Cloudflare Worker
- 비밀키 보관: GitHub Secrets와 Cloudflare Worker Secrets
- 화면 설정: `config.js`

`config.js`의 `REVALUE_API_BASE`에는 GitHub Pages 주소가 아니라 Cloudflare Worker 주소를 넣어야 합니다.
