<p align="center">
  <img src="public/assets/logo-lockup.svg" alt="TiendaPay" width="320">
</p>

# TiendaPay

Terminal de pagos USD₮ autocustodial para comercios en general, distribuida como CLI P2P mediante Pear, con libro mayor firmado y sincronizado por Hyperswarm, y consultas locales con QVAC.

Proyecto para [Aleph Hackathon 2026](https://hacki.crecimiento.build/h/aleph-hackathon-2026).

## Que incluye

- **Pagos en USD₮** con wallet autocustodial (WDK): direccion, balance, cotizacion de comision y transferencia.
- **Facturas y cobros**: crear una factura, cotizar el pago, confirmarlo (`--yes`), con estados explicitos (nunca se simula un pago que no ocurrio).
- **Libro mayor firmado**: cada pago genera un recibo firmado (Ed25519) y encadenado a los recibos anteriores del mismo comercio; `receipt verify` detecta cualquier alteracion.
- **Sincronizacion P2P** entre terminales via Hyperswarm, con deteccion de conflictos en vez de sobrescritura silenciosa.
- **Asistente local (QVAC)**: preguntas en lenguaje natural sobre las ventas propias, sin mandar datos a ningun servidor.
- **Distribucion P2P via Pear**, con actualizaciones automaticas (OTA) sin tienda de aplicaciones ni servidor central.

## Documentacion

- [`architecture.md`](architecture.md) — arquitectura tecnica completa (en ingles).
- [`brandkit.md`](brandkit.md) — paleta, tipografia, logo y guia de voz para armar presentaciones (en ingles).
- [`deck.md`](deck.md) — contenido del pitch deck, diapositiva por diapositiva (en ingles).
- [`TESTING.md`](TESTING.md) — checklist de todo lo validado contra infraestructura real (WDK, sync P2P, QVAC, Pear, Pear Track), comando por comando.
- [`pear-cli/README.md`](pear-cli/README.md) — la entrega del Pear Track: CLI standalone instalable con `pear install` + OTA real.

## Landing page

<p align="center">
  <a href="public/index.html">
    <img src="public/assets/landing-preview.png" alt="Vista previa de la landing page de TiendaPay" width="640">
  </a>
</p>

La pagina de presentacion del proyecto vive en [`public/index.html`](public/index.html) — es parte del repositorio, no un enlace externo aparte. Para verla:

```bash
open public/index.html                 # macOS
xdg-open public/index.html              # Linux
# o levantar un servidor estatico simple:
npx serve public
```

Es un archivo HTML autocontenido (sin build, sin dependencias del proyecto) pensado para explicar TiendaPay a un comerciante, no a un desarrollador. La marca (`public/assets/logo-mark.svg`, `logo-mark-dark.svg`, `logo-lockup.svg`) representa un sello de recibo firmado con el simbolo de USD₮, usando la misma paleta de colores que el resto de la pagina.

## Problema

Un comercio pequeno necesita cobrar en USD₮, llevar sus cuentas y verificar sus recibos sin depender de un servidor central ni de conectividad permanente.

## Tracks

1. **WDK** (principal) - wallet, balance, invoices y transferencias.
2. **Pears** (secundario) - distribucion e instalacion OTA de la CLI.
3. **QVAC** (bonus) - consultas en lenguaje natural sobre el libro mayor.

## Estado actual

- [x] Fase 1 - Esqueleto de CLI (`merchant help`, `merchant version`, `merchant init`)
- [x] Fase 2 - Wallet y balance (WDK): `wallet address`, `wallet balance`, `wallet generate-seed`
- [x] Fase 3 - Invoice y transferencia: `invoice create`, `invoice show`, `pay`
- [x] Fase 4 - Libro mayor firmado: `ledger`, `receipt show`, `receipt verify`
- [x] Fase 5 - Sincronizacion P2P (Hyperswarm): `sync`, `peers`
- [x] Fase 6 - Consultas con QVAC: `ask`
- [x] Fase 7 - Release y OTA con Pear (`stage`/`seed`/`dump` probados contra la red real, ver seccion abajo)
- [x] Pear Track - CLI standalone instalable con `pear install` + actualizacion OTA real, ver [`pear-cli/`](pear-cli/)

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior (usado para `npm install`).
- [`bare`](https://www.npmjs.com/package/bare) instalado globalmente para correr el CLI en desarrollo: `npm install -g bare`.
- [`pear`](https://www.npmjs.com/package/pear) instalado globalmente, solo si vas a probar la distribucion P2P (Fase 7): `npm install -g pear`. Requiere red abierta hacia la DHT — ver la seccion "Release y OTA con Pear" mas abajo.

## Instalacion

```bash
npm install
```

### Ejecutar con Bare (runtime local, sin red P2P)

```bash
bare index.js help
bare index.js version
bare index.js init --network testnet
```

### Ejecutar con Pear

```bash
pear stage <link>          # <link> lo genera "pear touch"
pear dump <link> <carpeta> # baja el proyecto a una carpeta, como lo haria otro peer
```

> Nota: la version del CLI de Pear usada acá (3.2.0) cambió respecto a versiones anteriores: `pear run` fue **eliminado** (ya no existe ese comando) y `pear stage <canal>` ya no acepta un nombre de canal como "dev" — ahora pide un link `pear://...` generado con `pear touch`. Ver la seccion "Release y OTA con Pear" mas abajo para el detalle completo, ya probado contra la red real (no una guia teórica).

## Comandos disponibles

```bash
merchant init [--network testnet]        # Inicializa la identidad P2P y el almacen local
merchant wallet generate-seed             # Genera una seed phrase de prueba (solo dev/testnet)
merchant wallet address [--index 0]       # Muestra la direccion EVM de la cuenta (WDK)
merchant wallet balance [--index 0] [--token 0x...]  # Balance nativo y USD₮
merchant invoice create --amount 12.50 [--currency USDT] [--memo "..."] [--index 0]  # Crea una factura
merchant invoice show <id>                # Muestra el detalle de una factura
merchant pay <invoice-id> [--from-index 1] [--yes]  # Cotiza (y con --yes, envia) el pago
merchant ledger                           # Lista los eventos firmados del libro mayor
merchant receipt show <id>                # Muestra el detalle de un recibo firmado
merchant receipt verify <id>              # Verifica firma y encadenamiento de un recibo
merchant sync --room <sala> [--timeout 20000]   # Sincroniza el libro mayor con otras terminales
merchant peers --room <sala> [--timeout 8000]   # Lista los peers detectados en una sala
merchant ask "<pregunta>"                 # Consulta el libro mayor en lenguaje natural (QVAC, local)
merchant version                          # Muestra la version instalada
merchant help                             # Muestra la ayuda
```

### Flujo de cobro (Fase 3)

```bash
bare index.js invoice create --amount 12.50 --memo "Compra #1042"
# -> Invoice ID: inv_xxxxxxxxxxxx

bare index.js invoice show inv_xxxxxxxxxxxx

bare index.js pay inv_xxxxxxxxxxxx
# Sin --yes: solo cotiza (monto + comision de red), no envia nada.

bare index.js pay inv_xxxxxxxxxxxx --yes
# Con --yes: ejecuta la transferencia ERC-20 real desde la cuenta --from-index
# (por defecto 1, para simular un "cliente" distinto del comercio con la misma seed).
```

Las facturas se guardan en `.tiendapay/invoices.json`. Estados posibles: `pending` -> `submitted` (transaccion transmitida, con `txHash`) o `failed` (con el error). `pay` nunca marca una factura como pagada sin que WDK haya devuelto un hash de transaccion real; si la red falla, la factura queda `pending`/`failed`, nunca `submitted`.

### Libro mayor firmado (Fase 4)

Cada `pay --yes` exitoso agrega un evento `invoice_paid` firmado a `.tiendapay/ledger/events.json`, encadenado con el evento anterior (como un mini blockchain local, append-only):

```bash
bare index.js ledger                        # Lista todos los eventos
bare index.js receipt show <receipt-id>      # Detalle de un recibo
bare index.js receipt verify <receipt-id>    # Verifica firma + encadenamiento
```

`receipt verify` comprueba:
1. **Firma** - el evento fue firmado con la clave privada de la identidad P2P del comercio (generada en `merchant init`, Ed25519 via `hypercore-crypto`) y cubre todos los campos (monto, destinatario, txHash, etc.), asi que alterar cualquiera de ellos invalida la firma.
2. **Encadenamiento** - el campo `previousEventHash` del evento coincide con el hash del evento inmediatamente anterior en el almacen local; si alguien edita o reordena un evento previo, el siguiente deja de verificar.

Probe ambos casos manualmente: cadena valida de dos eventos, y luego edite a mano el monto del primer evento en `events.json` para confirmar que `receipt verify` detecta la firma invalida en ese evento **y** la ruptura del encadenamiento en el siguiente (exit code 1 en ambos casos). No use conexion RPC real para esto - la firma y el hash chain son 100% locales, asi que se pudo validar completo en este entorno pese a la restriccion de red.

**Nota:** el encadenamiento (`previousEventId`/`previousEventHash`) es *por comercio*, no global al archivo: cada identidad P2P encadena solo sus propios eventos anteriores. Este es un ajuste sobre la primera version de la Fase 4, necesario para que la Fase 5 (varios comercios escribiendo al mismo almacen local via sync) no rompa la cadena de nadie.

### Sincronizacion P2P (Fase 5)

```bash
# Terminal A
bare index.js sync --room tienda-demo

# Terminal B (otra carpeta/otro .tiendapay, red de prueba compartida)
bare index.js sync --room tienda-demo

# Solo descubrir quien esta en la sala, sin intercambiar eventos:
bare index.js peers --room tienda-demo
```

`sync` se une a una sala P2P via Hyperswarm (topic = hash de `tiendapay:ledger:<room>`, DHT publica). Al conectar con cada peer, ambos lados se mandan su libro mayor local completo como un mensaje JSON; cada evento recibido se verifica (firma + encadenamiento por comercio) antes de aceptarse, se ignoran los duplicados por `id`, y al final se listan los conflictos: mismo `invoiceId` con `txHash` distintos entre eventos de distintos comercios (posible doble registro), marcados para revision manual en vez de resolverse automaticamente.

**Simplificacion de diseño respecto al plan original:** en vez de que cada terminal tenga su propio Hypercore (feed append-only) y replicarlos entre si por clave publica (el patron estandar de Hypercore/corestore para multi-writer), implemente un intercambio directo de los eventos ya firmados (JSON delimitado por saltos de linea) sobre la conexion cifrada de Hyperswarm. La propiedad de seguridad que importa (que nadie pueda falsificar o alterar un evento) ya la da la firma Ed25519 de la Fase 4, que es independiente del transporte — un protocolo mas simple no resigna nada de eso. El resultado es mas facil de auditar y cubre el objetivo central de la Fase 5 ("replicacion de eventos, no sincronizacion de wallets"), y ya se probo funcionando de punta a punta contra la DHT real (ver arriba). Migrar a Hypercore+corestore por feed sigue siendo un paso valido si en algun momento hace falta el patron estandar (por ejemplo, para reproducir el historial completo de un peer nuevo en vez de solo el estado actual).

**Robustez de red:** `swarm.join(...).flushed()` y `swarm.destroy()` pueden colgarse indefinidamente si no se puede alcanzar el bootstrap de la DHT (lo confirme en este sandbox: sin el fix, `merchant peers` nunca terminaba). Por eso ninguno de los dos se espera de forma bloqueante; el comando siempre termina dentro de la ventana `--timeout` mas un margen fijo de limpieza, haya o no red disponible.

**Probado contra la red real:** dos identidades de comercio independientes (dos carpetas `.tiendapay` separadas) corriendo `sync --room` al mismo tiempo se descubrieron de verdad por la DHT, intercambiaron sus libros mayores, y detectaron correctamente un conflicto provocado a proposito (misma `invoiceId`, dos `txHash` distintos) en vez de pisarlo. El descubrimiento tardo ~60s, no los 20s por defecto — este entorno reporta `firewalled: true` / `NAT type: consistent` en la DHT, algo a tener en cuenta tambien en produccion, no solo aca. Detalle completo en `TESTING.md`.

### Consultas con QVAC (Fase 6)

```bash
bare index.js ask "que facturas estan pendientes?"
bare index.js ask "cuanto vendi en total?"
```

`ask` arma un contexto de texto con las facturas y el libro mayor local (`src/ai/context.js`), y se lo pasa a un modelo de lenguaje local via `@qvac/sdk` (`loadModel` + `completion`, modelo por defecto `LLAMA_3_2_1B_INST_Q4_0`, configurable con `QVAC_MODEL` en `.env`). Todo corre en la maquina, sin mandar datos a un servidor externo. QVAC es estrictamente un bonus de consulta: **si falla o no esta disponible, el resto de TiendaPay (pagos, ledger, sync) sigue funcionando igual** — `ask` nunca bloquea ni condiciona al resto de comandos.

**Probado de punta a punta contra la red real:**
- El armado del contexto (`src/ai/context.js`) es logica pura sin red: probado end-to-end con facturas reales.
- La carga del addon y el registro del plugin (`@qvac/sdk/plugins`, `@qvac/sdk/llamacpp-completion/plugin`) funcionan (el addon nativo `@qvac/llm-llamacpp`, ~520MB, viene incluido como dependencia transitiva de `@qvac/sdk`).
- La descarga del modelo (773MB, distribuida por el mismo registry P2P que usa Hyperswarm) **se completo** (~3 minutos con conectividad real) y `completion` devolvio una respuesta real basada en los datos locales.
- **Bug real encontrado y arreglado probando esto:** sin proteccion, `loadModel` se queda esperando la descarga para siempre si no hay red (se confirmo colgado hasta matarlo a mano). Se agrego un timeout configurable (`QVAC_LOAD_TIMEOUT_MS` en `.env`, default 120s) para que `ask` siempre termine con un mensaje claro en vez de colgarse — y en la practica hizo falta subirlo por encima del default, porque la descarga real tardo mas de 120s.
- Si `ask` falla por cualquier motivo (sin red, sin el addon instalado, timeout), imprime el error y ademas el contexto crudo que le hubiera mandado al modelo, para que el comando siga siendo util aunque la IA no responda.
- **Nota sobre calidad de respuesta:** con el modelo default (1B parametros, cuantizado Q4), la respuesta a preguntas concretas sobre el libro mayor puede ser poco precisa (ej. no sumar montos correctamente). Esto es una limitacion del tamaño del modelo, no un bug de la integracion — considerar un modelo mas grande si la precision importa mas que la velocidad/tamaño.

**Aviso de espacio en disco:** `@qvac/sdk` (el paquete "completo", pensado para Node/Expo) trae **todos** sus addons nativos como dependencias — llm, whisper, ocr, tts, difusion de imagenes, etc. — aunque solo se use uno. En este entorno, `npm install` con `@qvac/sdk` hizo crecer `node_modules` a **~6GB**. Para el CLI final via Pear conviene migrar a [`@qvac/bare-sdk`](https://www.npmjs.com/package/@qvac/bare-sdk) instalando *solo* `@qvac/llm-llamacpp` (el addon de completion, ~520MB) y armando un worker entry propio (`qvac/worker.pear.entry.mjs`, ver docs de `@qvac/bare-sdk`) — deje `@qvac/sdk` por simplicidad y porque tambien corre en Node (mas facil de probar en tu maquina), pero no lo instales si el espacio en disco es limitado.

### Configurar la wallet (WDK)

1. Copia `.env.example` a `.env`.
2. Genera una seed de prueba: `bare index.js wallet generate-seed` (o `pear run . -- wallet generate-seed`) y pegala en `MERCHANT_SEED_PHRASE`.
3. Define `WDK_RPC_URL` con el endpoint RPC de tu red EVM de prueba (ej. Sepolia).
4. Opcional: `WDK_USDT_CONTRACT` con la direccion del contrato USD₮ de esa red de prueba y `WDK_USDT_DECIMALS` (por defecto 6) si difiere.
5. `bare index.js wallet address` y `bare index.js wallet balance`.

La wallet usa `@tetherto/wdk` + `@tetherto/wdk-wallet-evm` (modulo EVM oficial de WDK). La derivacion de direcciones (`wallet address`) es local y no requiere red; `wallet balance` si necesita que `WDK_RPC_URL` sea alcanzable.

## Modelo de datos

`merchant init` genera una identidad P2P (par de claves Ed25519) y crea un almacen local en `./.tiendapay/`. Esa identidad firma los eventos del libro mayor (`.tiendapay/ledger/events.json`), que `merchant sync` replica entre terminales via Hyperswarm. Es independiente de la wallet de pagos (WDK), que deriva sus propias cuentas desde `MERCHANT_SEED_PHRASE`.

Cada evento del libro mayor sigue el modelo:

```json
{
  "id": "receipt_...",
  "type": "invoice_paid",
  "merchant": "<clave publica P2P del comercio>",
  "invoiceId": "inv_...",
  "amount": "12500000",
  "currency": "USDT",
  "decimals": 6,
  "chain": "testnet",
  "payer": "0x...",
  "recipient": "0x...",
  "txHash": "0x...",
  "createdAt": "2026-08-22T21:16:18.504Z",
  "previousEventId": "<id del evento anterior de este mismo comercio, o null si es el primero>",
  "previousEventHash": "<hash hex del evento anterior o null si es el primero>",
  "signature": "<firma hex sobre todo lo anterior>"
}
```

La serializacion es JSON canonico (claves ordenadas alfabeticamente, `src/ledger/canonical.js`) para que la firma sea determinista sin importar el orden de insercion de los campos. `previousEventId` permite ubicar el evento referenciado sin depender del orden de almacenamiento (importante una vez que el almacen mezcla eventos de varios comercios via sync); `previousEventHash` es la propiedad criptografica que efectivamente protege el encadenamiento.

## Release y OTA con Pear (Fase 7)

**Probado contra la red real** (no una guia teorica): `pear stage`, `pear seed` y `pear dump` corrieron de verdad contra la DHT. La CLI de Pear que esta disponible hoy (v3.2.0) cambio bastante respecto a lo que documentaba una version anterior de este archivo — el flujo real es distinto en varios puntos, detallados abajo.

### Config real en `package.json`

```json
"pear": {
  "name": "tiendapay",
  "stage": {
    "ignore": [".env", ".tiendapay", ".git"]
  }
}
```

`pear.stage.ignore` es importante por seguridad: `pear stage` no respeta `.gitignore`, tiene su propia lista de exclusion. Sin esto, `.env` (con la seed phrase) y `.tiendapay/` (con la clave secreta P2P) se publicarian tal cual al link de Pear, que es publico/distribuido por DHT. Se confirmo con `pear info --manifest` que ninguno de los dos aparece en lo publicado.

### Pasos reales (v3.2.0 del CLI de Pear)

```bash
# 1. Instalar el CLI de Pear (bootstrapea la primera vez que se corre)
pnpm add -g pear

# 2. Generar un link nuevo (reemplaza al viejo esquema de "canales" tipo `pear stage dev`)
pear touch
# -> pear://<key>

# 3. Stage: sincroniza el directorio actual a ese link
pear stage pear://<key>

# 4. Seed: hace que el link este disponible para otros peers via DHT
#    (tiene que seguir corriendo mientras alguien quiera instalar/actualizar)
pear seed pear://<key> --no-tty

# 5. Bajar el proyecto en otra carpeta/maquina, como lo haria otro peer
#    ("pear run" fue eliminado en esta version del CLI)
pear dump pear://<key> <carpeta-destino>
cd <carpeta-destino> && bare index.js help

# 6. Iterar: cualquier cambio + volver a "pear stage pear://<key>" (mismo link)
#    hace que la version en el drive avance; los peers que hagan "pear dump"
#    de nuevo (o instalen via pear-cli/, ver mas abajo) reciben el cambio.
```

**Diferencias reales encontradas respecto a documentacion mas vieja:**
- `pear stage <canal>` (nombre de canal tipo "dev"/"production") **ya no existe** — ahora siempre es `pear stage <link>`, con el link generado por `pear touch`.
- `pear run` **fue eliminado por completo** del CLI. El equivalente que si funciona es `pear dump <link> <carpeta>` (baja los archivos) + correr `bare index.js` ahi.
- `pear release` tambien fue eliminado. El modelo de "produccion" ahora es `pear provision` + `pear multisig` (firma por quorum) — investigado pero no implementado, ver "Limitaciones conocidas" abajo.

### CLI standalone instalable con `pear install` (Pear Track)

Ademas de lo anterior (que corre TiendaPay via `bare index.js`, requiere tener `bare` instalado), hay una entrega separada en [`pear-cli/`](pear-cli/): la misma CLI compilada como **binario standalone**, instalable con un solo comando y sin necesitar Node/Bare/Pear en la maquina que instala:

```bash
pear install pear://<pear-cli-key>
tiendapay-cli --version
```

Con actualizaciones OTA reales probadas de punta a punta (una copia instalada se actualizo sola en ~2 segundos tras stagear una version nueva). Detalle completo, incluidos dos bugs reales encontrados y arreglados en el proceso, en [`pear-cli/README.md`](pear-cli/README.md) y en `TESTING.md` seccion 8.

## Limitaciones conocidas

Esta lista refleja lo que **falta de verdad**, no lo que "no se pudo probar" — todo lo que sigue si se probo contra red real (ver `TESTING.md` para el detalle completo, comando por comando):

- No hay direccion de contrato USD₮ de testnet precargada por defecto: hay que configurar `WDK_USDT_CONTRACT` con la del token de prueba que uses (evita asumir una direccion incorrecta en la demo). En Sepolia se uso un `ERC20Mock` con `mint(address,uint256)` publico para autoabastecerse de tokens de prueba — ver `TESTING.md` seccion 2.
- `pay` marca una factura como `submitted` en cuanto WDK transmite la transaccion (`eth_sendRawTransaction`), no espera confirmaciones on-chain; el ledger tampoco tiene un estado `confirmed` todavia (solo registra que se transmitio, con su `txHash`).
- El modelo QVAC por defecto (1B parametros, cuantizado) puede dar respuestas poco precisas sobre datos numericos del ledger (ver nota en la seccion QVAC arriba) — no es un bug, es una limitacion de tamaño del modelo.
- El flujo de "produccion" con multisig de Pear (`pear provision` + `pear multisig`) se investigo pero no se implemento — se decidio que no vale la pena la complejidad de gobernanza de releases para el tamaño actual del proyecto. Detalle completo en `TESTING.md` seccion 7.
- La CLI standalone de `pear-cli/` (Pear Track) solo se buildeo para **linux-x64** — hace falta un host macOS/Windows (o CI) para generar esos binarios.
- El `pear seed` de cualquiera de los links (landing/app o `pear-cli/`) tiene que seguir corriendo en una maquina que se mantenga prendida durante el periodo de judging — un sandbox de desarrollo efimero no alcanza para eso.

## Seguridad

- `.tiendapay/` (identidad P2P) y `.env` (seed phrase de la wallet) contienen material sensible y estan excluidos de git via `.gitignore`. Nunca los commitees.
- `wallet generate-seed` es solo para desarrollo/testnet: nunca uses esa seed en mainnet ni la muestres en una demo grabada.
- No se muestran seed phrases reales en la documentacion ni en las demos.

## Estructura del proyecto

```
index.js              Punto de entrada (Bare o Pear)
src/
  cli.js               Enrutador de comandos
  commands/            Un archivo por comando del CLI (init, wallet, invoice, pay, ledger, receipt, sync, peers, ask...)
  payments/wdk.js       Integracion con WDK (wallet, balance, transferencias)
  invoices/store.js      Almacen local de facturas
  ledger/                Eventos firmados (creacion, verificacion, almacen)
  p2p/                    Sincronizacion via Hyperswarm (protocolo, fusion, swarm)
  ai/                     Contexto + integracion con QVAC para "merchant ask"
  util/                   Helpers compartidos (flags, .env, formato de montos, paths)
public/
  index.html             Landing page (autocontenida)
  assets/                 Logo y miniatura de la landing
pear-cli/                Pear Track: CLI standalone instalable con "pear install" + OTA (ver su propio README)
```

El detalle completo de cada modulo, el modelo de datos y las decisiones de diseño estan en [`architecture.md`](architecture.md).

## Licencia

MIT — ver el campo `license` en `package.json`.
