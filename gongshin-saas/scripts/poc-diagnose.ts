import {
  createAndroidManagementClient,
  KEY_FILE,
  listAllDevices,
  listAllEnrollmentTokens,
  loadEnterpriseFromEnv,
} from './amapi-utils'

const ENTERPRISE_NAME = process.env.AMAPI_ENTERPRISE_NAME || loadEnterpriseFromEnv()

async function main() {
  console.log('=== 공신폰 PoC AMAPI 진단 ===\n')
  console.log(`서비스 계정 키: ${KEY_FILE}`)
  console.log(`엔터프라이즈: ${ENTERPRISE_NAME}\n`)

  const androidmanagement = await createAndroidManagementClient()

  await checkPolicies(androidmanagement)

  const tokens = await listAllEnrollmentTokens(androidmanagement, ENTERPRISE_NAME)
  console.log(`\n등록 토큰: ${tokens.length}개`)
  for (const token of tokens) {
    console.log(`  - ${token.name}`)
    console.log(`    정책: ${token.policyName || '미확인'}`)
    console.log(`    만료: ${token.expirationTimestamp || '미확인'}`)
    console.log(`    개인 사용: ${token.allowPersonalUsage || '미확인'}`)
  }

  const devices = await listAllDevices(androidmanagement, ENTERPRISE_NAME)
  console.log(`\n등록된 기기: ${devices.length}개`)
  for (const device of devices) {
    console.log(`  - ${device.name}`)
    console.log(`    상태: ${device.state || '미확인'}`)
    console.log(`    모델: ${device.hardwareInfo?.model || '미확인'}`)
    console.log(`    등록 시각: ${device.enrollmentTime || '미확인'}`)
    console.log(`    정책: ${device.policyName || '미확인'}`)
  }

  console.log('\n판단:')
  if (devices.length > 0) {
    console.log('  등록된 기기가 남아 있습니다. 테스트 재등록 전 npm run poc:cleanup을 실행하세요.')
  } else if (tokens.length > 1) {
    console.log('  등록 토큰이 여러 개 남아 있습니다. npm run poc:cleanup 후 npm run poc:enroll로 새 QR을 발급하세요.')
  } else {
    console.log('  AMAPI상 등록된 기기는 없습니다. 폰에서 계속 한도 오류가 나면 새 QR 발급 또는 엔터프라이즈 재생성이 필요합니다.')
  }
}

async function checkPolicies(androidmanagement: any) {
  const policyIds = ['study', 'free', 'expired']
  console.log('정책:')

  for (const policyId of policyIds) {
    const name = `${ENTERPRISE_NAME}/policies/${policyId}`
    try {
      const res = await androidmanagement.enterprises.policies.get({ name })
      console.log(`  - ${name}: OK (${res.data.applications?.length || 0} apps)`)
    } catch (err: any) {
      console.log(`  - ${name}: 오류 (${err.message})`)
    }
  }
}

main().catch((err) => {
  console.error('오류:', err.message)
  process.exit(1)
})
