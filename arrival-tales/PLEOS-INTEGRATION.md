# Pleos 연결 검토 — 2026-10-19

공식 문서 확인에 더해 2026-10-19 15:59 KST에 SDK를 실제 다운로드하고 공개 클래스/메서드를 정적으로 검사했습니다. Android 빌드·에뮬레이터 실행 검증은 아직 하지 않았습니다.

## 실제 검증 결과

공식 Maven 저장소에서 인증 헤더, 로그인, API 키 없이 다음 파일이 HTTP 200으로 내려왔습니다.

| 파일 | 결과 |
|---|---|
| NaviHelper 버전 목록 | 최신/배포 버전 `3.0.5` |
| NaviHelper 3.0.5 POM / AAR | 다운로드 성공, AAR 65,944바이트 |
| navi-data 3.0.4 POM / AAR | 다운로드 성공, AAR 298,474바이트 |
| navi-aidl 3.0.1 POM / AAR | 다운로드 성공, AAR 17,213바이트 |

세 AAR의 ZIP 구조를 열어 `classes.jar`의 공개 JVM 시그니처를 직접 검사했습니다. 내려받은 바이너리를 실행하거나 비공개 API를 사용하지 않았습니다.

- `NaviHelper(Context)`, `initialize()`, 연결 성공/실패 콜백을 받는 `initialize(...)` 존재.
- `addListener(NaviHelperEventListener)`, `removeListener(...)`, `release()` 존재.
- `onDrivingInfo(DrivingInfo)` 존재.
- `DrivingInfo.getDestination(): DrivingState` 존재하며 NotNull로 표시.
- `DrivingState.getDuration(): int` 존재. 단위는 렌더링된 공식 문서에서 초로 확인.
- `onDestinationArrived(DestinationArrivedInfo)`, `onReRouteEnded()`, `onRouteCancelled()` 존재.
- `getDestinationInfo()`와 `getRouteStateInfo()`의 바이너리 annotation에 `pleos.car.permission.NAVI_ROUTE`가 실제 포함됨.
- **공개 NaviHelper에 `getDrivingInfo()`는 없음.** ETA는 `onDrivingInfo` 이벤트를 수신해야 하며, 임의의 폴링 메서드를 가정하면 안 됨.

증거와 재검증 스크립트는 `api-audit/`에 저장했습니다. `download-results.json` 및 `additional-download-results.json`은 요청 URL·시각·HTTP 상태·크기·SHA-256을 기록합니다. `sdk-public-api.json`은 공개 시그니처 추출 결과이고, `verification-results.json`은 핵심 항목 10개의 검사 결과입니다. 문서 `/introduction` 요청은 HTTP 200의 오류 페이지였으므로 근거로 사용하지 않았습니다.

## 남은 실행 검증

현재 PATH에서 `java`, `javap`, `gradle`, `adb`가 발견되지 않았고, `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`도 설정되지 않았습니다. 일반 설치 경로의 Android SDK/Android Studio도 발견되지 않았습니다. 사용자 지정 위치의 설치 여부까지 전체 디스크를 탐색한 것은 아닙니다.

따라서 **SDK 접근과 필요한 공개 API의 실재는 확인했지만, 에뮬레이터의 내비 서비스가 ETA 이벤트를 실제로 전달하는지는 미확인**입니다. SDK 접근 가능성과 실차/스토어에서의 모든 권한 허용은 별도 문제입니다.

공식 이벤트 가이드는 내비 앱 구현 시나리오에 따라 전달되는 이벤트가 달라질 수 있다고 명시합니다. 실시간 앱 개발을 진행하기 위한 다음 통과 조건은 아래와 같습니다.

1. Pleos 에뮬레이터에 최소 Android 앱을 설치하고 `initialize(onConnected, onFailed)`의 성공 확인.
2. 성공 후 리스너 등록, 내비 목적지 설정 및 경로 안내 시작.
3. `onDrivingInfo`의 첫 수신, duration 값, 갱신 간격 기록. 값이 없거나 오래되면 자동 시간 편집을 중단하고 수동 시간 선택으로 전환.
4. 경로 변경·취소·목적지 도착 이벤트 확인. ETA 0 하나만으로 도착을 단정하지 않기.
5. 실제 내비 음성 중 AudioFocus 상실/복귀 확인. 앱 일시정지 의도와 영구 포커스 상실을 구분.

관련 공식 절차: [초기화](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/initialization-and-release), [이벤트 등록](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/event-listeners).

## 접근 조건

[Create a Project and Request SDK Access](https://document.pleos.ai/en/docs/pleos-only/create-my-project)는 NaviHelper와 Vehicle State를 Ready to Use, 별도 신청 없이 이용 가능하다고 안내합니다. 같은 페이지는 Pleos TextToSpeech, SpeechToText, FusedLocation, Vehicle Control을 Not Available Yet로 표시합니다. 따라서 이 제품의 음성 출력은 Pleos TTS에 의존하지 않고 사전 제작 오디오 또는 기기 기본 TTS를 사용하도록 설계했습니다.

다른 소개 페이지의 SDK 목록만으로 개별 기능의 접근을 보장하지 않습니다. 클라우드 Vehicle Data API, Fleet API, 좌석 인식, 카메라, 차량 제어는 이 아이디어의 핵심에 필요하지 않습니다.

## 최소 연결

| 역할 | 공식 API / 구현 경로 | 시제품 대응 |
|---|---|---|
| 목적지 잔여 시간 | `NaviHelperEventListener.onDrivingInfo(drivingInfo: DrivingInfo)` → `drivingInfo.destination.duration: Int` (초) | `setEta(duration / 60)`에 대응하는 상태 업데이트 |
| 경로 변경 | `onReRouteEnded()` 이후 새 잔여 시간 수신 | 남은 장면 재계획 |
| 경로 취소 | `onRouteCancelled()` | 제품판에서는 자동 편집 중단 후 남은 콘텐츠 계속/종료를 정차 시 결정 |
| 도착 | `onDestinationArrived(destinationArrivedInfo)` | `setEta(0)`, 음성 중단·도착 카드 |
| 길 안내 우선 | Android `AudioManager.OnAudioFocusChangeListener` | 현재 데모의 안내 버튼 |

`onTBTInfo`는 회전 정보 콜백이며 내비 음성의 실제 시작/종료 콜백이 아닙니다. 일시정지는 AudioFocus를 사용해야 합니다. Pleos 공식 음악/오디오 개발 가이드에 `AUDIOFOCUS_LOSS_TRANSIENT`, `AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK`에서 일시정지하고 `AUDIOFOCUS_GAIN`에서 재개하는 예제가 있습니다. 영구 포커스 상실, 사용자가 일시정지한 경우, 앱 백그라운드 상태는 별도 구분해야 합니다.

제품판의 재생은 MediaSession과 MediaBrowserService 등 차량 미디어 구조를 따르도록 구현해야 합니다. 이 웹 앱의 DOM/음성 코드는 Android 구현으로 그대로 옮겨지는 코드가 아닙니다. 순수 JavaScript 편집 로직은 언어를 바꿔 동일 규칙을 재현할 수 있습니다.

## SDK와 권한 메모

현재 import 문서: `implementation("ai.pleos.playground:NaviHelper:3.0.5")`

저장소: `https://nexus-playground.pleos.ai/repository/maven-releases/`

조회 `get*Info()` 권한: `pleos.car.permission.NAVI_ROUTE`. 경로 설정 권한 `NAVI_ROUTE_SEARCH`는 이 앱의 핵심에 불필요합니다. 리스너 등록 시 권한 동작, 갱신 빈도, 내비 앱별 이벤트 제공, 연결 재수립은 실행으로 검증해야 합니다.

에뮬레이터 문서는 2.1.0, Android API 34 시스템 이미지, minSDK 28+, Gradle 8+, RAM 4GB를 안내합니다. 이 버전 이상에서 CRN 없이 설치 가능하다고 명시합니다.

## 정확한 공식 출처

- [DrivingState.duration](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/driving-state/entry)
- [DrivingInfo.destination](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/driving-info/entry)
- [NaviHelperEventListener](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper.listener/navi-helper-event-listener/entry)
- [NaviHelper 가져오기](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/importing-sdk)
- [NaviHelper 권한](https://document.pleos.ai/api-reference/connect-sdk-pleos/NaviHelper/declaring-permissions)
- [Pleos Music/Audio 개발 가이드](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/music-audio-app-developement-guide)
- [에뮬레이터 설치](https://document.pleos.ai/en/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)
- [호환성/가용성](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-planning-guide/api-compatibility-availability)

## 출품 전에 확인할 것

이 문서는 공모전 주최 측의 별도 제공 API 목록이나 심사 기준을 대신하지 않습니다. 10월 21일 공모전 정식 오픈 후 제공 SDK 범위, 제출 양식, 차량 앱 카테고리와 심사 기준을 대조해야 합니다. 현재는 기획·브라우저 상호작용·API 문서 근거까지 확보한 상태입니다.
