const { loadEnv } = require('../util/env.js')

const DEFAULT_USDT_DECIMALS = 6

let wdkInstance = null

function requireSeedPhrase (env) {
  const seedPhrase = env.MERCHANT_SEED_PHRASE
  if (!seedPhrase) {
    throw new Error(
      'MERCHANT_SEED_PHRASE no esta configurada. Copia .env.example a .env, ' +
      'genera una frase de prueba con "merchant wallet generate-seed" y pegala ahi. ' +
      'Nunca uses una seed real ni la subas a git.'
    )
  }
  return seedPhrase
}

function requireRpcUrl (env) {
  const rpcUrl = env.WDK_RPC_URL
  if (!rpcUrl) {
    throw new Error(
      'WDK_RPC_URL no esta configurada. Define el endpoint RPC de la red de prueba en .env.'
    )
  }
  return rpcUrl
}

async function getWdk () {
  if (wdkInstance) return wdkInstance

  const env = loadEnv()
  const seedPhrase = requireSeedPhrase(env)
  const rpcUrl = requireRpcUrl(env)

  const [{ default: WDK }, { default: WalletManagerEvm }] = await Promise.all([
    import('@tetherto/wdk'),
    import('@tetherto/wdk-wallet-evm')
  ])

  wdkInstance = new WDK(seedPhrase).registerWallet('evm', WalletManagerEvm, {
    provider: rpcUrl
  })

  return wdkInstance
}

async function getAccount (index = 0) {
  const wdk = await getWdk()
  return wdk.getAccount('evm', index)
}

async function getAddress (index = 0) {
  const account = await getAccount(index)
  return account.getAddress()
}

async function getNativeBalance (index = 0) {
  const account = await getAccount(index)
  const balance = await account.getBalance()
  return { raw: balance, decimals: 18, symbol: nativeSymbol() }
}

async function getTokenBalance (index, tokenAddress) {
  const account = await getAccount(index)
  const balance = await account.getTokenBalance(tokenAddress)
  const decimals = usdtDecimals()
  return { raw: balance, decimals, symbol: 'USDT' }
}

async function quoteTransfer (index, { token, recipient, amount }) {
  const account = await getAccount(index)
  return account.quoteTransfer({ token, recipient, amount })
}

async function transfer (index, { token, recipient, amount }) {
  const account = await getAccount(index)
  return account.transfer({ token, recipient, amount })
}

function usdtContract () {
  return loadEnv().WDK_USDT_CONTRACT || null
}

function usdtDecimals () {
  const configured = loadEnv().WDK_USDT_DECIMALS
  return configured ? Number(configured) : DEFAULT_USDT_DECIMALS
}

function nativeSymbol () {
  return loadEnv().WDK_NATIVE_SYMBOL || 'ETH'
}

function networkLabel () {
  return loadEnv().WDK_NETWORK || 'testnet'
}

module.exports = {
  getAccount,
  getAddress,
  getNativeBalance,
  getTokenBalance,
  quoteTransfer,
  transfer,
  usdtContract,
  usdtDecimals,
  nativeSymbol,
  networkLabel
}
