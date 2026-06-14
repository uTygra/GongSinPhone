import {
  createAndroidManagementClient,
  deleteAllEnrollmentTokens,
  listAllDevices,
  loadEnterpriseFromEnv,
} from './amapi-utils'

const ENTERPRISE_NAME = process.env.AMAPI_ENTERPRISE_NAME || loadEnterpriseFromEnv()

async function main() {
  console.log('=== 공신폰 PoC 등록 슬롯 정리 ===\n')
  console.log(`엔터프라이즈: ${ENTERPRISE_NAME}\n`)

  const androidmanagement = await createAndroidManagementClient()

  const deletedTokenCount = await deleteAllEnrollmentTokens(androidmanagement, ENTERPRISE_NAME)
  console.log(`등록 토큰 삭제: ${deletedTokenCount}개`)

  const devices = await listAllDevices(androidmanagement, ENTERPRISE_NAME)
  console.log(`등록된 기기 수: ${devices.length}`)

  if (devices.length === 0) {
    console.log('\n삭제할 기기가 없습니다. 토큰 정리는 완료됐습니다.')
    return
  }

  for (const device of devices) {
    console.log(`\n기기: ${device.name}`)
    console.log(`  상태: ${device.state}`)
    console.log(`  모델: ${device.hardwareInfo?.model || '미확인'}`)
    console.log(`  등록 시각: ${device.enrollmentTime || '미확인'}`)

    await androidmanagement.enterprises.devices.delete({ name: device.name! })
    console.log('  삭제 완료')
  }

  console.log('\n모든 기기와 등록 토큰을 정리했습니다. 이제 npm run poc:enroll로 새 QR을 발급하세요.')
}

main().catch((err) => {
  console.error('오류:', err.message)
  process.exit(1)
})
