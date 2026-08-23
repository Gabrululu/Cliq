const store = require('../ledger/store.js')
const { verifyEvent } = require('../ledger/events.js')
const { formatUnits } = require('../util/units.js')

const USAGE = 'Uso: merchant receipt <show|verify> <id>'

async function run (args) {
  const [sub, id] = args

  if (sub === 'show') return show(id)
  if (sub === 'verify') return verify(id)

  console.error(USAGE)
  Bare.exit(1)
}

async function show (id) {
  if (!id) {
    console.error('Uso: merchant receipt show <id>')
    Bare.exit(1)
    return
  }

  const event = store.get(id)
  if (!event) {
    console.error(`Recibo no encontrado: ${id}`)
    Bare.exit(1)
    return
  }

  printEvent(event)
}

async function verify (id) {
  if (!id) {
    console.error('Uso: merchant receipt verify <id>')
    Bare.exit(1)
    return
  }

  const event = store.get(id)

  if (!event) {
    console.error(`Recibo no encontrado: ${id}`)
    Bare.exit(1)
    return
  }

  const previous = event.previousEventId ? store.get(event.previousEventId) : null
  const result = verifyEvent(event, previous)

  printEvent(event)
  console.log('')
  console.log('Verificacion:')
  for (const check of result.checks) {
    console.log(`  [${check.ok ? 'OK' : 'FALLO'}] ${check.name}: ${check.detail}`)
  }
  console.log('')
  console.log(result.valid ? 'Recibo valido.' : 'Recibo INVALIDO: el historial local pudo ser alterado.')

  if (!result.valid) Bare.exit(1)
}

function printEvent (event) {
  console.log(`Recibo ID: ${event.id}`)
  console.log(`Tipo: ${event.type}`)
  console.log(`Factura: ${event.invoiceId}`)
  console.log(`Monto: ${formatUnits(BigInt(event.amount), event.decimals ?? 6)} ${event.currency}`)
  console.log(`Red: ${event.chain}`)
  console.log(`Pagador: ${event.payer}`)
  console.log(`Destinatario: ${event.recipient}`)
  console.log(`Transaccion: ${event.txHash}`)
  console.log(`Comercio (identidad P2P): ${event.merchant}`)
  console.log(`Creado: ${event.createdAt}`)
  console.log(`Hash del evento anterior: ${event.previousEventHash || '(genesis)'}`)
}

module.exports = { run }
