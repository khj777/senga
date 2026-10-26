# 도착동화 APK

[arrival-tales_release.apk](arrival-tales_release.apk)는 별도 키로 서명한 release APK입니다. 버전 0.2.0, applicationId ai.arrivaltales.app, minSdk 28, targetSdk 34입니다. Android 9 이상에서 설치할 수 있으며 차량 기능 검증 환경은 공식 Pleos Connect Emulator 2.1.0 / API 34 / x86_64입니다.

`adb -s <개발용 에뮬레이터 시리얼> install -r arrival-tales_release.apk`

앱을 실행하고 내장 내비에서 경로 안내를 시작합니다. 실제 ETA 수신 횟수를 확인한 뒤 재생을 누릅니다. 일반 Android에서는 정차 시연 시간 버튼으로 체험할 수 있으며 실제 차량 신호와 구분해서 표시합니다.

서명 검증 및 공식 에뮬레이터 설치·실행을 확인했습니다. SDK ETA 수신·네이티브 음원 재생과 오디오 포커스는 동일 소스의 debug 빌드 통합 테스트로 검증했습니다. 실차 검증과 App Market 배포 승인은 별도입니다. [상세 안내와 전체 소스](../android/README.md), [APK SHA-256](../android/verification.json)을 참고하세요. 서명 키는 포함하지 않습니다.
