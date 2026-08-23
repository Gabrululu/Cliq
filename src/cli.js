const help = require('./commands/help.js')
const version = require('./commands/version.js')
const init = require('./commands/init.js')
const wallet = require('./commands/wallet.js')
const invoice = require('./commands/invoice.js')
const pay = require('./commands/pay.js')
const ledger = require('./commands/ledger.js')
const receipt = require('./commands/receipt.js')
const sync = require('./commands/sync.js')
const peers = require('./commands/peers.js')
const ask = require('./commands/ask.js')
const agent = require('./commands/agent.js')
const gasless = require('./commands/gasless.js')

const commands = {
  help,
  '--help': help,
  '-h': help,
  version,
  '--version': version,
  init,
  wallet,
  invoice,
  pay,
  ledger,
  receipt,
  sync,
  peers,
  ask,
  agent,
  gasless
}

async function run (args) {
  const [command, ...rest] = args

  if (!command) {
    return help.run()
  }

  const handler = commands[command]

  if (!handler) {
    console.error(`Comando desconocido: ${command}`)
    console.error('Ejecuta "merchant help" para ver los comandos disponibles.')
    Bare.exit(1)
    return
  }

  return handler.run(rest)
}

module.exports = { run }
