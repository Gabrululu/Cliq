const { loadEnv } = require('../util/env.js')

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

module.exports = { ask, modelName, DEFAULT_MODEL_NAME }
