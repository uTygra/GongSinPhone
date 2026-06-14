# 공신폰 SaaS — AI 구현 프롬프트 모음

> Claude Code / ChatGPT 등 AI에게 각 모듈 구현을 요청할 때 사용하는 프롬프트 모음  
> 각 프롬프트는 복사해서 바로 사용 가능합니다.

---

## 목차

1. [Phase 0: PoC 스크립트](#phase-0-poc-스크립트)
2. [Phase 1: 프로젝트 초기 세팅](#phase-1-프로젝트-초기-세팅)
3. [Phase 1: Prisma 스키마](#phase-1-prisma-스키마)
4. [Phase 1: NextAuth 인증](#phase-1-nextauth-인증)
5. [Phase 1: AMAPI 연동 라이브러리](#phase-1-amapi-연동-라이브러리)
6. [Phase 1: 기기 등록 API (QR)](#phase-1-기기-등록-api-qr)
7. [Phase 1: 정책 변경 API](#phase-1-정책-변경-api)
8. [Phase 1: 부모 콘솔 대시보드](#phase-1-부모-콘솔-대시보드)
9. [Phase 1: 앱 관리 화면](#phase-1-앱-관리-화면)
10. [Phase 1: 시간표 설정 화면](#phase-1-시간표-설정-화면)
11. [Phase 1: QR 온보딩 페이지](#phase-1-qr-온보딩-페이지)
12. [Phase 1: 포트원 결제 연동](#phase-1-포트원-결제-연동)
13. [Phase 1: 스케줄 Cron](#phase-1-스케줄-cron)
14. [Phase 1: Pub/Sub 웹훅](#phase-1-pubsub-웹훅)
15. [Phase 2: 위치 추적 기능](#phase-2-위치-추적-기능)

---

## Phase 0: PoC 스크립트

### 프롬프트 0-1: 엔터프라이즈 + 정책 생성 스크립트

```
다음 스펙으로 Node.js TypeScript 스크립트를 작성해줘.

파일명: scripts/poc-setup.ts

목적: 공신폰 SaaS PoC를 위해 Google Android Management API로 엔터프라이즈를 생성하고 정책 3벌(study/free/expired)을 등록한다.

환경변수:
- GOOGLE_PROJECT_ID: GCP 프로젝트 ID
- GOOGLE_SERVICE_ACCOUNT_KEY: 서비스 계정 JSON 키 파일 경로

구현 내용:
1. googleapis 패키지로 androidmanagement v1 클라이언트 초기화
2. 서비스 계정 인증 (keyFile 방식)
3. enterprises.create() 호출 - enterpriseDisplayName은 'gongshin-poc'
4. pubsubTopic은 비워도 됨 (PoC라 웹훅 불필요)
5. 생성된 엔터프라이즈 이름으로 정책 3벌 등록:

study 정책:
- developerSettings: DEVELOPER_SETTINGS_DISABLED
- safeBootDisabled: true
- factoryResetDisabled: true
- networkResetDisabled: true
- modifyAccountsDisabled: true
- screenCaptureDisabled: true
- untrustedAppsPolicy.untrustedAppInstallSources: DISALLOW_INSTALL
- kioskCustomLauncherEnabled: true
- kioskCustomization: statusBar=NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED, systemNavigation=NAVIGATION_DISABLED, deviceSettings=SETTINGS_ACCESS_BLOCKED
- applications: 전화(com.samsung.android.dialer), 문자(com.samsung.android.messaging) = FORCE_INSTALLED, 삼성 브라우저/크롬/유튜브 = BLOCKED

free 정책:
- 보안 설정은 study와 동일
- kioskCustomLauncherEnabled: false (일반 런처 복귀)
- applications: 전화, 문자, 카카오톡 = FORCE_INSTALLED

expired 정책:
- 전화만 FORCE_INSTALLED
- kioskCustomLauncherEnabled: true
- KIOSK 앱: com.gongshin.renewal_notice
- 보안 설정은 study와 동일

6. 결과를 콘솔에 출력 (enterpriseName, 각 정책 이름)
7. 엔터프라이즈 이름을 .env.local 파일에 AMAPI_ENTERPRISE_NAME으로 저장

tsconfig.json은 CommonJS 기준으로 작성하고 ts-node로 실행 가능하게 해줘.
```

---

### 프롬프트 0-2: QR 등록 토큰 발급 스크립트

```
다음 스펙으로 Node.js TypeScript 스크립트를 작성해줘.

파일명: scripts/poc-enroll.ts

목적: AMAPI 등록 토큰을 발급받아 QR 코드 이미지를 생성하고 터미널에 출력한다.

전제:
- poc-setup.ts 실행 후 .env.local에 AMAPI_ENTERPRISE_NAME이 있음
- googleapis, qrcode 패키지 사용

구현 내용:
1. .env.local에서 AMAPI_ENTERPRISE_NAME 읽기
2. enterprises.enrollmentTokens.create() 호출:
   - policyName: {enterpriseName}/policies/study
   - duration: '3600s'
   - allowPersonalUsage: 'PERSONAL_USAGE_DISALLOWED'
3. 받은 토큰 value(JSON 문자열)로 QR 이미지 생성
4. qrcode 패키지로 poc-qr.png 파일로 저장
5. 터미널에 ASCII QR 코드도 출력
6. 토큰 만료 시간도 출력

사용법 안내 메시지 출력:
"갤럭시 초기화 후 환영 화면에서 6번 탭 → Wi-Fi 연결 → QR 스캔"
```

---

## Phase 1: 프로젝트 초기 세팅

### 프롬프트 1-1: Next.js 프로젝트 세팅

```
공신폰 SaaS Next.js 15 프로젝트 초기 세팅을 해줘.

프로젝트 스택:
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- Supabase PostgreSQL

설치할 패키지:
- @prisma/client, prisma
- next-auth@beta (v5)
- googleapis
- @portone/browser-sdk
- qrcode, @types/qrcode
- sharp

필요한 파일:
1. .env.local.example - 필요한 환경변수 목록 (값은 비워두기):
   - DATABASE_URL
   - NEXTAUTH_SECRET
   - NEXTAUTH_URL
   - KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET
   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - GOOGLE_PROJECT_ID
   - GOOGLE_SERVICE_ACCOUNT_KEY (파일 경로 또는 JSON 문자열)
   - AMAPI_ENTERPRISE_NAME_PREFIX (enterprises/ prefix 없이 ID만)
   - PORTONE_API_KEY
   - PORTONE_API_SECRET
   - PORTONE_STORE_ID

2. src/lib/prisma.ts - Prisma 클라이언트 싱글턴
3. vercel.json - cron 설정 (schedule/apply를 15분 단위로, billing/charge를 매월 1일 09:00 KST로)
4. .gitignore - .env.local, sa-key.json, *.pem 추가

tsconfig.json의 paths 설정:
- @/* → src/*
```

---

## Phase 1: Prisma 스키마

### 프롬프트 1-2: Prisma 스키마 작성

```
공신폰 SaaS의 Prisma 스키마를 작성해줘.

파일: prisma/schema.prisma
데이터베이스: PostgreSQL (Supabase)

모델 요구사항:

1. User 모델:
   - id: cuid
   - email: unique
   - name, phone: optional
   - kakaoId, googleId: optional, unique
   - enterpriseId: optional (AMAPI enterprises/{id} 전체 경로 저장)
   - devices: Device[]
   - subscription: Subscription? (1:1)
   - createdAt, updatedAt

2. Device 모델:
   - id: cuid
   - userId: User 외래키
   - amapiDeviceId: optional (enterprises/{n}/devices/{id})
   - amapiPolicyName: optional (현재 적용된 정책 경로)
   - enrollmentToken: optional (QR 발급 후 단말 등록되면 null로)
   - enrollmentTokenExpiry: optional DateTime
   - status: DeviceStatus enum (PENDING/ACTIVE/EXPIRED/LOCKED)
   - kidsName: optional
   - model: optional (삼성 모델명)
   - androidVersion: optional
   - batteryLevel: optional Int
   - lastSeen: optional DateTime
   - schedule: Schedule? (1:1)
   - createdAt, updatedAt

3. Subscription 모델:
   - id: cuid
   - userId: unique (User 1:1)
   - billingKey: 포트원 빌링키
   - plan: PlanType enum (BASIC/PRO)
   - status: SubStatus enum (ACTIVE/PAST_DUE/CANCELLED)
   - currentPeriodEnd: DateTime
   - failCount: Int default 0
   - cancelledAt: optional DateTime
   - createdAt, updatedAt

4. Schedule 모델:
   - id: cuid
   - deviceId: unique (Device 1:1)
   - weekdays: Json (0-6: 일~토, [{start:"09:00", end:"22:00"}] 배열)
   - studyApps: String[] (공부시간 추가 허용 앱 패키지명)
   - freeApps: String[] (자유시간 허용 앱 패키지명)
   - createdAt, updatedAt

enum도 함께 정의해줘.
```

---

## Phase 1: NextAuth 인증

### 프롬프트 1-3: NextAuth v5 카카오 + 구글 로그인

```
Next.js 15 App Router + NextAuth v5로 카카오와 구글 소셜 로그인을 구현해줘.

요구사항:
1. auth.ts (프로젝트 루트) - NextAuth 설정
   - KakaoProvider: kakaoId를 user 레코드에 저장
   - GoogleProvider: googleId를 user 레코드에 저장
   - PrismaAdapter 사용 (@auth/prisma-adapter)
   - session strategy: database
   - callbacks.session: session.user.id에 DB user.id 주입

2. src/app/api/auth/[...nextauth]/route.ts - 핸들러

3. src/app/login/page.tsx - 로그인 페이지
   - "카카오로 시작하기" 버튼 (노란 배경)
   - "구글로 시작하기" 버튼
   - 공신폰 로고/타이틀
   - 미니멀 디자인, Tailwind CSS

4. src/middleware.ts - 인증 미들웨어
   - /dashboard/* 경로는 로그인 필요
   - /api/devices/*, /api/schedule/*, /api/billing/* 경로는 로그인 필요
   - 미인증 시 /login으로 리다이렉트

5. src/lib/auth-helpers.ts
   - getServerSession() 래퍼 함수
   - requireAuth() - 서버 컴포넌트/API 라우트에서 사용

환경변수: KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL
```

---

## Phase 1: AMAPI 연동 라이브러리

### 프롬프트 1-4: AMAPI 클라이언트 + 정책 빌더

```
공신폰 SaaS의 AMAPI 연동 라이브러리를 작성해줘.

파일: src/lib/amapi.ts

구글 서비스 계정 인증:
- 환경변수 GOOGLE_SERVICE_ACCOUNT_KEY에 JSON 키 내용(문자열)이 있음
- googleapis의 GoogleAuth 사용, scope: androidmanagement

구현할 함수:

1. createEnterpriseForUser(userId: string): Promise<string>
   - enterprises.create() 호출
   - enterpriseDisplayName: 'gongshin-user-{userId}'
   - pubsubTopic: projects/{GOOGLE_PROJECT_ID}/topics/amapi-events
   - 생성 후 정책 3벌(study/free/expired) 자동 생성
   - DB User의 enterpriseId 업데이트
   - 반환: enterpriseName (enterprises/{id})

2. createEnrollmentToken(enterpriseName: string): Promise<{value: string, expiry: Date}>
   - enrollmentTokens.create() 호출
   - policyName: {enterpriseName}/policies/study
   - duration: '3600s'
   - allowPersonalUsage: 'PERSONAL_USAGE_DISALLOWED'
   - 반환: 토큰 value (QR 인코딩용 JSON 문자열)와 만료시각

3. patchDevicePolicy(amapiDeviceId: string, policyName: string): Promise<void>
   - devices.patch() 호출
   - updateMask: 'policyName'
   - 정책 경로 형식: enterprises/{n}/policies/{study|free|expired}

4. patchApplications(policyName: string, allowedApps: string[]): Promise<void>
   - policies.patch() 호출
   - updateMask: 'applications'
   - 기본 화이트리스트(전화, 문자, 시계) + allowedApps 합쳐서 빌드
   - 나머지 위험 앱(브라우저, 유튜브 등)은 BLOCKED로 명시

5. getDeviceInfo(amapiDeviceId: string): Promise<DeviceInfo>
   - devices.get() 호출
   - 반환: { model, androidVersion, batteryLevel, lastSeen }

별도 파일 src/lib/policies/builder.ts:
- buildStudyPolicy(enterpriseName: string, allowedApps?: string[]): AMAPI 정책 객체
- buildFreePolicy(enterpriseName: string, allowedApps?: string[]): AMAPI 정책 객체
- buildExpiredPolicy(enterpriseName: string): AMAPI 정책 객체

Knox Service Plugin 설정도 applications 배열에 포함 (allow_safe_mode: false, allow_firmware_recovery: false).
```

---

## Phase 1: 기기 등록 API (QR)

### 프롬프트 1-5: 기기 등록 엔드포인트

```
공신폰 SaaS의 기기 등록 API를 Next.js 15 App Router로 구현해줘.

파일: src/app/api/devices/enroll/route.ts

POST 핸들러:
1. 로그인 세션 확인 (requireAuth)
2. Body: { kidsName: string; deviceNickname?: string }
3. 구독 상태 확인 - BASIC은 기기 1대, PRO는 3대 제한
4. User의 enterpriseId 조회 (없으면 createEnterpriseForUser 호출)
5. createEnrollmentToken() 호출로 등록 토큰 발급
6. qrcode 패키지로 QR 이미지 생성 (base64 PNG)
7. DB Device 레코드 생성 (status: PENDING, enrollmentToken, enrollmentTokenExpiry)
8. 응답: { deviceId, qrCodeDataUrl, enrollmentTokenExpiry }

에러 처리:
- 구독 없음: 403 "구독이 필요합니다"
- 기기 한도 초과: 403 "플랜 기기 한도를 초과했습니다"
- AMAPI 오류: 502 + 오류 메시지 로깅

파일: src/app/api/devices/webhook/route.ts

POST 핸들러 (AMAPI Pub/Sub 웹훅):
1. Pub/Sub 메시지 파싱 (base64 디코딩)
2. 이벤트 타입별 처리:
   - ENROLLMENT_COMPLETE: Device 상태 PENDING → ACTIVE, amapiDeviceId 저장
   - DEVICE_REPORT: batteryLevel, androidVersion, model, lastSeen 업데이트
3. 응답: 200 OK (Pub/Sub ACK)
```

---

## Phase 1: 정책 변경 API

### 프롬프트 1-6: 정책 즉시 변경 API

```
공신폰 SaaS의 정책 변경 API를 구현해줘.

파일: src/app/api/devices/[id]/policy/route.ts

PATCH 핸들러:
1. 로그인 세션 확인
2. deviceId로 Device 조회 + 소유권 확인 (device.userId === session.user.id)
3. Body: { allowedApps: string[] } - 허용할 앱 패키지명 배열
4. patchApplications() 호출 (study 정책 기반, apps 교체)
5. DB Schedule.studyApps 업데이트
6. 응답: { ok: true, appliedAt: ISO 문자열 }

파일: src/app/api/devices/[id]/lock/route.ts

POST 핸들러 (긴급 잠금 - 프로 플랜만):
1. 로그인 + 소유권 + PRO 플랜 확인
2. patchDevicePolicy(device.amapiDeviceId, 'expired') 호출
3. DB Device 상태 → LOCKED 업데이트
4. 응답: { ok: true }

파일: src/app/api/devices/[id]/status/route.ts

GET 핸들러:
1. 로그인 + 소유권 확인
2. getDeviceInfo(device.amapiDeviceId) 호출
3. DB Device 업데이트 (batteryLevel, lastSeen)
4. 응답: { status, kidsName, model, batteryLevel, lastSeen, currentMode }
   - currentMode: amapiPolicyName에 'study'/'free'/'expired' 포함 여부로 판단
```

---

## Phase 1: 부모 콘솔 대시보드

### 프롬프트 1-7: 대시보드 메인 화면

```
공신폰 SaaS 부모 콘솔 메인 대시보드를 Next.js 15 Server Component로 구현해줘.

파일: src/app/dashboard/page.tsx

UI 요구사항:
1. 헤더: "안녕하세요, {부모 이름}님" + 로그아웃 버튼
2. 구독 배너: 현재 플랜, 다음 결제일, 기기 수 / 한도
3. 기기 카드 목록 (Device마다):
   - 아이 이름 (크게)
   - 폰 모델명
   - 배터리 % (아이콘 + 숫자)
   - 현재 모드 뱃지: "공부 중 🔒" (파란색) / "자유 시간 ✅" (초록)
   - 마지막 동기화 시간 ("5분 전" 형식)
   - 버튼 2개: "앱 관리" → /dashboard/apps?device={id}, "시간표" → /dashboard/schedule?device={id}
   - 즉시 모드 전환 버튼 (공부 ↔ 자유, 클라이언트 컴포넌트)
4. "새 기기 등록" 버튼 → /enroll
5. 구독이 없는 경우 구독 안내 배너 표시

데이터 패칭:
- Prisma로 서버에서 User + devices + subscription 조회
- 기기 상태는 10분 주기로 자동 갱신 (useEffect polling 또는 revalidate)

스타일:
- Tailwind CSS
- 모바일 우선 (부모가 핸드폰으로 주로 사용)
- 다크/라이트 모드 없이 라이트 모드 고정
- 색상: 파란색 계열 (공부 중), 초록 계열 (자유 시간), 빨간 (만료/잠금)
```

---

## Phase 1: 앱 관리 화면

### 프롬프트 1-8: 앱 허용 토글 화면

```
공신폰 SaaS 앱 관리 화면을 구현해줘.

파일: src/app/dashboard/apps/page.tsx (Server Component)
파일: src/components/AppToggle.tsx (Client Component)

앱 목록 정의 (하드코딩):
공부시간 기본 허용:
- 전화 (com.samsung.android.dialer) - 항상 ON, 비활성화
- 문자 (com.samsung.android.messaging) - 항상 ON, 비활성화
- 시계/타이머 (com.sec.android.app.clockpackage) - 항상 ON, 비활성화

부모가 토글 가능:
- 카카오톡 (com.kakao.talk) - 기본 ON
- 네이버 사전 (com.nhn.android.search) - 기본 ON
- 캘린더 (com.samsung.android.calendar) - 기본 ON
- 유튜브 뮤직 (com.google.android.apps.youtubemusic) - 기본 OFF
- 멜론 (com.iloen.melon) - 기본 OFF
- 계산기 (com.sec.android.app.popupcalculator) - 기본 ON

항상 차단:
- 삼성 브라우저, 크롬, 유튜브, Play 스토어 - 항상 OFF, 비활성화, "차단 고정" 표시

UI:
- 각 앱: 아이콘 자리 + 앱 이름 + 패키지명(작게) + 토글 스위치
- 변경 사항 있으면 상단에 "저장하기" 버튼 활성화
- 저장 시 PATCH /api/devices/{id}/policy 호출
- 성공 시 "반영 중... 30초~2분 소요" 토스트

공부시간 전용 앱 섹션:
- 공부시간에만 추가로 허용할 앱 (예: 교육 앱)
- EBS Math (com.ebs.ebsmath) 등 예시 앱 목록 제공
```

---

## Phase 1: 시간표 설정 화면

### 프롬프트 1-9: 요일별 시간표 설정

```
공신폰 SaaS 시간표 설정 화면을 구현해줘.

파일: src/app/dashboard/schedule/page.tsx
파일: src/components/ScheduleEditor.tsx (Client Component)

데이터 구조:
weekdays: {
  0: [],           // 일요일 (빈 배열 = 하루종일 자유)
  1: [{start: "14:00", end: "22:00"}],  // 월요일 공부시간
  2: [{start: "14:00", end: "22:00"}],  // 화요일
  3: [{start: "14:00", end: "22:00"}],  // 수요일
  4: [{start: "14:00", end: "22:00"}],  // 목요일
  5: [{start: "14:00", end: "22:00"}],  // 금요일
  6: [{start: "10:00", end: "22:00"}],  // 토요일
}
// 공부시간 = 위 범위에 포함된 시간, 나머지 = 자유시간

UI:
1. 요일 탭 (일~토) 또는 한 번에 7줄 표시
2. 각 요일:
   - "하루종일 자유" 토글 (ON이면 시간 설정 비활성화)
   - 공부시간 범위: 시작 시각 ~ 종료 시각 선택 (셀렉트박스, 30분 단위)
   - 여러 구간 추가 가능 (예: 오전 9~12시 + 오후 2~10시)
3. "평일 일괄 적용" 버튼
4. 저장 버튼 → PUT /api/schedule/{deviceId} 호출
5. "cron이 15분 이내에 자동 적용됩니다" 안내 문구

저장 API:
파일: src/app/api/schedule/[deviceId]/route.ts
PUT 핸들러:
- DB Schedule.weekdays 업데이트
- 즉시 정책 적용 여부 옵션 제공 (선택)
```

---

## Phase 1: QR 온보딩 페이지

### 프롬프트 1-10: 4단계 QR 등록 온보딩

```
공신폰 SaaS 기기 등록 온보딩 페이지를 구현해줘.

파일: src/app/enroll/page.tsx (Client Component)

4단계 흐름:

STEP 1 - 백업 안내:
- 제목: "먼저 중요한 데이터를 백업하세요"
- Samsung Smart Switch 백업 방법 설명 (간단한 텍스트 + 링크)
- Google 계정 백업 체크 안내
- "백업 완료" 버튼 → STEP 2

STEP 2 - 초기화 안내:
- 제목: "공신폰으로 초기화합니다"
- 단계: 설정 → 일반 관리 → 초기화 → 공장 초기화
- 주의사항: "이 과정은 되돌릴 수 없습니다"
- 경고 색상 배너
- "초기화 시작했어요" 버튼 → STEP 3 (QR 발급 API 호출)

STEP 3 - QR 스캔:
- POST /api/devices/enroll 호출 (kidsName은 이전에 입력받음)
- QR 이미지 크게 표시 (최소 250x250)
- 안내 텍스트: "갤럭시 환영 화면에서 화면을 6번 연속 탭하세요"
- 순서 애니메이션: 6번 탭 → Wi-Fi 연결 → QR 스캔
- QR 유효 시간 카운트다운 (1시간)
- "QR이 만료됐어요" → 재발급 버튼
- 기기 연결 감지: 5초마다 GET /api/devices/{id}/status 폴링 → ACTIVE 되면 STEP 4

STEP 4 - 완료:
- 제목: "공신폰 설정 완료! 🎉"
- 아이 이름, 기기 모델 표시
- "대시보드로 이동" 버튼

공통:
- 상단 진행 바 (1/4, 2/4, 3/4, 4/4)
- 뒤로 가기 버튼 (STEP 1~2만)
- 아이 이름 입력: STEP 1 이전에 모달로 받기
- 모바일 최적화
```

---

## Phase 1: 포트원 결제 연동

### 프롬프트 1-11: 포트원 v2 정기결제

```
공신폰 SaaS 포트원 v2 정기결제를 구현해줘.

환경변수: PORTONE_API_KEY, PORTONE_API_SECRET, PORTONE_STORE_ID

파일: src/lib/billing.ts
구현할 함수:
1. issueAndCharge(billingKey: string, amount: number, orderName: string): Promise<PaymentResult>
   - 포트원 v2 REST API로 빌링키 결제
   - POST https://api.portone.io/payments/{paymentId}/billing-key-payment

2. retryCharge(subscriptionId: string): Promise<void>
   - failCount 확인 후 재시도
   - 3회 실패 시 handlePaymentFailed 호출

3. handlePaymentFailed(userId: string): Promise<void>
   - 해당 유저의 ACTIVE 기기 모두 expired 정책으로 전환
   - DB Device.status → EXPIRED
   - DB Subscription.status → PAST_DUE or CANCELLED

파일: src/app/api/billing/subscribe/route.ts
POST 핸들러:
- Body: { billingKey: string; plan: 'BASIC' | 'PRO' }
- 첫 결제 즉시 실행 (issueAndCharge)
- 성공 시 DB Subscription 생성 (currentPeriodEnd = 30일 후)
- 실패 시 400 + 오류 메시지

파일: src/app/api/billing/webhook/route.ts
POST 핸들러 (포트원 웹훅):
- 웹훅 시그니처 검증
- Payment.Paid: Subscription 갱신 + 만료 기기 study 정책 복원
- Payment.Failed: failCount++ → 3회 시 handlePaymentFailed

파일: src/app/api/billing/charge/route.ts
POST 핸들러 (월 정기결제 cron - 매월 1일):
- ACTIVE 구독 전체 조회
- currentPeriodEnd 지난 구독만 issueAndCharge 호출
- 결과 로깅

파일: src/app/dashboard/billing/page.tsx
구독 관리 UI:
- 현재 플랜 + 가격
- 다음 결제일
- 결제 수단 마지막 4자리
- 해지 버튼 (확인 모달 + 30일 유예 안내)
- 결제 실패 시 경고 배너 + 카드 재등록 버튼
```

---

## Phase 1: 스케줄 Cron

### 프롬프트 1-12: 시간표 자동 정책 교체

```
공신폰 SaaS 시간표 cron을 구현해줘.

파일: src/app/api/schedule/apply/route.ts

POST 핸들러 (Vercel Cron이 15분마다 호출):
1. Authorization 헤더 확인 (Vercel Cron 검증: CRON_SECRET 환경변수)
2. 현재 KST 시각 계산 (UTC+9)
3. DB에서 ACTIVE 상태 기기 + 구독이 ACTIVE인 것만 조회:
   prisma.device.findMany({ where: { status: 'ACTIVE' }, include: { schedule: true, user: { include: { subscription: true } } } })
4. 각 기기별:
   a. subscription.status !== 'ACTIVE' → skip
   b. checkSchedule(schedule.weekdays, now) → boolean (현재 공부시간 여부)
   c. 현재 적용 정책(amapiPolicyName)이 이미 올바른 상태면 skip
   d. patchDevicePolicy() 호출
   e. DB Device.amapiPolicyName 업데이트
5. 응답: { applied: number; skipped: number; errors: number }
6. 오류는 각 기기별로 독립적으로 처리 (하나 실패해도 나머지 계속)

파일: src/lib/schedule-utils.ts
checkSchedule(weekdays: Json, now: Date): boolean 함수:
- now의 요일(0-6)과 시각을 weekdays 구조와 비교
- [{start: "14:00", end: "22:00"}] 형식 파싱
- 현재 시각이 공부시간 범위 내이면 true

vercel.json:
{
  "crons": [
    { "path": "/api/schedule/apply", "schedule": "*/15 * * * *" },
    { "path": "/api/billing/charge", "schedule": "0 0 1 * *" }
  ]
}
```

---

## Phase 1: Pub/Sub 웹훅

### 프롬프트 1-13: AMAPI Pub/Sub 이벤트 처리

```
공신폰 SaaS AMAPI Pub/Sub 웹훅을 구현해줘.

파일: src/app/api/devices/webhook/route.ts

POST 핸들러:
AMAPI가 Google Cloud Pub/Sub으로 기기 이벤트를 push할 때 수신

Pub/Sub push 형식:
{
  "message": {
    "data": "<base64 encoded JSON>",
    "messageId": "...",
    "publishTime": "..."
  },
  "subscription": "..."
}

디코딩 후 AMAPI 이벤트 구조:
{
  "type": "ENROLLMENT_COMPLETE" | "STATUS_REPORT" | "COMMAND_DONE" | ...,
  "enterpriseName": "enterprises/...",
  "device": { ... }
}

처리 로직:
1. ENROLLMENT_COMPLETE:
   - device.name으로 DB Device 조회 (enrollmentToken 매칭 or enterpriseName으로)
   - status → ACTIVE
   - amapiDeviceId 저장
   - enrollmentToken → null
   
2. STATUS_REPORT:
   - device.name으로 DB Device 조회
   - hardwareInfo.model, softwareInfo.androidVersion 저장
   - memoryInfo (batteryLevel 계산)
   - lastSeen → now()

3. 나머지 이벤트: 로깅만

응답: 200 OK (Pub/Sub은 2xx가 아니면 재전송)

파일: src/lib/pubsub.ts
- Google Cloud Pub/Sub 구독 설정 확인 함수 (PoC용)
- push 엔드포인트 등록 함수
```

---

## Phase 2: 위치 추적 기능

### 프롬프트 2-1: 위치 추적 (위치정보법 신고 후 구현)

```
공신폰 SaaS 위치 추적 기능을 구현해줘. (Phase 2 - 위치기반서비스 신고 완료 후 사용)

주의: 위치기반서비스 신고 완료 전에는 이 기능을 서비스에 노출하지 말 것.

파일: src/lib/location.ts

AMAPI를 통한 위치 조회:
- AMAPI devices.issueCommand() 사용
- commandType: "GET_DEVICE_STATE" (위치 포함)
- 또는 정책에 reportingPolicies.applicationReportingSettings 설정

구현:
1. getDeviceLocation(amapiDeviceId: string): Promise<{lat, lng, accuracy, timestamp}>
   - AMAPI Command 발행
   - Pub/Sub으로 결과 수신 대기 (최대 30초)
   - 결과 DB 저장

파일: prisma/schema.prisma 추가:
model LocationLog {
  id        String   @id @default(cuid())
  deviceId  String
  device    Device   @relation(...)
  lat       Float
  lng       Float
  accuracy  Float?
  timestamp DateTime
  createdAt DateTime @default(now())
}

파일: src/app/dashboard/location/page.tsx
- 지도 (카카오맵 또는 네이버 지도 API 사용)
- 마지막 위치 + 시간 표시
- "지금 위치 확인" 버튼 (즉시 조회)
- 오늘 이동 경로 (시간순 점 연결)

법적 고지: 
- 아이에게 위치 추적 사실 고지 여부 설정
- 이용약관/개인정보처리방침에 위치정보 수집 조항 필수
```

---

## 공통: 에러 처리 + 로깅

### 프롬프트 공통-1: 에러 처리 미들웨어

```
공신폰 SaaS의 공통 에러 처리와 로깅을 구현해줘.

파일: src/lib/api-response.ts
- success(data, status=200): NextResponse
- error(message, status=400, details?): NextResponse
- unauthorized(): NextResponse (401)
- forbidden(): NextResponse (403)

파일: src/lib/logger.ts
- 구조화 로깅 (JSON 형식)
- 레벨: info, warn, error
- 자동으로 timestamp, 환경(production/development) 포함
- Vercel 환경에서는 console.log가 자동으로 수집됨

에러 클래스:
class AmapiError extends Error { statusCode: number }
class BillingError extends Error { statusCode: number }

모든 API 라우트에서 try-catch로 감싸고 AmapiError/BillingError는 적절한 HTTP 상태로 변환.
AMAPI 429 (할당량 초과) → 503 + Retry-After 헤더.
```

---

*최종 수정: 2026-06-14*  
*참고: IMPLEMENTATION_PLAN.md와 함께 사용*
