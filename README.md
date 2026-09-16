# 이문동 독붕이들의 아쿠아리움

**배포 주소:** https://jsjang0104.github.io/aquarium.github.io/

친구들의 얼굴을 입힌 물고기 네 마리가 헤엄치는 인터랙티브 3D 아쿠아리움입니다. HTML, CSS, JavaScript와 Three.js를 사용하며 빌드 과정이나 백엔드 없이 정적 호스팅으로 실행합니다.

## 실행

이 폴더에서 아래 명령을 실행한 뒤 <http://localhost:8000>을 여세요.

```bash
python3 -m http.server 8000
```

ES module과 사진 로딩을 사용하므로 `file://` 대신 HTTP 서버로 실행하세요. WebGL 2를 지원하는 브라우저가 필요합니다.

## 수조 즐기기

- **주민 네 명:** 기본 JPEG 사진 4장이 물고기 몸통의 둥근 곡면에 직접 매핑됩니다. 양쪽 얼굴이 곡면을 따라 휘고 조명을 받으며, 사진 가장자리는 몸 색과 부드럽게 섞입니다.
- **먹이 주기 / F 키:** 가라앉는 먹이를 향해 물고기가 모여들어 먹습니다. 정지 상태에서는 헤엄을 재개합니다.
- **드래그 / 터치:** 시점을 회전합니다. 스크롤 또는 두 손가락으로 확대·축소합니다.
- **수조 제어:** 헤엄 속도, 일시정지, 밤 조명, 시점 초기화, 전체 화면을 지원합니다. 전체 화면 지원 여부는 브라우저에 따라 다릅니다.

해초와 지느러미가 흔들리고 기포가 떠오릅니다. 산호, 바위, 불가사리, 모래 바닥의 물빛도 코드로 구성했습니다. OS의 ‘움직임 줄이기’ 설정에서는 정지 상태로 시작하며 ‘다시 헤엄’이나 먹이 주기로 움직임을 시작합니다.

## 주민 구성

모든 방문자는 `js/portraits.js`의 `DEFAULT_FISH`에 정의된 같은 네 마리를 봅니다. 페이지에서 사진이나 물고기를 추가·수정·삭제하는 기능은 없습니다. 주민 카드는 보기 전용입니다.

브라우저의 `localStorage`와 `sessionStorage`를 읽거나 쓰지 않습니다. 이전 버전에서 저장한 주민 정보가 남아 있어도 사용하지 않으므로, 과거에 추가하거나 삭제한 물고기가 다시 복원되지 않습니다. 헤엄 위치·먹이·조명·속도는 이번 방문 동안만 유지되고 새로고침하면 초기화됩니다. 이미지·스크립트 등 정적 파일에 대한 일반적인 HTTP 캐싱은 브라우저가 관리합니다.

기본 사진·이름·색·얼굴 크롭은 `DEFAULT_FISH`에서 수정해 배포하면 모든 방문자에게 반영됩니다. 기본 JPEG 원본은 수정하지 않습니다. 배포된 사진은 방문자에게 공개됩니다.

## GitHub Pages

`gh-pages` 브랜치의 루트(`/`)를 게시하며 원본 코드는 `main`에 있습니다. 별도의 npm 설치나 빌드가 필요하지 않고 `.nojekyll` 파일을 포함합니다.

수정 내용을 커밋한 뒤 두 브랜치를 함께 업로드합니다.

```bash
git push git@github.com:jsjang0104/aquarium.github.io.git main main:gh-pages
```

Actions 탭의 `pages build and deployment` 작업에서 배포 상태를 확인할 수 있습니다.

## 구성

```text
index.html            한국어 UI와 로컬 import map
styles.css            반응형 화면과 접근성 스타일
js/app.js             기본 주민 표시와 수조 제어
js/aquarium.js        3D 수조, 유영, 해초, 먹이, 카메라
js/fish-material.js   얼굴 사진의 곡면 매핑·경계 혼합·조명 재질
js/portraits.js       기본 사진 설정과 얼굴 크롭
vendor/              Three.js 0.180.0, OrbitControls, MIT 라이선스
tests/browser_test.py 실제 Chromium 브라우저 테스트
```

Three.js를 저장소에 포함하여 런타임 CDN 요청 없이 실행합니다. 라이선스는 `vendor/THREE-LICENSE.txt`에 있습니다.

## 검증

```bash
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
# Linux에서 라이브러리가 빠진 경우: .venv/bin/playwright install-deps chromium
python3 -m http.server 4173
```

다른 터미널에서 이 폴더를 기준으로 실행합니다.

```bash
.venv/bin/python -m unittest discover -s tests -p '*_test.py' -v
```

기본 렌더링과 제어, 이전 저장값 무시, 저장소 접근 없이 실행, 보기 전용 주민, 모바일과 움직임 감소 설정, 키보드 먹이 주기, 장시간 유영 경계와 먹이 섭취·정리, 양쪽 사진의 곡면 일치, WebGL 오류 안내를 검사합니다. `AQUARIUM_URL` 환경 변수로 배포 주소에서도 실행할 수 있습니다.
