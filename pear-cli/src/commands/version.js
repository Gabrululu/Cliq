const pkg = require('../../package.json')

async function run () {
  console.log(`CLIQ v${pkg.version}`)
}

module.exports = { run }
