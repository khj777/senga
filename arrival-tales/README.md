# 도착동화

목적지까지 남은 이동 시간에 맞춰 동화의 선택 모험을 조절하는 가족 대상 차량용 오디오 앱입니다. 핵심 사건과 결말을 이어 주며 실행 중 외부 AI·음성 API를 호출하지 않습니다.

## Android 버전 0.2.0

- [서명된 release APK](apk/arrival-tales_release.apk)
- [Android 실행·빌드·검증 안내](android/README.md)
- [음원과 테스트를 포함한 Android 전체 소스 ZIP](android/arrival-tales-android-source.zip)
- [검증 결과와 APK 해시](android/verification.json)
- [공식 에뮬레이터 SDK ETA 재생 화면](android/sdk-eta.png)

2026년 10월 26일 공식 Pleos Connect Emulator 2.1.0 / API 34 / x86_64에서 NaviHelper 3.0.5 연결, ETA 60초 수신, 앱 차량 모드의 실측 음원 구성·재생을 확인했습니다. 단위 테스트 21개와 에뮬레이터 통합 테스트 2개를 통과했습니다. 한국어 WAV 39개의 Android 재생 길이를 측정값과 대조했으며 원문 전체는 약 2분 54초입니다.

Android MediaSession·MediaBrowserService·foreground media service·AudioFocusRequest를 구현했습니다. 실제 Android 오디오 포커스 손실·복귀, 수동 일시정지 유지, 문장 경계에서 시간 단축 반영과 수동 도착 정지를 에뮬레이터에서 검증했습니다. release APK 서명 검증과 설치·실행도 확인했습니다.

**검증 범위:** 공식 에뮬레이터 결과입니다. 실차의 오디오 존·스피커·통화·모든 내비 이벤트 조합, 장시간 주행, 사용자 만족도와 실제 종료 오차는 검증 전입니다. 도착이 결말보다 빠르면 즉시 정지합니다. 모든 이동 길이의 완주나 App Market 배포 승인을 주장하지 않습니다. 원작 한 편으로 구성한 기능 시제품입니다.

## 초기 웹 시제품

`dist/`, `tests/`, `도착동화-시제품.html`은 초기 개념 설명용 웹 구현입니다. 웹의 ETA와 길 안내는 수동 시뮬레이션이며 웹 장면의 분량 예산은 음원 실측값이 아닙니다. 현재 Android 구현과 구분합니다.

서버 없이 `도착동화-시제품.html`을 Chrome 또는 Edge로 열 수 있습니다. 소스에서 실행하려면 Node.js 22 이상으로 아래 명령을 사용합니다.

```text
node server.mjs
node --test --test-isolation=none tests/engine.test.mjs tests/controller.test.mjs
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다. 웹 테스트는 20개이며 Android 테스트와 별개입니다.

코드·원문·도형 일러스트·문서는 생성형 AI의 도움을 받았습니다. 음원은 PC의 한국어 합성 음성으로 제작했습니다. 참가 신청서·개인정보 동의서·연락처·서명 키·SDK 시스템 이미지는 공개 소스에 포함하지 않습니다.
