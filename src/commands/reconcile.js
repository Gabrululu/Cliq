const fs = require('bare-fs')
const { parseFlags } = require('../util/args.js')
const store = require('../invoices/store.js')
const qvac = require('../ai/qvac.js')

const USAGE = 'Uso: merchant reconcile <invoice-id> <ruta-imagen> [--json]'

async function run (args) {
  const { positional, flags } = parseFlags(args)
  const [invoiceId, imagePath] = positional
  const asJson = Boolean(flags.json)

  function fail (message, extra) {
    if (asJson) console.log(JSON.stringify({ ok: false, error: message, ...extra }))
    else console.error(message)
    Bare.exit(1)
  }

  if (!invoiceId || !imagePath) return fail(USAGE)

  const invoice = store.get(invoiceId)
  if (!invoice) return fail(`Factura no encontrada: ${invoiceId}`)

  if (!fs.existsSync(imagePath)) return fail(`No se encontro el archivo de imagen: ${imagePath}`)

  if (!asJson) console.log(`Leyendo comprobante con OCR local (${imagePath})...`)

  let ocrResult
  try {
    ocrResult = await qvac.ocrImage(imagePath)
  } catch (err) {
    return fail(`OCR no disponible: ${err.message}`)
  }

  if (!ocrResult.text) {
    return fail(
      'No se detecto texto legible en la imagen. Revisa la iluminacion/foco del comprobante y volve a intentar.',
      { ocrBlocks: 0 }
    )
  }

  if (!asJson) console.log(`Texto detectado (${ocrResult.blocks.length} bloques). Conciliando con el modelo local...`)

  const result = await qvac.reconcileReceipt(invoice, ocrResult.text)

  const payload = {
    ok: true,
    invoiceId,
    verdict: result.verdict,
    modelVerdict: result.modelVerdict,
    modelDisagreed: result.modelDisagreed,
    detectedAmount: result.detectedAmount,
    expectedAmount: result.expectedAmount,
    explanation: result.explanation,
    modelAttempts: result.attempts,
    ocrBlocks: ocrResult.blocks.length,
    ocrText: ocrResult.text
  }

  if (asJson) {
    console.log(JSON.stringify(payload))
    return
  }

  console.log('')
  console.log(`Factura: ${invoiceId} (monto esperado: ${result.expectedAmount} ${invoice.currency})`)
  console.log(`Veredicto: ${result.verdict}`)
  console.log(`Monto detectado en el comprobante: ${result.detectedAmount}`)
  console.log(`Explicacion del modelo: ${result.explanation}`)
  if (result.attempts > 1) {
    console.log(`(el modelo local necesito ${result.attempts} intentos para responder en el formato esperado)`)
  }
  if (result.modelDisagreed) {
    console.log(`ADVERTENCIA: el modelo dijo "${result.modelVerdict}" pero el monto que el mismo detecto no coincide con eso. Se uso el veredicto calculado en codigo, no el del modelo.`)
  }
  console.log('')
  console.log('Esto es una lectura asistida, no cambia el estado de la factura. Revisa el texto OCR crudo si algo no cuadra:')
  console.log(ocrResult.text)
}

module.exports = { run }
