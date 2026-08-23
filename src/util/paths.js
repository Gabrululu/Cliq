const os = require('bare-os')
const path = require('bare-path')

function dataDir () {
  return path.join(os.cwd(), '.cliq')
}

function configFile () {
  return path.join(dataDir(), 'config.json')
}

function ledgerDir () {
  return path.join(dataDir(), 'ledger')
}

function invoicesFile () {
  return path.join(dataDir(), 'invoices.json')
}

function ledgerFile () {
  return path.join(ledgerDir(), 'events.json')
}

module.exports = { dataDir, configFile, ledgerDir, invoicesFile, ledgerFile }
