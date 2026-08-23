const { loadEnv } = require('../util/env.js')
const { formatUnits } = require('../util/units.js')

const DEFAULT_MODEL_NAME = 'LLAMA_3_2_1B_INST_Q4_0'
const DEFAULT_LOAD_TIMEOUT_MS = 120000

function modelName () {
  return loadEnv().QVAC_MODEL || DEFAULT_MODEL_NAME
}

function loadTimeoutMs () {
  const configured = loadEnv().QVAC_LOAD_TIMEOUT_MS
  return configured ? Number(configured) : DEFAULT_LOAD_TIMEOUT_MS
}

// La descarga del modelo (via el registry de QVAC, sobre la misma red P2P
// que Hyperswarm) puede quedarse esperando indefinidamente si no hay
// conectividad. Lo confirmamos en este entorno: sin este limite, el CLI
// se cuelga para siempre. No esperamos loadModel() de forma ilimitada.
function withTimeout (promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function loadSdk () {
  const sdk = await import('@qvac/sdk')

  // Segun la documentacion de @qvac/sdk, al correr directo sobre Bare (no
  // Node/Expo) hay que registrar explicitamente los plugins que se usan
  // antes de la primera llamada; Node/Expo lo hacen automaticamente. Usamos
  // hasPlugin para que el registro sea idempotente (registrar dos veces
  // el mismo modelType tira PluginAlreadyRegisteredError). Si el import
  // del plugin falla (ej. falta instalar el addon nativo @qvac/llm-llamacpp),
  // dejamos que el error se propague: es un problema real, no algo a ignorar.
  const { registerPlugin, hasPlugin } = await import('@qvac/sdk/plugins')
  if (!hasPlugin('llamacpp-completion')) {
    const { llmPlugin } = await import('@qvac/sdk/llamacpp-completion/plugin')
    registerPlugin(llmPlugin)
  }
  if (!hasPlugin('ggml-ocr')) {
    const { ocrPlugin } = await import('@qvac/sdk/ggml-ocr/plugin')
    registerPlugin(ocrPlugin)
  }

  return sdk
}

async function ask (question, context, { onProgress } = {}) {
  const sdk = await loadSdk()
  const name = modelName()
  const modelSrc = sdk[name]

  if (!modelSrc) {
    throw new Error(`Modelo QVAC desconocido: "${name}". Revisa la variable QVAC_MODEL o usa el default (${DEFAULT_MODEL_NAME}).`)
  }

  const timeoutMs = loadTimeoutMs()
  const modelId = await withTimeout(
    sdk.loadModel({ modelSrc, onProgress }),
    timeoutMs,
    `Tiempo de espera agotado cargando el modelo (${Math.round(timeoutMs / 1000)}s). ` +
    'La descarga usa la misma red P2P que "merchant sync": si no hay conectividad al DHT, se queda esperando. ' +
    'Verifica tu conexion, o ajusta QVAC_LOAD_TIMEOUT_MS en .env.'
  )

  try {
    const run = sdk.completion({
      modelId,
      stream: false,
      history: [
        {
          role: 'system',
          content: 'Eres un asistente que responde preguntas sobre el libro de ventas de un comercio. ' +
            'Responde en espanol, de forma breve y concreta, basandote SOLO en los datos de contexto que siguen. ' +
            'Si no hay informacion suficiente en el contexto para responder, decilo explicitamente en vez de inventar datos.\n\n' +
            context
        },
        { role: 'user', content: question }
      ]
    })

    return await run.text
  } finally {
    await sdk.unloadModel({ modelId })
  }
}

// OCR (reconciliacion de facturas, QVAC Track 1). Segun la doc de @qvac/sdk,
// los modelos GGUF del registry con addon "ocr" resuelven su pipeline y su
// detector automaticamente: OCR_LATIN (EasyOCR) deriva el detector CRAFT
// solo, no hay que pasarlo a mano.
async function ocrImage (imagePath) {
  const sdk = await loadSdk()
  const timeoutMs = loadTimeoutMs()

  const modelId = await withTimeout(
    sdk.loadModel({ modelSrc: sdk.OCR_LATIN.src, modelType: sdk.MODEL_TYPES.ggmlOcr }),
    timeoutMs,
    `Tiempo de espera agotado cargando el modelo de OCR (${Math.round(timeoutMs / 1000)}s). ` +
    'La descarga usa la misma red P2P que "merchant sync": si no hay conectividad al DHT, se queda esperando. ' +
    'Verifica tu conexion, o ajusta QVAC_LOAD_TIMEOUT_MS en .env.'
  )

  try {
    const { blocks, stats } = sdk.ocr({ modelId, image: imagePath, options: { paragraph: true } })
    const resolvedBlocks = await blocks
    return {
      text: resolvedBlocks.map((b) => b.text).join('\n').trim(),
      blocks: resolvedBlocks,
      stats: await stats
    }
  } finally {
    await sdk.unloadModel({ modelId })
  }
}

// Reconciliacion de facturas (QVAC Track 1): le pasamos al mismo modelo de
// texto el texto OCR de un comprobante y los datos de la factura ya
// registrada en CLIQ, y le pedimos un veredicto en un formato fijo y
// facil de parsear (no JSON libre: un modelo de 1B falla seguido generando
// JSON valido). Reintenta el parseo una vez con un prompt mas estricto antes
// de rendirse y devolver un resultado "incierto" en vez de inventar un
// numero — es la garantia de "honesto sobre lo que no puede hacer" que pide
// el brief, hecha en codigo, no solo en el prompt.
const RECONCILE_TAGS = ['VEREDICTO', 'MONTO_DETECTADO', 'EXPLICACION']

function buildReconcilePrompt (invoice, ocrText, strict) {
  const expected = `${formatUnits(BigInt(invoice.amount), invoice.decimals)} ${invoice.currency}`
  const strictNote = strict
    ? '\n\nIMPORTANTE: tu respuesta anterior no tenia el formato pedido. Responde SOLO con las 3 lineas exactas de abajo, nada mas.'
    : ''
  return {
    system: 'Sos un asistente que concilia comprobantes de pago para un comercio. ' +
      'Te paso el texto que se extrajo por OCR de una foto/escaneo de un comprobante, y los datos de la ' +
      'factura ya registrada en el sistema. Tu trabajo es decir si el comprobante corresponde a esa factura. ' +
      'Basate SOLO en el texto OCR: si el monto no aparece claro o el texto esta incompleto, decilo en vez de inventar un numero. ' +
      'Respondes SIEMPRE con exactamente estas 3 lineas, en este orden y con estas etiquetas literales:\n' +
      'VEREDICTO: COINCIDE, NO_COINCIDE o INCIERTO\n' +
      'MONTO_DETECTADO: el monto que encontraste en el texto OCR (solo el numero, o "ninguno" si no se ve)\n' +
      'EXPLICACION: una frase corta en espanol que un humano pueda verificar en 5 segundos' + strictNote,
    user: `Factura registrada: ${expected}, destinatario ${invoice.recipient}${invoice.memo ? `, memo "${invoice.memo}"` : ''}.\n\n` +
      `Texto OCR del comprobante:\n"""\n${ocrText}\n"""`
  }
}

function parseReconcileResponse (text) {
  const lines = {}
  for (const tag of RECONCILE_TAGS) {
    const match = text.match(new RegExp(`${tag}:\\s*(.+)`, 'i'))
    if (!match) return null
    lines[tag] = match[1].trim()
  }
  const modelVerdict = lines.VEREDICTO.toUpperCase()
  if (!['COINCIDE', 'NO_COINCIDE', 'INCIERTO'].includes(modelVerdict)) return null
  return {
    modelVerdict,
    detectedAmount: lines.MONTO_DETECTADO,
    explanation: lines.EXPLICACION
  }
}

// Probamos en la practica que el modelo de 1B extrae bien el monto del texto
// OCR pero falla comparandolo con el de la factura (dijo "COINCIDE" con un
// monto detectado que el mismo habia leido como distinto). Un modelo chico
// no es confiable haciendo aritmetica/comparacion, asi que el veredicto
// final NUNCA sale del modelo: se calcula en codigo a partir del numero que
// el modelo extrajo. El VEREDICTO que dice el modelo se guarda aparte solo
// para poder detectar y loguear ese desacuerdo (transparencia, no se oculta).
function computeVerdict (invoice, detectedAmountRaw) {
  const expected = Number(formatUnits(BigInt(invoice.amount), invoice.decimals))
  const normalized = String(detectedAmountRaw).replace(/[^\d.,-]/g, '').replace(',', '.')
  const detected = normalized ? Number(normalized) : NaN

  if (!Number.isFinite(detected)) {
    return { verdict: 'INCIERTO', expectedAmount: expected, detectedAmountParsed: null }
  }
  const matches = Math.abs(detected - expected) < 0.005
  return { verdict: matches ? 'COINCIDE' : 'NO_COINCIDE', expectedAmount: expected, detectedAmountParsed: detected }
}

async function reconcileReceipt (invoice, ocrText) {
  const sdk = await loadSdk()
  const modelId = await withTimeout(
    sdk.loadModel({ modelSrc: sdk[modelName()].src, modelType: sdk.MODEL_TYPES.llamacppCompletion }),
    loadTimeoutMs(),
    'Tiempo de espera agotado cargando el modelo de texto para reconciliar.'
  )

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = buildReconcilePrompt(invoice, ocrText, attempt > 0)
      const run = sdk.completion({
        modelId,
        stream: false,
        history: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      })
      const text = await run.text
      const parsed = parseReconcileResponse(text)
      if (!parsed) continue

      const computed = computeVerdict(invoice, parsed.detectedAmount)
      return {
        verdict: computed.verdict,
        modelVerdict: parsed.modelVerdict,
        modelDisagreed: computed.verdict !== parsed.modelVerdict,
        detectedAmount: parsed.detectedAmount,
        expectedAmount: computed.expectedAmount,
        explanation: parsed.explanation,
        attempts: attempt + 1,
        raw: text
      }
    }
    return {
      verdict: 'INCIERTO',
      modelVerdict: null,
      modelDisagreed: false,
      detectedAmount: 'ninguno',
      expectedAmount: Number(formatUnits(BigInt(invoice.amount), invoice.decimals)),
      explanation: 'El modelo local no devolvio un formato interpretable tras 2 intentos; revisar el comprobante a mano.',
      attempts: 2,
      raw: null
    }
  } finally {
    await sdk.unloadModel({ modelId })
  }
}

module.exports = { ask, ocrImage, reconcileReceipt, modelName, DEFAULT_MODEL_NAME }
