#!/usr/bin/env node
// Servidor MCP de CLIQ para el track WDK (Tether).
//
// Expone exactamente DOS tools a un cliente MCP (Claude Desktop, Claude Code,
// OpenClaw): "quote_invoice_payment" y "confirm_invoice_payment". Ninguna de
// las dos deja elegir un monto o un destinatario libre — ambas reciben solo
// un invoiceId, y todo lo demas (cuanto, a quien, si esta dentro del tope de
// gasto del agente) lo decide "merchant agent settle" en
// src/commands/agent.js, que corre bajo Bare, no aca. Este archivo es
// deliberadamente un simple puente: no reimplementa ninguna logica de
// wallet/guardrails, solo invoca el comando real y devuelve su salida.
//
// Node.js (no Bare) porque el SDK de MCP (@modelcontextprotocol/sdk) no esta
// pensado para correr bajo el runtime de Bare.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { spawnSync } = require('child_process')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '..')

function resolveBarePath () {
  const home = process.env.HOME || ''
  const candidates = [
    'bare',
    path.join(home, '.local/share/pnpm/bare'),
    path.join(home, '.local/bin/bare')
  ]
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (!probe.error) return candidate
  }
  throw new Error('No se encontro el binario "bare" instalado. Ver README.md.')
}

function runAgentSettle (invoiceId, confirm) {
  const bare = resolveBarePath()
  const args = ['index.js', 'agent', 'settle', invoiceId, '--json']
  if (confirm) args.push('--yes')

  const child = spawnSync(bare, args, {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  })

  const stdout = (child.stdout || '').trim()
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch (err) {
    parsed = { ok: false, error: stdout || (child.stderr || '').trim() || `merchant agent settle salio con codigo ${child.status}` }
  }

  return parsed
}

const server = new McpServer({ name: 'cliq-agent', version: '0.0.1' })

server.registerTool(
  'quote_invoice_payment',
  {
    title: 'Cotizar el pago de una factura de CLIQ',
    description:
      'Cotiza (sin enviar nada) cuanto costaria pagar una factura pendiente de CLIQ via wdk-cli: monto, destinatario y comision estimada. Usa esto siempre antes de confirm_invoice_payment.',
    inputSchema: {
      invoiceId: z.string().describe('El ID de la factura de CLIQ, ej. inv_xxxxxxxxxxxx')
    }
  },
  async ({ invoiceId }) => {
    const result = runAgentSettle(invoiceId, false)
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  }
)

server.registerTool(
  'confirm_invoice_payment',
  {
    title: 'Confirmar y enviar el pago de una factura de CLIQ',
    description:
      'Envia de verdad el pago de una factura pendiente de CLIQ via wdk-cli. Rechaza automaticamente (sin tocar la red) si el monto supera el tope de gasto configurado para el agente (AGENT_SPEND_CAP_USDT), y siempre paga al destinatario que ya tiene registrado la factura — nunca a una direccion elegida en esta llamada.',
    inputSchema: {
      invoiceId: z.string().describe('El ID de la factura de CLIQ a pagar, ej. inv_xxxxxxxxxxxx')
    }
  },
  async ({ invoiceId }) => {
    const result = runAgentSettle(invoiceId, true)
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  }
)

async function main () {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('[cliq-mcp] fatal:', err)
  process.exit(1)
})
