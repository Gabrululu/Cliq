const crypto = require('hypercore-crypto')
const config = require('../util/config.js')
const store = require('./store.js')
const { canonicalize } = require('./canonical.js')

function hashEvent (event) {
  return crypto.data(Buffer.from(canonicalize(event))).toString('hex')
}

function createEvent (fields) {
  const identity = config.load()
  if (!identity) {
    throw new Error('CLIQ no esta inicializado. Ejecuta "merchant init" primero.')
  }

  const previous = store.lastByMerchant(identity.publicKey)

  const unsigned = {
    id: `receipt_${crypto.randomBytes(8).toString('hex')}`,
    merchant: identity.publicKey,
    createdAt: new Date().toISOString(),
    previousEventId: previous ? previous.id : null,
    previousEventHash: previous ? hashEvent(previous) : null,
    ...fields
  }

  const signature = crypto.sign(
    Buffer.from(canonicalize(unsigned)),
    Buffer.from(identity.secretKey, 'hex')
  ).toString('hex')

  const event = { ...unsigned, signature }
  store.append(event)
  return event
}

function verifyEvent (event, previousEvent) {
  const checks = []

  const { signature, ...unsigned } = event
  let signatureValid = false
  try {
    signatureValid = crypto.verify(
      Buffer.from(canonicalize(unsigned)),
      Buffer.from(signature, 'hex'),
      Buffer.from(event.merchant, 'hex')
    )
  } catch (err) {
    signatureValid = false
  }
  checks.push({
    name: 'firma',
    ok: signatureValid,
    detail: signatureValid
      ? 'la firma cubre id, monto, destinatario, txHash y el resto de los campos: si alguno cambio, la firma no verificaria'
      : 'la firma no corresponde al contenido del evento o a la clave publica del comercio'
  })

  if (event.previousEventId === null) {
    checks.push({
      name: 'encadenamiento',
      ok: previousEvent === null,
      detail: previousEvent === null ? 'evento genesis de este comercio (primero de su cadena)' : 'marcado como genesis pero existe un evento anterior de este comercio en el almacen'
    })
  } else if (previousEvent === null) {
    checks.push({
      name: 'encadenamiento',
      ok: false,
      detail: `no se encontro localmente el evento anterior (${event.previousEventId}); puede faltar sincronizar, o el enlace es invalido`
    })
  } else if (previousEvent.merchant !== event.merchant) {
    checks.push({
      name: 'encadenamiento',
      ok: false,
      detail: 'el evento anterior referenciado pertenece a otro comercio: la cadena esta rota'
    })
  } else {
    const expected = hashEvent(previousEvent)
    const ok = event.previousEventHash === expected
    checks.push({
      name: 'encadenamiento',
      ok,
      detail: ok ? `coincide con el hash del evento anterior (${previousEvent.id})` : 'el hash del evento anterior no coincide: el historial pudo ser alterado o reordenado'
    })
  }

  return { valid: checks.every((check) => check.ok), checks }
}

module.exports = { createEvent, verifyEvent, hashEvent }
