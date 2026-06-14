import * as fs from 'fs'
import * as path from 'path'
import { createAndroidManagementClient, KEY_FILE, PROJECT_ID, loadEnterpriseFromEnv } from './amapi-utils'

const forceNewEnterprise = process.argv.includes('--new-enterprise')

const SECURITY_BASE = {
  factoryResetDisabled: true,
  networkResetDisabled: true,
  modifyAccountsDisabled: true,
  screenCaptureDisabled: true,
  adjustVolumeDisabled: true,
  mountPhysicalMediaDisabled: true,
  // Knox KPE로 ADB·세이프모드·사이드로드 차단 (MVP 단계에서 추가)
}

function buildStudyPolicy(enterpriseName: string) {
  return {
    ...SECURITY_BASE,
    kioskCustomLauncherEnabled: true,
    kioskCustomization: {
      statusBar: 'NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED',
      systemNavigation: 'NAVIGATION_DISABLED',
      deviceSettings: 'SETTINGS_ACCESS_BLOCKED',
      powerButtonActions: 'POWER_BUTTON_AVAILABLE',
    },
    applications: [
      { packageName: 'com.samsung.android.dialer',    installType: 'FORCE_INSTALLED' },
      { packageName: 'com.samsung.android.messaging', installType: 'FORCE_INSTALLED' },
      { packageName: 'com.sec.android.app.clockpackage', installType: 'FORCE_INSTALLED' },
      { packageName: 'com.sec.android.app.sbrowser',  installType: 'BLOCKED' },
      { packageName: 'com.android.chrome',            installType: 'BLOCKED' },
      { packageName: 'com.google.android.youtube',    installType: 'BLOCKED' },
    ],
  }
}

function buildFreePolicy(enterpriseName: string) {
  return {
    ...SECURITY_BASE,
    kioskCustomLauncherEnabled: false,
    applications: [
      { packageName: 'com.samsung.android.dialer',    installType: 'FORCE_INSTALLED' },
      { packageName: 'com.samsung.android.messaging', installType: 'FORCE_INSTALLED' },
      { packageName: 'com.kakao.talk',                installType: 'FORCE_INSTALLED' },
    ],
  }
}

function buildExpiredPolicy(enterpriseName: string) {
  return {
    ...SECURITY_BASE,
    // kioskCustomLauncherEnabled 없이 전화만 허용 (PoC용 단순화)
    // 실서비스에서는 갱신 안내 웹앱을 KIOSK 타입으로 별도 등록
    applications: [
      { packageName: 'com.samsung.android.dialer', installType: 'FORCE_INSTALLED' },
    ],
  }
}

function saveEnterpriseNameToEnv(enterpriseName: string) {
  const envPath = path.join(__dirname, '..', '.env.local')
  const line = `AMAPI_ENTERPRISE_NAME=${enterpriseName}\n`

  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf-8')
    if (content.includes('AMAPI_ENTERPRISE_NAME=')) {
      content = content.replace(/AMAPI_ENTERPRISE_NAME=.*/g, `AMAPI_ENTERPRISE_NAME=${enterpriseName}`)
      fs.writeFileSync(envPath, content)
    } else {
      fs.appendFileSync(envPath, line)
    }
  } else {
    fs.writeFileSync(envPath, line)
  }
  console.log(`\n.env.local에 저장됨: AMAPI_ENTERPRISE_NAME=${enterpriseName}`)
}

async function main() {
  console.log('=== 공신폰 PoC 셋업 시작 ===\n')
  console.log(`프로젝트: ${PROJECT_ID}`)
  console.log(`키 파일: ${KEY_FILE}\n`)

  const androidmanagement = await createAndroidManagementClient()

  // 기존 엔터프라이즈가 있으면 새로 만들지 않고 정책만 재등록한다.
  // 우선순위: CLI 인자 > shell env > .env.local 파일
  // (--new-enterprise 플래그가 있을 때만 신규 생성 흐름으로 넘어감)
  let existingEnterprise = ''
  if (!forceNewEnterprise) {
    const existingEnterpriseArg = process.argv.find((arg) => arg.startsWith('enterprises/'))
    existingEnterprise =
      existingEnterpriseArg ||
      process.env.AMAPI_ENTERPRISE_NAME ||
      safeLoadEnterpriseFromEnv()
  }
  if (existingEnterprise) {
    console.log(`기존 엔터프라이즈 사용: ${existingEnterprise}`)
    await registerPolicies(androidmanagement, existingEnterprise)
    saveEnterpriseNameToEnv(existingEnterprise)
    console.log('\n=== 정책 등록 완료 ===')
    return
  }

  // 1. 엔터프라이즈 생성
  console.log('1. 엔터프라이즈 생성 중...')
  const signupUrlRes = await androidmanagement.signupUrls.create({
    projectId: PROJECT_ID,
    callbackUrl: 'https://gongshin.app',
  })

  const signupUrl = signupUrlRes.data.url
  const signupName = signupUrlRes.data.name

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 STEP 1: 아래 URL을 복사해서 브라우저에서 여세요')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`\n${signupUrl}\n`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 STEP 2: 브라우저에서 순서대로 클릭')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  1) 구글 계정 로그인')
  console.log('  2) "Android 전용 가입" → "가입" 클릭')
  console.log('  3) 회사명 입력 (공신폰) → "가입 완료" 클릭')
  console.log('  4) "gongshin.app에 연결할 수 없음" 오류페이지 → ✅ 정상!')
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 STEP 3: 오류페이지 브라우저 주소창에서 URL 복사')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  주소창 URL 예시:')
  console.log('  https://gongshin.app/?enterpriseToken=EAHp-xxxxx\n')
  console.log('👇 위 gongshin.app/... URL을 여기에 붙여넣고 Enter:\n')

  const callbackUrl = await readLine()

  if (!callbackUrl.includes('gongshin.app') || !callbackUrl.includes('enterpriseToken')) {
    throw new Error(
      `잘못된 URL입니다.\n` +
      `  입력된 값: ${callbackUrl}\n` +
      `  필요한 값: https://gongshin.app/?enterpriseToken=... 형식`
    )
  }

  const enterpriseToken = extractTokenFromUrl(callbackUrl.trim())

  if (!enterpriseToken) {
    throw new Error('URL에서 enterpriseToken을 찾을 수 없습니다. 주소창 URL 전체를 붙여넣었는지 확인하세요.')
  }
  console.log(`\n✅ 토큰 확인됨`)

  // 2. 엔터프라이즈 생성 완료
  const enterpriseRes = await androidmanagement.enterprises.create({
    projectId: PROJECT_ID,
    signupUrlName: signupName!,
    enterpriseToken,
    requestBody: {
      enterpriseDisplayName: 'gongshin-poc',
    },
  })

  const enterpriseName = enterpriseRes.data.name!
  console.log(`\n✅ 엔터프라이즈 생성 완료: ${enterpriseName}\n`)

  // 3. 정책 3벌 등록
  await registerPolicies(androidmanagement, enterpriseName)

  // 4. .env.local 저장
  saveEnterpriseNameToEnv(enterpriseName)

  console.log('\n=== 셋업 완료 ===')
  console.log('다음 단계: npx ts-node --project scripts/tsconfig.json scripts/poc-enroll.ts')
}

async function registerPolicies(androidmanagement: any, enterpriseName: string) {
  const policies = [
    { name: 'study',   body: buildStudyPolicy(enterpriseName) },
    { name: 'free',    body: buildFreePolicy(enterpriseName) },
    { name: 'expired', body: buildExpiredPolicy(enterpriseName) },
  ]
  for (const policy of policies) {
    console.log(`  "${policy.name}" 정책 등록 중...`)
    const policyName = `${enterpriseName}/policies/${policy.name}`
    await androidmanagement.enterprises.policies.patch({
      name: policyName,
      requestBody: { ...policy.body, name: policyName },
    })
    console.log(`   ✅ ${policyName}`)
  }
}

// .env.local에 엔터프라이즈가 있으면 반환하고, 없으면 빈 문자열을 돌려준다.
// (loadEnterpriseFromEnv는 없을 때 throw하므로 setup 흐름에서는 감싸서 사용)
function safeLoadEnterpriseFromEnv(): string {
  try {
    return loadEnterpriseFromEnv()
  } catch {
    return ''
  }
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('> ', (answer: string) => {
      rl.close()
      resolve(answer)
    })
  })
}

function extractTokenFromUrl(url: string): string {
  const match = url.match(/[?&]enterpriseToken=([^&]+)/)
  return match ? match[1] : ''
}

main().catch((err) => {
  console.error('\n❌ 오류 발생:', err.message)
  if (err.message.includes('PERMISSION_DENIED')) {
    console.error('서비스 계정에 권한이 없습니다. AMAPI가 활성화됐는지 확인하세요.')
  }
  process.exit(1)
})
