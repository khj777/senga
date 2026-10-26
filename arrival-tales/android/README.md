# 도착동화 Android

목적지까지 남은 시간에 맞춰 오디오 동화의 선택 모험을 조절하는 Pleos Connect 앱입니다. 원작 「달을 배달하는 고래」 한 편을 한국어 오프라인 음원으로 제공합니다.

## 실행

- 제출 APK: `arrival-tales_release.apk`, 버전 0.2.0, 패키지 `ai.arrivaltales.app`.
- Android 9 이상. 차량 SDK 기능의 검증 환경은 **공식 Pleos Connect Emulator 2.1.0 / API 34 / x86_64**입니다.
- `adb -s <에뮬레이터 시리얼> install -r arrival-tales_release.apk`
- 앱을 실행하고 내장 내비게이션에서 경로 안내를 시작합니다. 화면의 `실제 ETA 수신` 횟수가 증가하면 차량 신호를 받은 것입니다. `재생`을 누릅니다.
- 일반 Android 기기에서도 정차 시연 입력으로 음원을 재생할 수 있습니다. Pleos 연결 실패 상태는 그대로 표시합니다.
- `여유 3:30`, `단축 1:40`, `곧 도착 0:45`, `도착`은 **수동 시연 입력**입니다. 실제 SDK 수신과 구분됩니다. 차량 신호로 돌아가려면 `차량 내비 연결`을 누릅니다.
- `처음부터`는 저장한 문장 진행 기록을 초기화합니다. 완주나 도착 후 새 여정을 시작할 때 사용합니다.
- 설치 파일은 콘테스트 검토용입니다. Pleos App Market 배포 승인 또는 실차 인증을 받은 앱이라는 뜻은 아닙니다.

## 구현

1. **내비 ETA** — 공식 Maven `ai.pleos.playground:NaviHelper:3.0.5`를 직접 사용합니다. `onDrivingInfo()`의 `destination.duration`(초)을 받고 도착·경로 취소 이벤트를 처리합니다. release 앱은 `NAVI_ROUTE` 조회 권한만 선언하며 경로를 변경하지 않습니다.
2. **음원 길이 편집** — 원문 문장 31개와 장면별 짧은 요약 8개, 총 39개 WAV를 포함합니다. 원문 전체는 **174,414ms**입니다. WAV 프레임 수로 길이를 측정하고 Android MediaPlayer 측정값과도 대조했습니다. 일반 구성은 핵심 4장면을 보존하고 시간 안에 들어오는 선택 4장면을 순서대로 배치합니다.
3. **문장 경계 전환** — 시간 변경은 재생 중 문장을 마친 뒤 다음 구성에 반영합니다. 핵심 원문이 더 이상 들어가지 않으면 남은 핵심 사건의 요약으로 연결합니다. 요약 재생을 시작한 뒤에는 다시 긴 구성으로 돌아가지 않습니다. 완료한 문장과 지나온 장면은 재생하지 않습니다.
4. **차량 미디어** — Android MediaBrowserService, MediaSession, MediaPlayer, foreground media notification, AudioFocusRequest를 사용합니다. 음성 콘텐츠로 선언하고 일시적 오디오 포커스 손실에는 정지·복귀합니다. 사용자가 직접 멈춘 상태는 자동 복귀하지 않습니다. 영구 손실 뒤에는 재생 버튼을 다시 눌러야 합니다. 미디어 브라우저 접근은 같은 앱 또는 시스템의 미디어 제어 권한을 가진 호스트로 제한합니다.
5. **도착 우선** — 도착·잔여 시간 0에는 즉시 정지합니다. 결말보다 빨리 도착하면 완주를 보장하지 않습니다. 종료 오차 0을 주장하지 않습니다.

시간은 `elapsedRealtime()`으로 계산해 일시정지 중에도 흐릅니다. 차량 신호가 90초 동안 갱신되지 않으면 ETA를 알 수 없음으로 표시하고 기존 구성을 유지합니다. 차량 신호를 임의의 시간으로 대체하지 않습니다. 정밀 위치, 아이의 이름·음성은 저장하지 않습니다. 완료한 문장 ID와 진행 상태만 기기 내부 SharedPreferences에 저장합니다.

## 검증 결과 2026년 10월 26일

| 항목 | 결과 |
| --- | --- |
| 편집·순서·반복 방지·종료·ETA 시계·포커스 의도 단위 테스트 | 21개 통과 |
| 실제 Android 디코더의 WAV 길이 | 39개 모두 측정값과 100ms 이내 일치 |
| 공식 Pleos NaviHelper 연결 | 성공 |
| 공식 에뮬레이터 SDK 콜백 ETA | 60초 수신 |
| 앱 차량 모드에서 SDK ETA를 받아 구성하고 음원 재생 | 통과 |
| 실제 AudioManager 일시적 포커스 손실·복귀 | 일시정지·재개 확인 |
| 수동 일시정지 뒤 포커스 복귀 | 일시정지 유지 확인 |
| 재생 중 수동 ETA 단축 | 문장 경계에서 요약으로 전환 확인 |
| 수동 도착 0 입력 | 즉시 정지 확인 |
| release APK | 별도 키로 서명, 공식 에뮬레이터에 새로 설치·실행 성공 |

`NaviSdkProbe`는 **공식 에뮬레이터 전용 진단**입니다. debug 빌드에서만 경로 검색 권한을 추가하고, 공개 예제 목적지로 경로를 요청한 뒤 취소합니다. 이를 실차 주행이나 실제 교통 ETA 정확도 검증으로 해석하지 않습니다. `PlaybackIntegrationTest`의 시간 단축·도착은 수동 입력이며 실제 내비의 도착 이벤트 재현 테스트와 구분합니다.

미검증 범위: 실제 차량 오디오 존·스피커·통화·내비 음성 전체 조합, 장시간 운행, 실차 재탐색·도착·경로 취소의 종합 시나리오, 사용자 이해도와 재이용률. 앱스토어 배포 전에는 주행 중 UI 제약, 접근성, 차종별 미디어 호스트 호환성 및 실차 품질 검증이 필요합니다. 임의의 동화를 생성하거나 모든 이동 길이를 채우는 기능은 없습니다. 한 편보다 긴 이동에는 이야기가 먼저 끝납니다.

## 빌드

JDK 17 이상(검증: Microsoft OpenJDK 21), Android SDK Platform 35, Build Tools 35, Gradle wrapper 8.9를 사용합니다. 최초 빌드는 Google Maven, Maven Central, Pleos 공식 Maven에 접근합니다. SDK 라이선스는 개발자가 직접 확인·동의해야 합니다.

```powershell
$env:JAVA_HOME='JDK 설치 경로'
$env:ANDROID_HOME='Android SDK 설치 경로'
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

release 서명 속성 파일은 저장소 밖에 만들고 다음 키를 넣습니다. 키와 비밀번호를 GitHub에 올리지 않습니다.

```properties
storeFile=C:/private/arrival-tales-release.jks
storePassword=직접 설정한 비밀번호
keyAlias=arrival-tales
keyPassword=직접 설정한 비밀번호
```

```powershell
$env:ARRIVAL_SIGNING_PROPERTIES='C:/private/release.properties'
.\gradlew.bat :app:assembleRelease
```

에뮬레이터 통합 검증은 격리된 개발용 기기에서만 진행합니다. `NaviSdkProbe`는 내비 경로 요청을 수행하므로 실차·개인 기기에 실행하지 않습니다.

```powershell
.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest
adb -s emulator-5580 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5580 install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5580 shell am instrument -w -e class ai.arrivaltales.app.PlaybackIntegrationTest ai.arrivaltales.app.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5580 emu geo fix 127.02 37.5
adb -s emulator-5580 shell am instrument -w -e class ai.arrivaltales.app.NaviSdkProbe ai.arrivaltales.app.test/androidx.test.runner.AndroidJUnitRunner
```

## 음원 재생성

이미 측정한 WAV가 소스에 포함돼 있어 재합성 없이 빌드할 수 있습니다. `tools/original-story.json`이 원문입니다. `tools/create_catalog.mjs`로 문장 목록을 만들고 Windows의 Microsoft Heami Desktop 한국어 음성으로 `tools/Synthesize.cs`를 실행한 다음 `python tools/measure_audio.py`로 길이·해시를 다시 측정합니다. 음성·플랫폼이 바뀌면 음원을 다시 측정해야 합니다. 재생성은 별도 선택 작업이며 기본 빌드 단계에 포함되지 않습니다.

코드·동화·도형 일러스트·문서는 생성형 AI의 도움을 받았고, 음원은 PC의 한국어 합성 음성으로 제작했습니다. 실행 중 외부 AI·음성 API를 호출하지 않습니다. 공개 소스에 대표자 성명·연락처·소속 및 서명 키를 포함하지 않습니다.

공식 참고: [NaviHelper](https://document.pleos.ai/en/api-reference/connect-sdk-pleos/NaviHelper/intro), [권한](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions), [Pleos 에뮬레이터](https://document.pleos.ai/en/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator), [Android 오디오 포커스](https://developer.android.com/media/optimize/audio-focus).

다운로드: [release APK](../apk/arrival-tales_release.apk), [음원 포함 전체 소스 ZIP](arrival-tales-android-source.zip), [검증 JSON](verification.json), [SDK 재생 화면](sdk-eta.png). `sdk-recording.mp4`는 공식 에뮬레이터의 20초 무음 화면 녹화로, 음향 녹음이나 전체 검증 절차 영상은 아닙니다.
