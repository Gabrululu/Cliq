const { parseFlags } = require('../util/args.js')
const { formatUnits } = require('../util/units.js')
const wdk = require('../payments/wdk.js')
const store = require('../invoices/store.js')
const ledger = require('../ledger/events.js')

async function run (args) {
  const [invoiceId, ...rest] = args
  const { flags } = parseFlags(rest)

  if (!invoiceId) {
    console.error('Uso: merchant pay <invoice-id> [--from-index 1] [--yes]')
    Bare.exit(1)
    return
  }

  const invoice = store.get(invoiceId)
  if (!invoice) {
    console.error(`Factura no encontrada: ${invoiceId}`)
    Bare.exit(1)
    return
  }

  if (invoice.status === 'submitted') {
    console.log(`Esta factura ya fue pagada. Transaccion: ${invoice.txHash}`)
    return
  }

  if (invoice.status !== 'pending' && invoice.status !== 'failed') {
    console.error(`No se puede pagar una factura en estado "${invoice.status}".`)
    Bare.exit(1)
    return
  }

  const fromIndex = flags['from-index'] ? Number(flags['from-index']) : 1
  const amount = BigInt(invoice.amount)
  const transferArgs = { token: invoice.token, recipient: invoice.recipient, amount }

  let quote
  try {
    quote = await wdk.quoteTransfer(fromIndex, transferArgs)
  } catch (err) {
    console.error(`No se pudo cotizar la transferencia: ${err.message}`)
    Bare.exit(1)
    return
  }

  console.log(`Monto: ${formatUnits(amount, invoice.decimals)} ${invoice.currency}`)
  console.log(`Comision estimada de red: ${formatUnits(quote.fee, 18)} ${wdk.nativeSymbol()}`)

  if (!flags.yes) {
    console.log('')
    console.log('Esto fue solo una cotizacion, no se envio ninguna transaccion.')
    console.log(`Vuelve a ejecutar con --yes para confirmar y enviar el pago: merchant pay ${invoiceId} --from-index ${fromIndex} --yes`)
    return
  }

  let result
  try {
    result = await wdk.transfer(fromIndex, transferArgs)
  } catch (err) {
    store.update(invoiceId, { status: 'failed', error: err.message })
    console.error(`Pago fallido: ${err.message}`)
    Bare.exit(1)
    return
  }

  const payer = await wdk.getAddress(fromIndex)

  const receipt = ledger.createEvent({
    type: 'invoice_paid',
    invoiceId,
    amount: invoice.amount,
    currency: invoice.currency,
    decimals: invoice.decimals,
    chain: wdk.networkLabel(),
    payer,
    recipient: invoice.recipient,
    txHash: result.hash
  })

  store.update(invoiceId, {
    status: 'submitted',
    txHash: result.hash,
    fee: result.fee.toString(),
    payer,
    payerIndex: fromIndex,
    receiptId: receipt.id,
    error: null
  })

  console.log('')
  console.log('Pago enviado')
  console.log(`Transaccion: ${result.hash}`)
  console.log(`Comision pagada: ${formatUnits(result.fee, 18)} ${wdk.nativeSymbol()}`)
  console.log('Estado: submitted (transmitido a la red, aun no se confirmo)')
  console.log(`Recibo: ${receipt.id}`)
}

module.exports = { run }
