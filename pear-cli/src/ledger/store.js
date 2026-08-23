const fs = require('bare-fs')
const { ledgerDir, ledgerFile } = require('../util/paths.js')

function loadAll () {
  if (!fs.existsSync(ledgerFile())) return []
  return JSON.parse(fs.readFileSync(ledgerFile(), 'utf8'))
}

function saveAll (events) {
  if (!fs.existsSync(ledgerDir())) fs.mkdirSync(ledgerDir(), { recursive: true })
  fs.writeFileSync(ledgerFile(), JSON.stringify(events, null, 2))
}

function append (event) {
  const events = loadAll()
  events.push(event)
  saveAll(events)
  return event
}

function get (id) {
  return loadAll().find((event) => event.id === id) || null
}

function last () {
  const events = loadAll()
  return events.length ? events[events.length - 1] : null
}

function lastByMerchant (merchantPublicKey) {
  const events = loadAll()
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].merchant === merchantPublicKey) return events[i]
  }
  return null
}

module.exports = { loadAll, append, get, last, lastByMerchant }
