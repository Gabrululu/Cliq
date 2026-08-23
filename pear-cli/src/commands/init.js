const crypto = require('hypercore-crypto')
const config = require('../util/config.js')
const { parseFlags } = require('../util/args.js')
const { dataDir } = require('../util/paths.js')

async function run (args) {
  if (config.exists()) {
    console.log(`Ya inicializado en ${dataDir()}`)
    console.log('Usa el archivo .tiendapay/config.json existente, o elimina la carpeta para reiniciar.')
    return
  }

  const { flags } = parseFlags(args)
  const network = flags.network || 'testnet'

  const identity = crypto.keyPair()

  config.save({
    network,
    publicKey: identity.publicKey.toString('hex'),
    secretKey: identity.secretKey.toString('hex'),
    createdAt: new Date().toISOString()
  })

  console.log('TiendaPay inicializado')
  console.log(`Red: ${network}`)
  console.log(`Identidad P2P: ${identity.publicKey.toString('hex')}`)
  console.log(`Almacen local: ${dataDir()}`)
  console.log('')
  console.log('Nota: esta identidad P2P se usa para firmar el libro mayor y sincronizar entre terminales.')
  console.log('La wallet de pagos (WDK) se configura en la siguiente fase con "merchant wallet".')
}

module.exports = { run }
