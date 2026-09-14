# 둥둥 — 우리들의 아쿠아리움

**배포 주소:** https://jsjang0104.github.io/aquarium.github.io/

친구들의 얼굴을 입힌 물고기가 헤엄치는 인터랙티브 3D 아쿠아리움입니다. HTML, CSS, JavaScript와 Three.js로 만들었으며, 빌드 과정이나 백엔드 없이 정적 호스팅으로 실행합니다.

## 실행

이 폴더에서 아래 명령을 실행한 뒤 <http://localhost:8000>을 여세요.

```bash
python3 -m http.server 8000
```

ES module과 사진 로딩을 사용하므로 `index.html`을 더블 클릭하는 `file://` 실행 대신 HTTP 서버를 사용하세요. WebGL 2를 지원하는 최신 브라우저가 필요합니다.

## 즐기는 방법

- **기본 주민 3명:** 폴더에 있는 JPEG 사진 3장을 각 물고기의 양쪽 면에 합성합니다.
- **친구 입수시키기:** JPG·PNG·WebP 사진을 추가합니다. 사진당 15MB, 주민 최대 12명입니다.
- **주민 카드 클릭:** 이름, 색상, 얼굴 크롭의 확대·좌우·상하 위치를 조정하거나 사진을 교체합니다. ‘떠나보내기’로 삭제할 수 있습니다.
- **먹이 주기 / F 키:** 가라앉는 먹이를 향해 물고기가 모여들고 가까이 다가가면 먹이를 먹습니다. 일시정지 상태에서는 유영을 재개합니다.
- **드래그 / 터치:** 시점을 회전합니다. 스크롤 또는 두 손가락으로 확대·축소합니다.
- **수조 제어:** 헤엄 속도, 일시정지, 밤 조명, 시점 초기화, 전체 화면을 지원합니다. 전체 화면 지원 여부는 브라우저에 따라 다릅니다.

해초와 지느러미는 계속 흔들리고 기포가 떠오릅니다. 산호, 바위, 불가사리, 모래 바닥의 물빛도 코드로 구성되어 있습니다. OS의 ‘움직임 줄이기’ 설정에서는 정지 상태로 시작하며, ‘다시 헤엄’을 누르면 움직입니다.

## 사진과 저장

추가한 사진은 브라우저 안에서 최대 1,000px로 축소해 처리하며 서버로 전송하지 않습니다. 주민 설정과 추가 사진은 해당 브라우저의 `localStorage`에 저장됩니다. 저장이 차단되거나 공간이 부족하면 안내 메시지를 표시하고 이번 방문 동안만 변경 사항을 유지합니다. 다른 기기나 브라우저에는 동기화되지 않습니다.

기본 JPEG 3장은 원본을 수정하지 않고 그대로 사용합니다. **이 파일들을 GitHub Pages에 배포하면 기본 사진은 방문자에게 공개됩니다.** 사이트에 접속한 모든 사람에게 보여줄 기본 사진·이름·색·크롭은 `js/portraits.js`의 `DEFAULT_FISH`에서 수정하세요. 이미 저장한 방문자의 설정이 우선합니다. 개발 중 기본값을 다시 확인하려면 브라우저 콘솔에서 다음을 실행할 수 있습니다.

```js
localStorage.removeItem('doongdoong.fish.v1');
location.reload();
```

## GitHub Pages

현재 `gh-pages` 브랜치의 루트(`/`)를 GitHub Pages로 게시합니다. 원본 코드는 `main`에 있습니다. 별도의 npm 설치나 빌드가 필요하지 않으며 `.nojekyll` 파일을 포함합니다.

수정 내용을 커밋한 뒤 두 브랜치를 함께 업로드하면 사이트에 반영됩니다. 현재 작업 환경에서는 GitHub 계정에 연결된 SSH 키를 사용합니다.

```bash
git push git@github.com:jsjang0104/aquarium.github.io.git main main:gh-pages
```

배포 진행 상황은 저장소의 Actions 탭에서 `pages build and deployment` 작업으로 확인할 수 있습니다. 상대 경로를 사용하므로 프로젝트 하위 경로에서도 사진과 3D 라이브러리가 정상 로드됩니다.

## 구성

```text
index.html          한국어 UI, 사진 편집 dialog, 로컬 import map
styles.css          반응형 화면과 접근성 스타일
js/app.js           UI 이벤트와 사진 편집 흐름
js/aquarium.js      3D 수조, 물고기 움직임, 해초, 먹이, 카메라
js/portraits.js     기본 사진 설정, 얼굴 크롭, 로컬 저장, 사진 검증
vendor/            Three.js 0.180.0과 OrbitControls, MIT 라이선스
tests/browser_test.py  실제 Chromium 브라우저 테스트
```

Three.js 파일을 저장소에 포함하여 런타임 CDN 요청 없이 실행합니다. 사용 방식은 [Three.js 공식 설치 문서](https://threejs.org/manual/en/installation.html)를 참고하세요. 라이선스는 `vendor/THREE-LICENSE.txt`에 있습니다.

## 검증

Python 환경에 Playwright를 설치하고 Chromium을 준비합니다.

```bash
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
# Linux에서 공유 라이브러리가 빠진 경우: .venv/bin/playwright install-deps chromium
python3 -m http.server 4173
```

다른 터미널에서 이 폴더를 기준으로 실행합니다.

```bash
.venv/bin/python -m unittest discover -s tests -p '*_test.py' -v
```

테스트는 기본 렌더링과 컨트롤, 사진 수정·추가·삭제·저장, 모바일과 움직임 감소 설정, 12마리 초기 배치 및 장시간 유영 경계, 먹이 섭취와 정리, 저장 실패·잘못된 사진, WebGL 미지원 안내를 확인합니다.

최종 검증: Chromium 브라우저 테스트 **9개 통과**. 사진 교체 중 이름·색상 유지, 로딩 중 취소, 편집창 재진입 시 검증 상태 초기화도 회귀 테스트에 포함합니다.
