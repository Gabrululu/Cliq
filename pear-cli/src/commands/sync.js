const { parseFlags } = require('../util/args.js')
const swarm = require('../p2p/swarm.js')

async function run (args) {
  const { flags } = parseFlags(args)

  if (!flags.room) {
    console.error('Uso: merchant sync --room <sala> [--timeout 20000]')
    Bare.exit(1)
    return
  }

  const timeoutMs = flags.timeout ? Number(flags.timeout) : 20000

  console.log(`Uniendose a la sala P2P "${flags.room}"...`)
  console.log(`Escuchando peers durante ${Math.round(timeoutMs / 1000)}s (ctrl+c para cancelar antes).`)

  let stats
  try {
    stats = await swarm.syncRoom({
      room: flags.room,
      timeoutMs,
      onLog: (line) => console.log(line)
    })
  } catch (err) {
    console.error(`Error de sincronizacion: ${err.message}`)
    Bare.exit(1)
    return
  }

  console.log('')
  console.log('Sync finalizado')
  console.log(`Peers conectados: ${stats.peersConnected}`)
  console.log(`Eventos locales enviados: ${stats.sent}`)
  console.log(`Eventos recibidos: ${stats.received}`)
  console.log(`Eventos nuevos incorporados: ${stats.added}`)
  console.log(`Eventos duplicados (ya los teniamos): ${stats.skipped}`)
  console.log(`Eventos invalidos rechazados: ${stats.invalid}`)

  if (stats.conflicts.length > 0) {
    console.log('')
    console.log(`Conflictos detectados: ${stats.conflicts.length}`)
    for (const conflict of stats.conflicts) {
      console.log(`  Factura ${conflict.invoiceId} tiene ${conflict.events.length} eventos de pago con txHash distintos:`)
      for (const event of conflict.events) {
        console.log(`    - ${event.id} (comercio ${event.merchant.slice(0, 12)}...) tx=${event.txHash}`)
      }
    }
    console.log('  Revision manual requerida: puede ser un doble pago, o dos comercios registrando la misma factura por error.')
  }
}

module.exports = { run }
