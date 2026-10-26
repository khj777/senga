# Pleos 연동 현황

2026년 10월 26일 Android 0.2.0에서 공식 NaviHelper 3.0.5를 직접 연동했습니다. 공식 Pleos Connect Emulator 2.1.0에서 연결과 목적지 ETA 60초 수신을 확인했고, 앱의 차량 모드에서 해당 신호에 맞춰 실제 음원을 구성·재생했습니다.

onDrivingInfo의 destination.duration을 초 단위로 처리합니다. 도착에는 즉시 정지하고 경로 취소에는 시간 무효화와 일시정지를 수행합니다. 서비스 종료 시 리스너 제거와 SDK 해제를 수행합니다. release 앱은 NAVI_ROUTE 조회 권한만 선언합니다. 에뮬레이터 진단용 debug 빌드에만 경로 요청용 NAVI_ROUTE_SEARCH를 추가합니다.

Android MediaBrowserService·MediaSession·MediaPlayer·AudioFocusRequest를 사용합니다. 실측 WAV 길이와 문장 경계에 맞춰 구성을 바꿉니다. 90초 이상 수신이 끊기면 알 수 없는 ETA로 표시하고 기존 구성을 유지합니다. 수동 시연 시간은 실제 SDK 신호로 표시하지 않습니다.

검증한 범위와 남은 실차 검증, 소스, APK는 [Android 안내](android/README.md)와 [검증 기록](android/verification.json)을 참고하세요. api-audit의 10월 19일 자료는 구현 전 정적 API 확인 기록이며 현재 Android 실행 검증과 구분합니다.

공식 참고: [NaviHelper](https://document.pleos.ai/en/api-reference/connect-sdk-pleos/NaviHelper/intro), [권한](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/declaring-permissions), [Android 오디오 포커스](https://developer.android.com/media/optimize/audio-focus).
