import {
  clearEnterpriseFromEnv,
  createAndroidManagementClient,
  deleteAllEnrollmentTokens,
  listAllDevices,
  loadEnterpriseFromEnv,
} from './amapi-utils'

const ENTERPRISE_NAME = process.env.AMAPI_ENTERPRISE_NAME || loadEnterpriseFromEnv()
const confirmed = process.argv.includes('--yes')

async function main() {
  console.log('=== 공신폰 PoC 엔터프라이즈 삭제 ===\n')
  console.log(`대상 엔터프라이즈: ${ENTERPRISE_NAME}\n`)

  if (!confirmed) {
    console.log('이 작업은 Android Enterprise binding을 삭제합니다.')
    console.log('정말 삭제하려면 다음 명령을 실행하세요:')
    console.log('  npm run poc:delete-enterprise -- --yes')
    return
  }

  const androidmanagement = await createAndroidManagementClient()

  const deletedTokenCount = await deleteAllEnrollmentTokens(androidmanagement, ENTERPRISE_NAME)
  console.log(`등록 토큰 삭제: ${deletedTokenCount}개`)

  const devices = await listAllDevices(androidmanagement, ENTERPRISE_NAME)
  console.log(`등록된 기기 수: ${devices.length}`)
  for (const device of devices) {
    if (!device.name) continue
    await androidmanagement.enterprises.devices.delete({ name: device.name })
    console.log(`기기 삭제: ${device.name}`)
  }

  await androidmanagement.enterprises.delete({ name: ENTERPRISE_NAME })
  console.log(`엔터프라이즈 삭제 요청 완료: ${ENTERPRISE_NAME}`)

  const envChanged = clearEnterpriseFromEnv(ENTERPRISE_NAME)
  console.log(envChanged ? '.env.local에서 AMAPI_ENTERPRISE_NAME 제거 완료' : '.env.local 변경 없음')

  console.log('\n다음 단계:')
  console.log('  1) npm run poc:setup:new')
  console.log('  2) npm run poc:enroll')
}

main().catch((err) => {
  console.error('오류:', err.message)
  process.exit(1)
})
