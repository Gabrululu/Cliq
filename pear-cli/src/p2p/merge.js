const store = require('../ledger/store.js')
const { verifyEvent } = require('../ledger/events.js')

function mergeRemoteEvents (remoteEvents) {
  const result = { added: 0, skipped: 0, invalid: 0 }

  const sorted = [...remoteEvents].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))

  for (const event of sorted) {
    if (!event || typeof event.id !== 'string') {
      result.invalid++
      continue
    }

    if (store.get(event.id)) {
      result.skipped++
      continue
    }

    const previous = event.previousEventId ? store.get(event.previousEventId) : null

    if (event.previousEventId && !previous) {
      // Todavia no tenemos el evento padre localmente (puede llegar en una
      // proxima ronda de sync). Lo salteamos por ahora en vez de aceptarlo
      // sin poder verificar el encadenamiento.
      result.skipped++
      continue
    }

    const verification = verifyEvent(event, previous)
    if (!verification.valid) {
      result.invalid++
      continue
    }

    store.append(event)
    result.added++
  }

  return result
}

function detectConflicts () {
  const events = store.loadAll()
  const byInvoice = new Map()

  for (const event of events) {
    if (event.type !== 'invoice_paid' || !event.invoiceId) continue
    if (!byInvoice.has(event.invoiceId)) byInvoice.set(event.invoiceId, [])
    byInvoice.get(event.invoiceId).push(event)
  }

  const conflicts = []
  for (const [invoiceId, list] of byInvoice) {
    const distinctTx = new Set(list.map((event) => event.txHash))
    if (distinctTx.size > 1) {
      conflicts.push({
        invoiceId,
        events: list.map((event) => ({ id: event.id, txHash: event.txHash, merchant: event.merchant }))
      })
    }
  }

  return conflicts
}

module.exports = { mergeRemoteEvents, detectConflicts }
