const { parseFlags } = require('../util/args.js')
const { formatUnits } = require('../util/units.js')
const { loadEnv } = require('../util/env.js')
const store = require('../invoices/store.js')
const ledger = require('../ledger/events.js')
const { spawnSync } = require('bare-subprocess')
const path = require('bare-path')

const DEFAULT_NETWORK = 'smart-account-sepolia-pimlico'
const DEFAULT_TOKEN = 'usdt'
const DEFAULT_FROM_INDEX = 1

const USAGE = 'Uso: merchant gasless pay <invoice-id> [--yes]'

// WDK Track, Track 2 (gasless): paga una factura de CLIQ sin que quien
// paga necesite tener ETH — el fee de red se cobra en USD₮ via el modulo
// @tetherto/wdk-wallet-evm-erc-4337 (cuenta inteligente ERC-4337) y el
// paymaster de Pimlico. Esto es justo el problema que resuelve el track:
// "el usuario llega con una wallet vacia, recibe USD₮, y puede mandarlo de
// inmediato" — sin el paso previo de ir a comprar ETH para el gas.
async function run (args) {
  const [sub, ...rest] = args

  if (sub !== 'pay') {
    console.error(USAGE)
    Bare.exit(1)
    return
  }

  return pay(rest)
}

async function pay (args) {
  const [invoiceId, ...rest] = args
  const { flags } = parseFlags(rest)

  if (!invoiceId) {
    console.error(USAGE)
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

  const env = loadEnv()
  const network = env.GASLESS_WDK_NETWORK || DEFAULT_NETWORK
  const token = env.GASLESS_WDK_TOKEN_SYMBOL || DEFAULT_TOKEN
  const fromIndex = env.GASLESS_WDK_FROM_INDEX ? Number(env.GASLESS_WDK_FROM_INDEX) : DEFAULT_FROM_INDEX
  const amountUsdt = Number(formatUnits(BigInt(invoice.amount), invoice.decimals))
  const recipient = invoice.recipient

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
    console.error(`No se pudo ejecutar wdk-cli: ${err.message}`)
    console.error(`Verifica que el wallet este desbloqueado y que la network "${network}" este configurada (ver README, seccion WDK Track 2).`)
    Bare.exit(1)
    return
  }

  if (!flags.yes) {
    console.log(`Cotizacion gasless via wdk-cli (${network}): ${result.amountFormatted || amountUsdt + ' ' + invoice.currency} -> ${recipient}`)
    console.log(`Comision estimada (pagada en ${token.toUpperCase()}, no en ETH): ${result.estimatedFeeFormatted || result.estimatedFee || 'n/d'}`)
    console.log('')
    console.log('Esto fue solo una cotizacion, no se envio ninguna transaccion.')
    console.log(`Volve a ejecutar con --yes para confirmar y enviar el pago: merchant gasless pay ${invoiceId} --yes`)
    return
  }

  const txHash = result.hash || result.txHash || result.transactionHash
  if (!txHash) {
    store.update(invoiceId, { status: 'failed', error: 'wdk send (gasless) no devolvio un txHash' })
    console.error('wdk send no devolvio un txHash. Salida completa:')
    console.error(JSON.stringify(result))
    Bare.exit(1)
    return
  }

  const receipt = ledger.createEvent({
    type: 'invoice_paid',
    invoiceId,
    amount: invoice.amount,
    currency: invoice.currency,
    decimals: invoice.decimals,
    chain: network,
    payer: `gasless:wdk-cli:index-${fromIndex}`,
    recipient,
    txHash
  })

  store.update(invoiceId, {
    status: 'submitted',
    txHash,
    payer: `gasless:wdk-cli:index-${fromIndex}`,
    payerIndex: fromIndex,
    receiptId: receipt.id,
    error: null
  })

  console.log('Pago gasless enviado (fee cobrado en USD₮, sin ETH)')
  console.log(`Transaccion: ${txHash}`)
  console.log('Estado: submitted (transmitido a la red, aun no se confirmo)')
  console.log(`Recibo: ${receipt.id}`)
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
