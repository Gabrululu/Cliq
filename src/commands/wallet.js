const { parseFlags } = require('../util/args.js')
const { formatUnits } = require('../util/units.js')
const wdk = require('../payments/wdk.js')

const USAGE = 'Uso: merchant wallet <address|balance|generate-seed> [--index 0] [--token 0x...]'

async function run (args) {
  const [sub, ...rest] = args

  if (sub === 'address') return address(rest)
  if (sub === 'balance') return balance(rest)
  if (sub === 'generate-seed') return generateSeed(rest)

  console.error(USAGE)
  Bare.exit(1)
}

async function address (args) {
  const { flags } = parseFlags(args)
  const index = flags.index ? Number(flags.index) : 0

  const addr = await wdk.getAddress(index)
  console.log(`Red: ${wdk.networkLabel()}`)
  console.log(`Cuenta ${index}: ${addr}`)
}

async function balance (args) {
  const { flags } = parseFlags(args)
  const index = flags.index ? Number(flags.index) : 0

  console.log(`Red: ${wdk.networkLabel()}`)

  try {
    const native = await wdk.getNativeBalance(index)
    console.log(`Balance nativo: ${formatUnits(native.raw, native.decimals)} ${native.symbol}`)
  } catch (err) {
    console.log(`Balance nativo: no se pudo consultar (${err.message})`)
    console.log('Verifica WDK_RPC_URL en .env y la conectividad de red.')
    return
  }

  const tokenAddress = flags.token || wdk.usdtContract()
  if (!tokenAddress) {
    console.log('Balance USD₮: no configurado. Define WDK_USDT_CONTRACT en .env o pasa --token <direccion>.')
    return
  }

  try {
    const token = await wdk.getTokenBalance(index, tokenAddress)
    console.log(`Balance USD₮: ${formatUnits(token.raw, token.decimals)} (contrato ${tokenAddress})`)
  } catch (err) {
    console.log(`Balance USD₮: no se pudo consultar (${err.message})`)
  }
}

async function generateSeed () {
  const { default: WDK } = await import('@tetherto/wdk')
  const seedPhrase = WDK.getRandomSeedPhrase(12)

  console.log('Seed phrase generada (solo para desarrollo/testnet):')
  console.log('')
  console.log(seedPhrase)
  console.log('')
  console.log('Guardala en tu .env local como MERCHANT_SEED_PHRASE.')
  console.log('No la compartas, no la subas a git y no la uses en mainnet.')
}

module.exports = { run }
