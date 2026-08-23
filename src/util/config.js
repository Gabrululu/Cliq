const fs = require('bare-fs')
const { dataDir, configFile } = require('./paths.js')

function exists () {
  return fs.existsSync(configFile())
}

function load () {
  if (!exists()) return null
  return JSON.parse(fs.readFileSync(configFile(), 'utf8'))
}

function save (config) {
  if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true })
  fs.writeFileSync(configFile(), JSON.stringify(config, null, 2))
}

module.exports = { exists, load, save }
