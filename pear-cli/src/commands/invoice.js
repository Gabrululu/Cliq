const { parseFlags } = require('../util/args.js')
const { formatUnits, parseUnits } = require('../util/units.js')
const wdk = require('../payments/wdk.js')
const store = require('../invoices/store.js')

const USAGE = 'Uso: merchant invoice <create|show> [opciones]'

async function run (args) {
  const [sub, ...rest] = args

  if (sub === 'create') return create(rest)
  if (sub === 'show') return show(rest)

  console.error(USAGE)
  Bare.exit(1)
}

async function create (args) {
  const { flags } = parseFlags(args)

  if (!flags.amount) {
    console.error('Falta --amount. Uso: merchant invoice create --amount 12.50 [--currency USDT] [--memo "..."]')
    Bare.exit(1)
    return
  }

  const currency = (flags.currency || 'USDT').toUpperCase()
  if (currency !== 'USDT') {
    console.error(`Moneda no soportada: ${currency}. Por ahora solo se soporta USDT.`)
    Bare.exit(1)
    return
  }

  const tokenAddress = wdk.usdtContract()
  if (!tokenAddress) {
    console.error('WDK_USDT_CONTRACT no esta configurado en .env. Define la direccion del contrato USD₮ de tu red de prueba.')
    Bare.exit(1)
    return
  }

  const index = flags.index ? Number(flags.index) : 0
  const decimals = wdk.usdtDecimals()

  let amount
  try {
    amount = parseUnits(flags.amount, decimals)
  } catch (err) {
    console.error(err.message)
    Bare.exit(1)
    return
  }

  if (amount <= 0n) {
    console.error('El monto debe ser mayor que cero.')
    Bare.exit(1)
    return
  }

  const recipient = await wdk.getAddress(index)

  const invoice = store.create({
    amount: amount.toString(),
    currency,
    token: tokenAddress,
    decimals,
    memo: flags.memo || '',
    recipient,
    recipientIndex: index
  })

  printInvoice(invoice)
}

async function show (args) {
  const [id] = args
  if (!id) {
    console.error('Uso: merchant invoice show <id>')
    Bare.exit(1)
    return
  }

  const invoice = store.get(id)
  if (!invoice) {
    console.error(`Factura no encontrada: ${id}`)
    Bare.exit(1)
    return
  }

  printInvoice(invoice)
}

function printInvoice (invoice) {
  console.log(`Invoice ID: ${invoice.id}`)
  console.log(`Monto: ${formatUnits(BigInt(invoice.amount), invoice.decimals)} ${invoice.currency}`)
  console.log(`Destinatario: ${invoice.recipient} (cuenta ${invoice.recipientIndex})`)
  if (invoice.memo) console.log(`Memo: ${invoice.memo}`)
  console.log(`Estado: ${invoice.status}`)
  if (invoice.txHash) console.log(`Transaccion: ${invoice.txHash}`)
  if (invoice.payer) console.log(`Pagador: ${invoice.payer} (cuenta ${invoice.payerIndex})`)
  console.log(`Creada: ${invoice.createdAt}`)
}

module.exports = { run, printInvoice }
