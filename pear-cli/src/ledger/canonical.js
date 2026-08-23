function canonicalize (value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
  }

  return JSON.stringify(value)
}

module.exports = { canonicalize }
