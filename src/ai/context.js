const { formatUnits } = require('../util/units.js')
const invoiceStore = require('../invoices/store.js')
const ledgerStore = require('../ledger/store.js')

function summarizeInvoices () {
  const invoices = Object.values(invoiceStore.loadAll())
  const byStatus = { pending: 0, submitted: 0, failed: 0 }
  for (const invoice of invoices) {
    if (byStatus[invoice.status] !== undefined) byStatus[invoice.status]++
  }

  const lines = [`Facturas: ${invoices.length} en total (pendientes: ${byStatus.pending}, pagadas: ${byStatus.submitted}, fallidas: ${byStatus.failed})`]

  for (const invoice of invoices) {
    const amount = `${formatUnits(BigInt(invoice.amount), invoice.decimals)} ${invoice.currency}`
    const memo = invoice.memo ? ` memo="${invoice.memo}"` : ''
    lines.push(`- ${invoice.id}: ${amount}, estado=${invoice.status}${memo}, creada=${invoice.createdAt}`)
  }

  return lines.join('\n')
}

function summarizeLedger () {
  const events = ledgerStore.loadAll()

  if (events.length === 0) {
    return 'Libro mayor: sin eventos todavia.'
  }

  const lines = [`Libro mayor: ${events.length} eventos firmados`]
  for (const event of events) {
    if (event.type !== 'invoice_paid') continue
    const amount = `${formatUnits(BigInt(event.amount), event.decimals ?? 6)} ${event.currency}`
    lines.push(`- ${event.id}: pago de ${amount} para la factura ${event.invoiceId}, tx=${event.txHash}, fecha=${event.createdAt}, comercio=${event.merchant.slice(0, 12)}...`)
  }

  return lines.join('\n')
}

function buildContext () {
  return [
    'Datos del comercio (CLIQ), extraidos del almacen local:',
    '',
    summarizeInvoices(),
    '',
    summarizeLedger()
  ].join('\n')
}

module.exports = { buildContext, summarizeInvoices, summarizeLedger }
