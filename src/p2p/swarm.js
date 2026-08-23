const crypto = require('hypercore-crypto')
const Hyperswarm = require('hyperswarm')
const config = require('../util/config.js')
const store = require('../ledger/store.js')
const { encodeMessage, createLineParser } = require('./protocol.js')
const { mergeRemoteEvents, detectConflicts } = require('./merge.js')

function topicFromRoom (room) {
  return crypto.data(Buffer.from(`cliq:ledger:${room}`))
}

function requireIdentity () {
  const identity = config.load()
  if (!identity) {
    throw new Error('CLIQ no esta inicializado. Ejecuta "merchant init" primero.')
  }
  return identity
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// El bootstrap de la DHT puede quedarse esperando indefinidamente si no hay
// forma de alcanzar los nodos de bootstrap (red caida, sandbox sin egress, etc).
// No dejamos que eso cuelgue el CLI: nunca esperamos flushed()/destroy() de
// forma bloqueante, solo abrimos una ventana de tiempo total acotada por
// timeoutMs durante la cual pueden llegar conexiones entrantes.
function withTimeout (promise, ms) {
  return Promise.race([promise, sleep(ms)])
}

async function discoverPeers ({ room, timeoutMs = 8000, onLog = () => {} }) {
  requireIdentity()

  const swarm = new Hyperswarm()
  const seen = new Set()

  swarm.on('connection', (socket, peerInfo) => {
    const key = peerInfo.publicKey.toString('hex')
    seen.add(key)
    onLog(`Peer detectado: ${key.slice(0, 16)}...`)
    socket.on('error', () => {})
    socket.end()
  })

  const topic = topicFromRoom(room)
  const discovery = swarm.join(topic, { server: true, client: true })
  discovery.flushed().catch(() => {})

  await sleep(timeoutMs)
  await withTimeout(swarm.destroy(), 5000)

  return { peers: [...seen], count: seen.size }
}

async function syncRoom ({ room, timeoutMs = 20000, onLog = () => {} }) {
  const identity = requireIdentity()

  const swarm = new Hyperswarm()
  const stats = { peersConnected: 0, sent: 0, received: 0, added: 0, skipped: 0, invalid: 0 }

  swarm.on('connection', (socket, peerInfo) => {
    stats.peersConnected++
    const peerKey = peerInfo.publicKey.toString('hex').slice(0, 16)
    onLog(`Peer conectado: ${peerKey}...`)

    const localEvents = store.loadAll()

    const onData = createLineParser((message) => {
      if (message.type !== 'events' || !Array.isArray(message.events)) return

      stats.received += message.events.length
      const result = mergeRemoteEvents(message.events)
      stats.added += result.added
      stats.skipped += result.skipped
      stats.invalid += result.invalid

      onLog(`Recibidos ${message.events.length} eventos de ${peerKey}... (nuevos: ${result.added}, duplicados: ${result.skipped}, invalidos: ${result.invalid})`)
    })

    socket.on('data', onData)
    socket.on('error', () => {})
    socket.on('close', () => onLog(`Peer desconectado: ${peerKey}...`))

    socket.write(encodeMessage({
      type: 'events',
      merchant: identity.publicKey,
      events: localEvents
    }))
    stats.sent += localEvents.length
  })

  const topic = topicFromRoom(room)
  const discovery = swarm.join(topic, { server: true, client: true })
  discovery.flushed().catch(() => {})

  await sleep(timeoutMs)

  await withTimeout(swarm.destroy(), 5000)

  stats.conflicts = detectConflicts()
  return stats
}

module.exports = { topicFromRoom, discoverPeers, syncRoom }
