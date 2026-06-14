import * as fs from 'fs'
import * as path from 'path'
import * as QRCode from 'qrcode'
import {
  createAndroidManagementClient,
  deleteAllEnrollmentTokens,
  loadEnterpriseFromEnv,
} from './amapi-utils'

const ENTERPRISE_NAME = process.env.AMAPI_ENTERPRISE_NAME || loadEnterpriseFromEnv()

async function main() {
  console.log('=== 공신폰 QR 등록 토큰 발급 ===\n')
  console.log(`엔터프라이즈: ${ENTERPRISE_NAME}`)
  console.log(`적용 정책: study (키오스크 모드)\n`)

  const androidmanagement = await createAndroidManagementClient()

  // 기존 토큰 모두 삭제 (슬롯 소진 방지)
  const deletedTokenCount = await deleteAllEnrollmentTokens(androidmanagement, ENTERPRISE_NAME)
  if (deletedTokenCount > 0) {
    console.log(`기존 토큰 ${deletedTokenCount}개 삭제 완료\n`)
    console.log('✅ 기존 토큰 정리 완료\n')
  }

  // 새 등록 토큰 발급 (1시간 유효)
  const tokenRes = await androidmanagement.enterprises.enrollmentTokens.create({
    parent: ENTERPRISE_NAME,
    requestBody: {
      policyName: `${ENTERPRISE_NAME}/policies/study`,
      duration: '3600s',
      allowPersonalUsage: 'PERSONAL_USAGE_DISALLOWED',
    },
  })

  const qrContent = tokenRes.data.qrCode!   // QR에 넣어야 하는 JSON
  const expiry = tokenRes.data.expirationTimestamp!

  console.log(`✅ 토큰 발급 완료`)
  console.log(`만료 시각: ${new Date(expiry).toLocaleString('ko-KR')}\n`)

  // QR 이미지 파일로 저장 (고해상도)
  const qrPngPath = path.join(__dirname, '..', 'poc-qr.png')
  await QRCode.toFile(qrPngPath, qrContent, {
    width: 400,
    margin: 4,
    errorCorrectionLevel: 'M',
  })
  console.log(`✅ QR 이미지 저장됨: ${qrPngPath}`)

  // 브라우저 전체화면용 HTML 생성
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: 300,
    margin: 4,
    errorCorrectionLevel: 'M',
  })
  const htmlPath = path.join(__dirname, '..', 'poc-qr.html')
  const expiryStr = new Date(expiry).toLocaleTimeString('ko-KR')
  fs.writeFileSync(htmlPath, `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>공신폰 PoC QR</title>
<style>
  body { background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; }
  img { width:300px; height:300px; background:#fff; padding:20px; border-radius:12px; }
  p { color:#fff; font-size:18px; margin-top:20px; font-family:sans-serif; }
</style>
</head>
<body>
  <img src="${qrDataUrl}" />
  <p>⏰ 유효시간: ${expiryStr}까지 &nbsp;|&nbsp; 갤럭시 초기화 → 6번 탭 → Wi-Fi → 스캔</p>
</body>
</html>`)

  // 브라우저로 열기 (macOS)
  const { execSync } = require('child_process')
  try {
    execSync(`open "${htmlPath}"`)
    console.log('   → 브라우저 전체화면(F11)으로 QR을 크게 띄우세요\n')
  } catch {
    console.log(`   → 직접 파일을 여세요: ${htmlPath}\n`)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📱 갤럭시 폰에서 다음 순서로 진행하세요')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  1) 갤럭시 폰 공장 초기화')
  console.log('     설정 → 일반 관리 → 초기화 → 공장 초기화')
  console.log('')
  console.log('  2) 초기화 후 환영 화면에서')
  console.log('     빈 화면을 빠르게 6번 연속 탭')
  console.log('')
  console.log('  3) Wi-Fi 연결')
  console.log('')
  console.log('  4) QR 코드 스캔 (poc-qr.png)')
  console.log('')
  console.log('  5) 설치 완료 후 키오스크 화면 확인')
  console.log('     → 전화·문자만 보이면 성공! ✅')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  QR 스캔 후 완료될 때까지 절대 Back 키 누르지 마세요!')
  console.log('   Back 키 = 미완료 기록 생성 = 등록 한도 소진')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`\n⏰ QR 유효시간: 1시간 (${new Date(expiry).toLocaleTimeString('ko-KR')}까지)\n`)
}

main().catch((err) => {
  console.error('\n❌ 오류 발생:', err.message)
  process.exit(1)
})
