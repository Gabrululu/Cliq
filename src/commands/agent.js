const { parseFlags } = require('../util/args.js')
const { formatUnits } = require('../util/units.js')
const { loadEnv } = require('../util/env.js')
const store = require('../invoices/store.js')
const ledger = require('../ledger/events.js')
const { spawnSync } = require('bare-subprocess')
const path = require('bare-path')

const DEFAULT_SPEND_CAP_USDT = 10
const DEFAULT_NETWORK = 'sepolia'
const DEFAULT_TOKEN = 'tpusdt'
const DEFAULT_FROM_INDEX = 1

const USAGE = 'Uso: merchant agent settle <invoice-id> [--yes]'

// Este comando es el unico camino "agentico" para mover plata: a diferencia de
// "merchant pay", que un humano corre directo desde la terminal, "agent settle"
// esta pensado para que lo invoque un asistente de IA (via el servidor MCP en
// mcp/server.js). Por eso los guardrails estan en el codigo, no en un prompt:
// un modelo que alucina un monto o una direccion no puede hacer nada distinto
// de lo que ya dice la factura.
async function run (args) {
  const [sub, ...rest] = args

  if (sub !== 'settle') {
    console.error(USAGE)
    Bare.exit(1)
    return
  }

  return settle(rest)
}

async function settle (args) {
  const [invoiceId, ...rest] = args
  const { flags } = parseFlags(rest)
  const asJson = Boolean(flags.json)

  function fail (message, extra) {
    if (asJson) {
      console.log(JSON.stringify({ ok: false, error: message, ...extra }))
    } else {
      console.error(message)
    }
    Bare.exit(1)
  }

  function done (payload) {
    if (asJson) {
      console.log(JSON.stringify({ ok: true, ...payload }))
      return
    }
    if (!flags.yes) {
      console.log(`Cotizacion via wdk-cli: ${payload.amountFormatted} -> ${payload.recipient}`)
      console.log(`Comision estimada: ${payload.estimatedFee || 'n/d'}`)
      console.log('')
      console.log('Esto fue solo una cotizacion, no se envio ninguna transaccion.')
      console.log(`Volve a ejecutar con --yes para confirmar y enviar el pago: merchant agent settle ${invoiceId} --yes`)
      return
    }
    console.log('Pago enviado por el agente (via @tetherto/wdk-cli)')
    console.log(`Transaccion: ${payload.txHash}`)
    console.log('Estado: submitted (transmitido a la red, aun no se confirmo)')
    console.log(`Recibo: ${payload.receiptId}`)
  }

  if (!invoiceId) return fail(USAGE)

  const invoice = store.get(invoiceId)
  if (!invoice) return fail(`Factura no encontrada: ${invoiceId}`)

  if (invoice.status === 'submitted') {
    if (asJson) {
      console.log(JSON.stringify({ ok: true, alreadyPaid: true, txHash: invoice.txHash }))
    } else {
      console.log(`Esta factura ya fue pagada. Transaccion: ${invoice.txHash}`)
    }
    return
  }

  if (invoice.status !== 'pending' && invoice.status !== 'failed') {
    return fail(`No se puede pagar una factura en estado "${invoice.status}".`)
  }

  const env = loadEnv()
  const capUsdt = env.AGENT_SPEND_CAP_USDT ? Number(env.AGENT_SPEND_CAP_USDT) : DEFAULT_SPEND_CAP_USDT
  const amountUsdt = Number(formatUnits(BigInt(invoice.amount), invoice.decimals))

  // Guardrail 1: tope de gasto. El agente nunca puede pagar mas que esto,
  // sin importar lo que le hayan pedido en lenguaje natural.
  if (!Number.isFinite(capUsdt) || amountUsdt > capUsdt) {
    return fail(
      `Guardrail: el monto de la factura (${amountUsdt} ${invoice.currency}) supera el tope permitido para el agente (${capUsdt} ${invoice.currency}, definido en AGENT_SPEND_CAP_USDT). Esta factura la tiene que pagar un humano con "merchant pay".`,
      { guardrail: 'spend_cap', amountUsdt, capUsdt }
    )
  }

  // Guardrail 2: allowlist implicita. El destinatario SIEMPRE es el que ya
  // quedo registrado en la factura al crearla — nunca un parametro que el
  // agente (o quien le habla) pueda elegir libremente en esta llamada.
  const recipient = invoice.recipient
  const network = env.AGENT_WDK_NETWORK || DEFAULT_NETWORK
  const token = env.AGENT_WDK_TOKEN_SYMBOL || DEFAULT_TOKEN
  const fromIndex = env.AGENT_WDK_FROM_INDEX ? Number(env.AGENT_WDK_FROM_INDEX) : DEFAULT_FROM_INDEX

  const wdkArgs = [
    'send',
    '--network', network,
    '--to', recipient,
    '--amount', String(amountUsdt),
    '--token', token,
    '--index', String(fromIndex),
    '--json'
  ]
  if (!flags.yes) wdkArgs.push('--dry-run')

  let result
  try {
    result = runWdk(wdkArgs)
  } catch (err) {
    return fail(
      `No se pudo ejecutar wdk-cli: ${err.message}. Verifica que el wallet "tiendapay" este importado y desbloqueado ("wdk wallet unlock --name tiendapay --ttl 0").`
    )
  }

  if (!flags.yes) {
    return done({
      recipient,
      amountFormatted: result.amountFormatted || `${amountUsdt} ${invoice.currency}`,
      estimatedFee: result.estimatedFeeFormatted || result.estimatedFee
    })
  }

  const txHash = result.hash || result.txHash || result.transactionHash
  if (!txHash) {
    store.update(invoiceId, { status: 'failed', error: 'wdk send no devolvio un txHash' })
    return fail('wdk send no devolvio un txHash.', { wdkResult: result })
  }

  const receipt = ledger.createEvent({
    type: 'invoice_paid',
    invoiceId,
    amount: invoice.amount,
    currency: invoice.currency,
    decimals: invoice.decimals,
    chain: network,
    payer: `agent:wdk-cli:index-${fromIndex}`,
    recipient,
    txHash
  })

  store.update(invoiceId, {
    status: 'submitted',
    txHash,
    payer: `agent:wdk-cli:index-${fromIndex}`,
    payerIndex: fromIndex,
    receiptId: receipt.id,
    error: null
  })

  done({ txHash, receiptId: receipt.id, recipient, amountFormatted: `${amountUsdt} ${invoice.currency}` })
}

function runWdk (args) {
  const bin = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'wdk')
  const child = spawnSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  if (child.status !== 0) {
    const stderr = child.stderr ? child.stderr.toString('utf8') : ''
    throw new Error(stderr.trim() || `wdk salio con codigo ${child.status}`)
  }

  const stdout = child.stdout ? child.stdout.toString('utf8') : ''
  try {
    return JSON.parse(stdout)
  } catch (err) {
    throw new Error(`respuesta de wdk no es JSON valido: ${stdout}`)
  }
}

module.exports = { run }
