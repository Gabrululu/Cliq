const { buildContext } = require('../ai/context.js')
const qvac = require('../ai/qvac.js')

async function run (args) {
  const question = args.join(' ').trim()

  if (!question) {
    console.error('Uso: merchant ask "<pregunta>"')
    Bare.exit(1)
    return
  }

  const context = buildContext()

  console.log(`Cargando modelo local (${qvac.modelName()})... esto puede tardar la primera vez.`)

  let answer
  try {
    answer = await qvac.ask(question, context, {
      onProgress: (progress) => {
        if (progress && typeof progress.percentage === 'number') {
          console.log(`Descargando modelo: ${progress.percentage}%`)
        }
      }
    })
  } catch (err) {
    console.error(`QVAC no disponible: ${err.message}`)
    console.error('El resto de CLIQ funciona igual sin QVAC. Datos crudos que se le hubieran pasado al modelo:')
    console.error('')
    console.error(context)
    Bare.exit(1)
    return
  }

  console.log('')
  console.log(answer.trim())
}

module.exports = { run }
