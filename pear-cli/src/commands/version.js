const pkg = require('../../package.json')

async function run () {
  console.log(`TiendaPay v${pkg.version}`)
}

module.exports = { run }
