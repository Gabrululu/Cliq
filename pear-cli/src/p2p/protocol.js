function encodeMessage (obj) {
  return Buffer.from(JSON.stringify(obj) + '\n')
}

function createLineParser (onMessage) {
  let buffer = ''

  return function onData (chunk) {
    buffer += chunk.toString('utf8')

    let idx
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)

      if (line.trim()) {
        try {
          onMessage(JSON.parse(line))
        } catch (err) {
          // Linea malformada de un peer: se ignora, no rompe la conexion.
        }
      }
    }
  }
}

module.exports = { encodeMessage, createLineParser }
