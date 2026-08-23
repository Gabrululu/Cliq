const { parseFlags } = require('../util/args.js')
const swarm = require('../p2p/swarm.js')

async function run (args) {
  const { flags } = parseFlags(args)

  if (!flags.room) {
    console.error('Uso: merchant peers --room <sala> [--timeout 8000]')
    Bare.exit(1)
    return
  }

  const timeoutMs = flags.timeout ? Number(flags.timeout) : 8000

  console.log(`Buscando peers en la sala "${flags.room}" durante ${Math.round(timeoutMs / 1000)}s...`)

  let result
  try {
    result = await swarm.discoverPeers({
      room: flags.room,
      timeoutMs,
      onLog: (line) => console.log(line)
    })
  } catch (err) {
    console.error(`Error: ${err.message}`)
    Bare.exit(1)
    return
  }

  console.log('')
  console.log(`Peers detectados: ${result.count}`)
  for (const key of result.peers) {
    console.log(`  - ${key}`)
  }
}

module.exports = { run }
