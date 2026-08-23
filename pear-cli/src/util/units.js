function formatUnits (value, decimals) {
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const fraction = abs % base
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  const sign = negative ? '-' : ''
  return fractionStr ? `${sign}${whole}.${fractionStr}` : `${sign}${whole}`
}

function parseUnits (value, decimals) {
  const str = String(value).trim()
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str)
  if (!match) {
    throw new Error(`Monto invalido: "${value}". Usa un numero decimal, ej. 12.50`)
  }

  const [, sign, whole, fraction = ''] = match
  if (fraction.length > decimals) {
    throw new Error(`El monto "${value}" tiene mas decimales de los soportados (${decimals}).`)
  }

  const paddedFraction = fraction.padEnd(decimals, '0')
  const base = BigInt(whole + paddedFraction)
  return sign === '-' ? -base : base
}

module.exports = { formatUnits, parseUnits }
