import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

const ENV_PATH = path.join(__dirname, '..', '.env.local')
const envFile = readEnvFile()

export const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || envFile.GOOGLE_PROJECT_ID || 'gongshin-prod'
export const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || envFile.GOOGLE_SERVICE_ACCOUNT_KEY || path.join(process.env.HOME || '', 'sa-key.json')

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {} as Record<string, string>

  return fs.readFileSync(ENV_PATH, 'utf-8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match) acc[match[1]] = match[2].trim()
      return acc
    }, {} as Record<string, string>)
}

export function loadEnterpriseFromEnv(): string {
  if (!fs.existsSync(ENV_PATH)) throw new Error('.env.local 파일이 없습니다. poc:setup을 먼저 실행하세요.')

  const content = fs.readFileSync(ENV_PATH, 'utf-8')
  const match = content.match(/^AMAPI_ENTERPRISE_NAME=(.+)$/m)
  if (!match) throw new Error('.env.local에 AMAPI_ENTERPRISE_NAME이 없습니다.')

  return match[1].trim()
}

export async function createAndroidManagementClient() {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error(`서비스 계정 키 파일을 찾을 수 없습니다: ${KEY_FILE}`)
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/androidmanagement'],
  })

  return google.androidmanagement({ version: 'v1', auth })
}

export async function listAllDevices(androidmanagement: any, enterpriseName: string) {
  const devices = []
  let pageToken: string | undefined

  do {
    const res = await androidmanagement.enterprises.devices.list({
      parent: enterpriseName,
      pageToken,
      pageSize: 100,
    })
    devices.push(...(res.data.devices || []))
    pageToken = res.data.nextPageToken
  } while (pageToken)

  return devices
}

export async function listAllEnrollmentTokens(androidmanagement: any, enterpriseName: string) {
  const tokens = []
  let pageToken: string | undefined

  do {
    const res = await androidmanagement.enterprises.enrollmentTokens.list({
      parent: enterpriseName,
      pageToken,
      pageSize: 100,
    })
    tokens.push(...(res.data.enrollmentTokens || []))
    pageToken = res.data.nextPageToken
  } while (pageToken)

  return tokens
}

export async function deleteAllEnrollmentTokens(androidmanagement: any, enterpriseName: string) {
  const tokens = await listAllEnrollmentTokens(androidmanagement, enterpriseName)

  for (const token of tokens) {
    if (token.name) {
      await androidmanagement.enterprises.enrollmentTokens.delete({ name: token.name })
    }
  }

  return tokens.length
}

export async function deleteAllDevices(androidmanagement: any, enterpriseName: string) {
  const devices = await listAllDevices(androidmanagement, enterpriseName)

  for (const device of devices) {
    if (device.name) {
      await androidmanagement.enterprises.devices.delete({ name: device.name })
    }
  }

  return devices.length
}

export function clearEnterpriseFromEnv(enterpriseName: string) {
  if (!fs.existsSync(ENV_PATH)) return false

  const content = fs.readFileSync(ENV_PATH, 'utf-8')
  const nextContent = content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== `AMAPI_ENTERPRISE_NAME=${enterpriseName}`)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')

  fs.writeFileSync(ENV_PATH, nextContent.endsWith('\n') || nextContent.length === 0 ? nextContent : `${nextContent}\n`)
  return content !== nextContent
}

export function upsertEnvValues(values: Record<string, string>) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/) : []
  const usedKeys = new Set<string>()
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/)
    if (!match || !(match[1] in values)) return line

    usedKeys.add(match[1])
    return `${match[1]}=${values[match[1]]}`
  })

  for (const [key, value] of Object.entries(values)) {
    if (!usedKeys.has(key)) nextLines.push(`${key}=${value}`)
  }

  const nextContent = nextLines.filter((line, index) => line.trim() !== '' || index < nextLines.length - 1).join('\n')
  fs.writeFileSync(ENV_PATH, nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`)
}
