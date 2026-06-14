# 공신폰 SaaS — 삼성 갤럭시 상세 구현 계획

> BYOD · Android Management API + Knox · Next.js SaaS · 월 구독 모델  
> 보유 갤럭시를 QR 스캔 한 번으로 공신폰으로 전환하는 소프트웨어 라이선스 사업

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 및 환경](#2-기술-스택-및-환경)
3. [Phase 0 — PoC (1~2주)](#3-phase-0--poc-12주)
4. [Phase 1 — MVP (3~6주)](#4-phase-1--mvp-36주)
5. [Phase 2 — 성장 (2~4개월)](#5-phase-2--성장-24개월)
6. [Phase 3 — 레버리지 (6개월~)](#6-phase-3--레버리지-6개월)
7. [데이터베이스 스키마](#7-데이터베이스-스키마)
8. [API 설계](#8-api-설계)
9. [AMAPI 정책 3벌 설계](#9-amapi-정책-3벌-설계)
10. [결제 흐름 (포트원 v2)](#10-결제-흐름-포트원-v2)
11. [비용·수익 구조](#11-비용수익-구조)
12. [운영 SOP](#12-운영-sop)

---

## 1. 프로젝트 개요

### 핵심 명제
공신폰의 본질은 하드웨어가 아니라 **"차단이 살아있는 상태"** 입니다.  
그 상태를 OS가 보증하는 수준으로 유지하고, 부모가 원격으로 관리하게 하는 것이 상품입니다.

### 1차 출시 스코프

| 항목 | 1차 포함 | 제외(추후) |
|---|---|---|
| 차단 엔진 | AMAPI Fully Managed + Knox KPE | — |
| 등록 방식 | QR 셀프 프로비저닝 | Zero-Touch 대량 (Phase 2) |
| 차단 범위 | 앱 화이트리스트·인터넷·ADB·개발자옵션·설정초기화 | — |
| 허용 항목 | 전화·문자·카카오톡(부모만)·사전·캘린더·시계 | 앱별 시간제한 (Phase 2) |
| 위치 추적 | **제외** | Phase 2 (위치정보법 신고 후) |
| 부모 콘솔 | 앱 허용토글·스케줄·기기상태·구독관리 | — |
| 플랫폼 | 삼성 갤럭시 (Android 11+) | iOS·타브랜드 (Phase 3) |
| 수익 모델 | 월 구독 + BYOD 전환 서비스비 | B2B 다량 납품 (Phase 2) |

---

## 2. 기술 스택 및 환경

### 레이어별 기술

| 레이어 | 기술 |
|---|---|
| 단말 | Samsung Galaxy (Android 11+), Android Device Policy, Knox KPE (무료) |
| MDM API | Android Management API v1, Knox Service Plugin, Google Pub/Sub |
| 백엔드 | Next.js 15 (App Router), TypeScript, Prisma ORM |
| 데이터베이스 | PostgreSQL (Supabase) |
| 인증 | NextAuth.js (카카오·구글 OAuth) |
| 결제 | 포트원 v2 (정기결제 빌링키) |
| 스케줄 | Vercel Cron (15분 단위), pg_cron |
| 인프라 | Google Cloud (AMAPI), Vercel (프론트·API), Supabase (DB) |
| 도메인·이메일 | Cloudflare, Resend |

### 초기 환경 세팅 체크리스트

```bash
# 1. Google Cloud 프로젝트 생성
gcloud projects create gongshin-prod
gcloud services enable androidmanagement.googleapis.com

# 2. 서비스 계정 생성 + 키 발급
gcloud iam service-accounts create amapi-sa --project=gongshin-prod
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=amapi-sa@gongshin-prod.iam.gserviceaccount.com

# 3. Pub/Sub 토픽 생성 (AMAPI 이벤트 수신)
gcloud pubsub topics create amapi-events --project=gongshin-prod
gcloud pubsub subscriptions create amapi-sub \
  --topic=amapi-events --project=gongshin-prod

# 4. Next.js 프로젝트 초기화
npx create-next-app@latest gongshin-saas \
  --typescript --tailwind --app --src-dir

# 5. 패키지 설치
npm install @prisma/client prisma googleapis next-auth
npm install @portone/browser-sdk  # 포트원 v2
npm install qrcode sharp           # QR 생성
npm install @vercel/cron           # cron
```

---

## 3. Phase 0 — PoC (1~2주)

**목표: 본인 갤럭시 1대로 전체 파이프라인 검증**

### 태스크 목록

- [ ] Google Cloud 프로젝트 생성 (gongshin-prod)
- [ ] Android Management API 활성화
- [ ] 서비스 계정 생성 + JSON 키 발급
- [ ] Knox Admin Portal 가입 + KPE Premium 라이선스 발급 (무료)
- [ ] 공장초기화할 갤럭시 단말 준비 (본인 구형 폰)
- [ ] Node.js 스크립트로 엔터프라이즈 생성 + study 정책 1개
- [ ] 등록 토큰 발급 + QR 이미지 생성
- [ ] 갤럭시 초기화 → 6번 탭 → QR 스캔 → 키오스크 확인
- [ ] 정책 PATCH로 앱 추가/제거 실시간 반영 확인
- [ ] Knox 워런티 비트 정상 확인 (`*#0*#`)

### PoC 검증 스크립트 구조

```
scripts/
├── poc-setup.ts          # 엔터프라이즈 생성 + 정책 3벌 등록
├── poc-enroll.ts         # 등록 토큰 발급 + QR 출력
├── poc-patch-policy.ts   # 정책 PATCH 테스트
└── poc-check-device.ts   # 기기 상태 조회
```

### PoC 성공 기준

1. QR 스캔 후 키오스크 모드 진입 확인
2. 허용된 앱(전화·문자)만 보임
3. 정책 PATCH → 30초~2분 내 단말에 반영
4. ADB 연결 불가 확인
5. 설정 초기화 메뉴 차단 확인

---

## 4. Phase 1 — MVP (3~6주)

**목표: 결제 연동 + 부모 콘솔 기본 완성 + 베타 오픈**

### 주차별 계획

#### Week 1-2: 기반 세팅
- [ ] Next.js 15 + TypeScript + Tailwind + Prisma 프로젝트 세팅
- [ ] Supabase PostgreSQL 연결
- [ ] Prisma 스키마 작성 (User, Device, Subscription, Schedule)
- [ ] NextAuth.js 카카오 로그인 연동
- [ ] Google OAuth 로그인 연동
- [ ] 환경변수 관리 (.env.local, Vercel 환경변수)

#### Week 2-3: AMAPI 연동
- [ ] `lib/amapi.ts` — Google API 클라이언트 초기화
- [ ] 회원가입 시 엔터프라이즈 자동 생성
- [ ] 정책 3벌 자동 등록 (study / free / expired)
- [ ] `POST /api/devices/enroll` — 등록 토큰 발급 + QR 생성
- [ ] `POST /api/devices/webhook` — Pub/Sub 이벤트 수신 처리
- [ ] `PATCH /api/devices/[id]/policy` — 정책 즉시 변경

#### Week 3-4: 부모 콘솔 UI
- [ ] `/dashboard` — 기기 현황 페이지 (상태·모드·배터리)
- [ ] `/dashboard/apps` — 앱 허용 토글 페이지
- [ ] `/dashboard/schedule` — 요일별 시간표 설정
- [ ] `/enroll` — QR 등록 4단계 온보딩 페이지
- [ ] 모바일 반응형 UI (부모가 핸드폰으로 사용)

#### Week 4-5: 결제 연동
- [ ] `POST /api/billing/subscribe` — 포트원 v2 빌링키 등록
- [ ] `POST /api/billing/charge` — 월 정기결제 실행
- [ ] `POST /api/billing/webhook` — 결제 성공/실패 이벤트
- [ ] `POST /api/billing/cancel` — 해지 처리 + 30일 유예
- [ ] 결제 실패 → 만료 정책 자동 적용

#### Week 5-6: 스케줄 + 배포
- [ ] `POST /api/schedule/apply` — 시간표 정책 자동 교체 API
- [ ] `vercel.json` cron 설정 (15분 단위)
- [ ] Vercel 배포 + 커스텀 도메인
- [ ] 지인 베타 3~5명 (갤럭시 소지자 우선)
- [ ] 베타 피드백 반영

### 부모 콘솔 4개 화면

| 화면 | 경로 | 핵심 기능 |
|---|---|---|
| 기기 현황 | `/dashboard` | 아이 이름·폰 모델·배터리·현재 모드·즉시 전환 버튼 |
| 앱 관리 | `/dashboard/apps` | 허용 앱 토글·카카오 ON/OFF·30초 내 반영 |
| 시간표 설정 | `/dashboard/schedule` | 요일별 공부시간·자유시간 범위 설정 |
| 구독 관리 | `/dashboard/billing` | 플랜·결제수단·다음 결제일·해지 플로우 |

### QR 등록 4단계 온보딩

| 단계 | 내용 | 소요시간 |
|---|---|---|
| STEP 1 | 백업 안내 (Smart Switch / Google 백업) | 5~10분 |
| STEP 2 | 초기화 안내 (설정 > 일반 > 초기화 경로 스크린샷) | 3~5분 |
| STEP 3 | QR 스캔 (환영화면 6번 탭 → Wi-Fi → QR 스캔 애니메이션) | 2~3분 |
| STEP 4 | 완료 (기기 연결 확인, 공신폰 활성화) | 자동 |

---

## 5. Phase 2 — 성장 (2~4개월)

**목표: CS 자동화 + 수익 확장 + 구독자 100명**

### 태스크 목록

- [ ] 온보딩 셀프 완료율 70%+ 달성 (카카오 CS 의존 탈피)
- [ ] 위치추적 기능 — 위치기반서비스 신고 후 추가
- [ ] 앱별 시간 제한 (공부시간 외 유튜브 30분 등)
- [ ] 네이버 블로그·맘카페 SEO 콘텐츠 제작
- [ ] 학원·기숙학원 B2B 납품 준비
- [ ] Knox Mobile Enrollment (KME) 연동 준비
- [ ] 구독자 100명 → 월 구독 매출 39만원+

---

## 6. Phase 3 — 레버리지 (6개월~)

**목표: B2B + iOS + 완전 자동화**

### 태스크 목록

- [ ] 학원 체인·기숙학원 다량 계약 (기기당 월 단가)
- [ ] iOS Apple Configurator 2 / Supervised Mode 지원
- [ ] 자동 IMEI 체크 + 단말 등급 판정 API
- [ ] 구독 1,000명 → 월 구독 매출 390만원+ 돌파

---

## 7. 데이터베이스 스키마

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  phone        String?
  kakaoId      String?       @unique
  googleId     String?       @unique
  enterpriseId String?       // AMAPI enterprises/{id}
  devices      Device[]
  subscription Subscription?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Device {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  amapiDeviceId   String?      // enterprises/{n}/devices/{id}
  amapiPolicyName String?      // enterprises/{n}/policies/{name}
  enrollmentToken String?      // QR 생성용 (만료 후 null)
  status          DeviceStatus @default(PENDING)
  kidsName        String?
  model           String?      // 갤럭시 모델명 (자동 감지)
  androidVersion  String?
  batteryLevel    Int?
  lastSeen        DateTime?
  schedule        Schedule?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

enum DeviceStatus {
  PENDING   // 등록 대기 (QR 발급됨)
  ACTIVE    // 정상 운영 중
  EXPIRED   // 구독 만료
  LOCKED    // 긴급 잠금
}

model Subscription {
  id               String    @id @default(cuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id])
  billingKey       String    // 포트원 빌링키
  plan             PlanType
  status           SubStatus @default(ACTIVE)
  currentPeriodEnd DateTime
  failCount        Int       @default(0)
  cancelledAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

enum PlanType {
  BASIC  // 3,900원/월 - 기기 1대
  PRO    // 5,900원/월 - 기기 3대
}

enum SubStatus {
  ACTIVE
  PAST_DUE    // 결제 실패 (재시도 중)
  CANCELLED   // 해지 (30일 유예)
}

model Schedule {
  id         String  @id @default(cuid())
  deviceId   String  @unique
  device     Device  @relation(fields: [deviceId], references: [id])
  // 0-6: 일~토, 값: [{start:"09:00", end:"22:00"}]
  weekdays   Json
  studyApps  String[]  // 공부시간에만 추가 허용할 앱 패키지명
  freeApps   String[]  // 자유시간에 허용할 앱 패키지명
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

## 8. API 설계

```
app/
├── api/
│   ├── auth/
│   │   └── [...nextauth]/route.ts   # NextAuth 핸들러
│   ├── devices/
│   │   ├── enroll/route.ts          # POST: 등록 토큰 발급 + QR 생성
│   │   ├── [id]/
│   │   │   ├── policy/route.ts      # PATCH: 정책 즉시 변경 (앱 토글)
│   │   │   ├── lock/route.ts        # POST: 긴급 잠금
│   │   │   └── status/route.ts      # GET: 기기 상태 조회
│   │   └── webhook/route.ts         # POST: AMAPI Pub/Sub 이벤트
│   ├── schedule/
│   │   ├── apply/route.ts           # POST: cron이 호출 (15분 단위)
│   │   └── [deviceId]/route.ts      # PUT: 시간표 저장
│   └── billing/
│       ├── subscribe/route.ts       # POST: 빌링키 등록 + 첫 결제
│       ├── charge/route.ts          # POST: 월 정기결제 cron
│       ├── webhook/route.ts         # POST: 포트원 이벤트 수신
│       └── cancel/route.ts          # POST: 해지 처리
├── dashboard/
│   ├── page.tsx                     # 기기 현황
│   ├── apps/page.tsx                # 앱 관리
│   ├── schedule/page.tsx            # 시간표 설정
│   └── billing/page.tsx             # 구독 관리
└── enroll/
    └── page.tsx                     # QR 등록 4단계 온보딩
```

### 핵심 API 엔드포인트 스펙

#### POST /api/devices/enroll
```typescript
// Request
{ deviceNickname: string; kidsName: string }

// Response
{ 
  deviceId: string;
  qrCode: string;      // base64 QR 이미지
  enrollmentToken: string;  // 1시간 유효
  expiresAt: string;
}
```

#### PATCH /api/devices/[id]/policy
```typescript
// Request
{ allowedApps: string[] }  // 패키지명 배열

// Response
{ ok: boolean; appliedAt: string }
```

#### POST /api/billing/subscribe
```typescript
// Request
{ billingKey: string; plan: 'BASIC' | 'PRO' }

// Response
{ subscriptionId: string; nextBillingDate: string }
```

---

## 9. AMAPI 정책 3벌 설계

### 정책 교체 규칙

```
상태                     정책
─────────────────────────────────────
기본 상태 (공부 시간)   → study
시간표 자유 시간        → free
구독 만료/결제 실패     → expired
갱신 완료               → study 복원
긴급 잠금               → expired (즉시)
```

### 공부 모드 (study) — 핵심 설정

```json
{
  "developerSettings": "DEVELOPER_SETTINGS_DISABLED",
  "safeBootDisabled": true,
  "factoryResetDisabled": true,
  "networkResetDisabled": true,
  "modifyAccountsDisabled": true,
  "screenCaptureDisabled": true,
  "untrustedAppsPolicy": {
    "untrustedAppInstallSources": "DISALLOW_INSTALL"
  },
  "kioskCustomLauncherEnabled": true,
  "kioskCustomization": {
    "statusBar": "NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED",
    "systemNavigation": "NAVIGATION_DISABLED",
    "deviceSettings": "SETTINGS_ACCESS_BLOCKED",
    "powerButtonActions": "POWER_BUTTON_AVAILABLE"
  }
}
```

### 허용 앱 화이트리스트 (기본)

| 앱 | 패키지명 | 상태 |
|---|---|---|
| 전화 | `com.samsung.android.dialer` | FORCE_INSTALLED |
| 문자 | `com.samsung.android.messaging` | FORCE_INSTALLED |
| 카카오톡 | `com.kakao.talk` | FORCE_INSTALLED (부모 허용 시) |
| 시계/타이머 | `com.sec.android.app.clockpackage` | FORCE_INSTALLED |
| 삼성 브라우저 | `com.sec.android.app.sbrowser` | BLOCKED |
| 크롬 | `com.android.chrome` | BLOCKED |
| 유튜브 | `com.google.android.youtube` | BLOCKED |

### Knox Service Plugin 설정 (하드웨어 강화)

```json
{
  "allow_safe_mode": false,
  "allow_firmware_recovery": false
}
```

---

## 10. 결제 흐름 (포트원 v2)

### 결제 상태 머신

```
빌링키 등록
    ↓
첫 결제 성공 → ACTIVE
    ↓
매월 1일 09:00 정기결제
    ├── 성공 → currentPeriodEnd += 30일
    └── 실패 → PAST_DUE
             ↓
         3일 후 재시도 (최대 3회)
             ├── 성공 → ACTIVE 복귀
             └── 3회 실패 → CANCELLED
                          ↓
                      만료 정책 적용
                      (전화만 가능 + 갱신 화면)
```

### 포트원 웹훅 이벤트 처리

| 이벤트 | 처리 |
|---|---|
| `Payment.Paid` | 구독 갱신 + 만료 단말 study 정책 복원 |
| `Payment.Failed` | failCount++ → 3회 시 만료 정책 적용 |
| `Subscription.Cancelled` | 30일 유예 후 만료 정책 적용 |

---

## 11. 비용·수익 구조

### 월 운영 비용 (구독자 100명 기준)

| 항목 | 서비스 | 월 비용 |
|---|---|---|
| AMAPI | Google Android Management API | **무료** |
| Knox KPE | Samsung Knox Platform for Enterprise | **무료** |
| Pub/Sub | Google Cloud Pub/Sub | ≈ ₩1,000 |
| DB | Supabase (PostgreSQL) | ₩0~25,000 |
| 호스팅 | Vercel Pro | ₩28,000 |
| 결제 수수료 | 포트원 v2 | 결제액 3% |
| 도메인·이메일 | Cloudflare + Resend | ≈ ₩5,000 |
| **합계** | | **≈ ₩60,000** |

### 구독자별 손익 시뮬레이션

| 구독자 수 | 월 매출 | 수수료 | 고정비 | **월 기여이익** |
|---|---|---|---|---|
| 30명 | ₩117,000 | ₩3,500 | ₩60,000 | **₩53,500** |
| 100명 | ₩390,000 | ₩11,700 | ₩65,000 | **₩313,000** |
| 300명 | ₩1,170,000 | ₩35,100 | ₩80,000 | **₩1,054,900** |
| 1,000명 | ₩3,900,000 | ₩117,000 | ₩120,000 | **₩3,663,000** |

> ※ 베이직 ₩3,900 기준. 손익분기점 = **구독자 30명**

### 플랜 구성

| 플랜 | 가격 | 기기 수 | 주요 기능 |
|---|---|---|---|
| 베이직 | ₩3,900/월 | 1대 | 앱 화이트리스트·시간표·기기 상태 |
| 프로 | ₩5,900/월 | 3대 | 베이직 + 앱별 시간 제한·긴급 잠금·우선 CS |
| BYOD 전환 서비스비 | ₩9,900~19,900 (1회) | — | QR 세팅 지원 (구독과 별도) |

---

## 12. 운영 SOP

### BYOD 단말 수락 기준

| 기준 | 수락 | 조건부 | 거절 |
|---|---|---|---|
| 제조사 | 삼성 갤럭시 (국내 정품) | — | 샤오미·중국산 |
| Android 버전 | Android 11 이상 | Android 10 (Knox 있으면) | Android 9 이하 |
| Knox 상태 | WARRANTY_BIT 정상 | — | Knox void (루팅 이력) |
| IMEI | 분실·도난 미등록 | — | IMEI 불량·블랙리스트 |
| 잔여 약정 | 없음 (공기계) | 약정 확인 후 안내 | 타인 명의 약정 잠금 |

### Knox 워런티 비트 확인

```
*#0*# 엔지니어링 메뉴 → Knox 탭 → 워런티 비트 = 0x0 확인
(루팅·커스텀롬 이력 시 Knox 하드웨어 보안 비활성화)
```

### 자동화 목표

| Phase | 운영 방식 | CS 부담 |
|---|---|---|
| Phase 0~1 | 카카오 채널 1:1 수동 안내 | 하루 5~10건 |
| Phase 2 | 4단계 온보딩 셀프 완료율 70%+ | 최소화 |
| Phase 3 | Knox Mobile Enrollment 자동 등록 | 인건비 제로 |

---

## 파일 구조 (최종 목표)

```
gongshin-saas/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── devices/
│   │   │   │   ├── enroll/route.ts
│   │   │   │   ├── [id]/policy/route.ts
│   │   │   │   ├── [id]/lock/route.ts
│   │   │   │   └── webhook/route.ts
│   │   │   ├── schedule/apply/route.ts
│   │   │   └── billing/
│   │   │       ├── subscribe/route.ts
│   │   │       ├── charge/route.ts
│   │   │       ├── webhook/route.ts
│   │   │       └── cancel/route.ts
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── apps/page.tsx
│   │   │   ├── schedule/page.tsx
│   │   │   └── billing/page.tsx
│   │   ├── enroll/page.tsx
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── amapi.ts          # AMAPI 클라이언트 + 정책 빌더
│   │   ├── prisma.ts         # Prisma 클라이언트 싱글턴
│   │   ├── billing.ts        # 포트원 v2 연동
│   │   └── policies/
│   │       ├── study.ts      # 공부 모드 정책 빌더
│   │       ├── free.ts       # 자유 모드 정책 빌더
│   │       └── expired.ts    # 만료 모드 정책 빌더
│   └── components/
│       ├── DeviceCard.tsx
│       ├── AppToggle.tsx
│       ├── ScheduleEditor.tsx
│       └── QREnrollment.tsx
├── scripts/
│   ├── poc-setup.ts          # PoC용 엔터프라이즈 + 정책 생성
│   └── poc-enroll.ts         # PoC용 QR 토큰 발급
├── vercel.json               # cron 설정
└── .env.local.example
```

---

*최종 수정: 2026-06-14*
