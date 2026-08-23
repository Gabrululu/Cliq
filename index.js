const { run } = require('./src/cli.js')

const args = typeof Pear !== 'undefined' && Pear.config && Pear.config.args
  ? Pear.config.args
  : Bare.argv.slice(2)

run(args)
  .then(() => Bare.exit(0))
  .catch((err) => {
    console.error(`Error: ${err.message}`)
    Bare.exit(1)
  })
