const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')

function parseDotenv (contents) {
  const result = {}
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function loadEnv () {
  const envFile = path.join(os.cwd(), '.env')
  const fromFile = fs.existsSync(envFile)
    ? parseDotenv(fs.readFileSync(envFile, 'utf8'))
    : {}

  const env = require('bare-env')
  const merged = { ...fromFile }
  for (const key of Object.keys(fromFile)) {
    if (env[key] !== undefined) merged[key] = env[key]
  }
  for (const key in env) {
    if (merged[key] === undefined) merged[key] = env[key]
  }

  return merged
}

module.exports = { loadEnv, parseDotenv }
