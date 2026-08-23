const store = require('../ledger/store.js')
const { formatUnits } = require('../util/units.js')

function pad (value, length) {
  return String(value).padEnd(length)
}

async function run () {
  const events = store.loadAll()

  if (events.length === 0) {
    console.log('No hay eventos en el libro mayor todavia. Paga una factura con "merchant pay <id> --yes" para generar el primero.')
    return
  }

  console.log(pad('FECHA', 21) + pad('TIPO', 15) + pad('MONTO', 16) + 'RECIBO')
  for (const event of events) {
    const date = event.createdAt.replace('T', ' ').slice(0, 19)
    const amount = event.amount !== undefined
      ? `${formatUnits(BigInt(event.amount), event.decimals ?? 6)} ${event.currency || ''}`.trim()
      : '-'
    console.log(pad(date, 21) + pad(event.type, 15) + pad(amount, 16) + event.id)
  }
}

module.exports = { run }
