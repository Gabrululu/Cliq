const fs = require('bare-fs')
const crypto = require('hypercore-crypto')
const { dataDir, invoicesFile } = require('../util/paths.js')

function loadAll () {
  if (!fs.existsSync(invoicesFile())) return {}
  return JSON.parse(fs.readFileSync(invoicesFile(), 'utf8'))
}

function saveAll (invoices) {
  if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true })
  fs.writeFileSync(invoicesFile(), JSON.stringify(invoices, null, 2))
}

function generateId () {
  return `inv_${crypto.randomBytes(6).toString('hex')}`
}

function create (invoice) {
  const invoices = loadAll()
  const id = generateId()
  const now = new Date().toISOString()

  const record = {
    id,
    status: 'pending',
    txHash: null,
    fee: null,
    payer: null,
    createdAt: now,
    updatedAt: now,
    ...invoice
  }

  invoices[id] = record
  saveAll(invoices)
  return record
}

function get (id) {
  const invoices = loadAll()
  return invoices[id] || null
}

function update (id, patch) {
  const invoices = loadAll()
  if (!invoices[id]) throw new Error(`Factura no encontrada: ${id}`)

  invoices[id] = {
    ...invoices[id],
    ...patch,
    updatedAt: new Date().toISOString()
  }

  saveAll(invoices)
  return invoices[id]
}

module.exports = { create, get, update, loadAll }
