const HELP_TEXT = `TiendaPay - terminal de pagos P2P para pequenos comercios

Uso:
  merchant <comando> [opciones]

Comandos:
  init                          Inicializa la identidad del comercio y el almacen local
  wallet address                Muestra la direccion de la wallet (WDK)
  wallet balance                Consulta el balance nativo y en USD₮
  wallet generate-seed          Genera una seed phrase de prueba (solo dev/testnet)
  invoice create                 Crea una factura de cobro en USD₮
  invoice show <id>              Muestra el detalle de una factura
  pay <invoice-id>                Cotiza y paga una factura (--yes para confirmar)
  ledger                         Lista el historial de eventos firmados
  receipt show <id>              Muestra el detalle de un recibo firmado
  receipt verify <id>            Verifica la firma y el encadenamiento de un recibo
  sync --room <sala>              Sincroniza el libro mayor con otras terminales (P2P)
  peers --room <sala>             Lista los peers detectados en una sala P2P
  ask "<pregunta>"                Consulta el libro mayor en lenguaje natural (QVAC, local)
  agent settle <id> [--yes]       Paga una factura via @tetherto/wdk-cli con guardrails (pensado para un agente MCP)
  gasless pay <id> [--yes]        Paga una factura sin ETH: fee cobrado en USD₮ (ERC-4337 + paymaster Pimlico)
  reconcile <id> <imagen> [--json] Concilia un comprobante (foto/scan) contra una factura via OCR local (QVAC)
  version                       Muestra la version instalada
  help                          Muestra esta ayuda
`

async function run () {
  console.log(HELP_TEXT)
}

module.exports = { run, HELP_TEXT }
