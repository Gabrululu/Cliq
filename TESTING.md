# Pendientes de validación con red real

El proyecto vive comprimido en `tiendapaychanges.zip` (aún no descomprimido en este repo). Antes de descomprimir/instalar, confirmar si hace falta liberar espacio en disco para `@qvac/sdk` (~6GB) o si migramos a `@qvac/bare-sdk`.

Este checklist junta todo lo que quedó marcado como "no probado por la red del sandbox" a lo largo de las 7 fases. Usar `pnpm` en vez de `npm` salvo donde se indique lo contrario (herramientas globales `bare`/`pear` y comandos `bare`/`pear` en sí).

## 1. Instalación limpia (nunca se hizo desde cero en otra máquina)

```
git clone <tu-repo>
cd TiendaPay
pnpm add -g bare pear   # herramientas globales, no vienen en package.json
pnpm install
bare index.js help
```

- [x] Confirmar que no falta ningún paso de setup asumido en un entorno ya semi-armado. (2026-08-23: hubo un paso extra no documentado — `pnpm setup` para crear `PNPM_HOME`, ya que `pnpm add -g` fallaba con `ERR_PNPM_NO_GLOBAL_BIN_DIR` sin él).
- [x] Confirmar espacio en disco disponible para `@qvac/sdk` (o decidir migrar a `@qvac/bare-sdk`). (2026-08-23: `node_modules` quedó en 4.4GB, 15GB libres tras la instalación — no hizo falta migrar).

## 2. Pagos reales con WDK (Fase 2-3)

Nunca se probó contra una red de verdad — el sandbox bloqueaba toda conexión RPC saliente.

```
# .env con un WDK_RPC_URL real (ej. Sepolia) y una wallet de testnet fondeada
bare index.js wallet balance
bare index.js invoice create --amount 5.00
bare index.js pay <invoice-id>            # cotización
bare index.js pay <invoice-id> --yes      # envío real
```

Necesario: un RPC de testnet funcionando, la wallet de `--from-index 1` fondeada con USDT de prueba y con el token nativo para el gas, y `WDK_USDT_CONTRACT` apuntando al contrato correcto de esa red.

- [x] `wallet balance` no rompe. (2026-08-23: Sepolia real vía `https://ethereum-sepolia-rpc.publicnode.com`, contrato USDT de prueba `ERC20Mock` en `0xc4dcc311c028e341fd8602d8eb89c5de94625927`, minteado 1000 USD₮ a la cuenta 1).
- [x] `pay --yes` devuelve un `txHash` real. (2026-08-23: `inv_64375ac6c4f9` → tx `0x636f6155235cbf825783a3970df8e138eeb13b2bb45d92360c691710752974bb`).
- [x] El `txHash` queda persistido en la factura y en el recibo firmado. (2026-08-23: confirmado con `invoice show` y `receipt verify` — firma y encadenamiento OK).

Nota: el segundo contrato que pasó el usuario (`0xd077A400968890Eacc75cdc901F0356c943e4fDb`, "Tether USD", `TransparentUpgradeableProxy`) no se usó — no tiene un `mint` público conocido, mientras que `0xc4dcc311c028e341fd8602d8eb89c5de94625927` es un `ERC20Mock` verificado con `mint(address,uint256)` sin restricción de owner, ideal para autoabastecerse de tokens de prueba.

## 3. Sincronización P2P (Fase 5) — necesita dos máquinas o carpetas

```
# Terminal/máquina A
bare index.js sync --room demo

# Terminal/máquina B (con red abierta a la DHT)
bare index.js sync --room demo
```

- [x] Ambos terminales se descubren entre sí (no solo que el comando termina sin colgarse, eso ya está probado). (2026-08-23: probado con dos identidades independientes — dos carpetas (`/tmp/tp-peer-a`, `/tmp/tp-peer-b`), cada una con su propio `.tiendapay` vía `merchant init` — corriendo `sync --room demo` en simultáneo en el mismo host. **Con `--timeout 25000` no se descubrieron (0 peers)**; con **`--timeout 60000` sí** — "Peer conectado" en ambos lados. Este entorno reporta `firewalled true` / `NAT type consistent` en el DHT (visto en logs de `pear`/`pear seed`), lo que probablemente explica que el hole-punching tarde más de lo esperado. Recomendación: si en producción los comercios están detrás de NATs restrictivas, contemplar un timeout mayor a los 20s por defecto del comando `sync`, o reintentos).
- [x] Los eventos de un lado aparecen en el ledger del otro. (2026-08-23: cada peer creó un evento `invoice_paid` único —`inv_a_only` en A, `inv_b_only` en B— directamente vía `ledger.createEvent` (sin pasar por pago real, para aislar la prueba de sync/merge de la de WDK ya cubierta en #2). Tras el `sync`, ambos ledgers quedaron con los 4 recibos: los 2 propios + los 2 del otro comercio, verificado con `merchant ledger` en ambos lados).
- [x] Provocar un conflicto a propósito (misma `invoiceId`, dos `txHash` distintos desde comercios distintos) y confirmar que `sync` lo reporta en vez de pisarlo silenciosamente. (2026-08-23: ambos peers crearon un evento con `invoiceId: inv_conflict_test` pero `txHash` distinto. Tras el sync, **ambos lados reportaron el conflicto correctamente** en la sección "Conflictos detectados" con los dos `receipt_id`/`txHash`/comercio enfrentados, y ninguno de los dos eventos se sobreescribió — los dos quedaron guardados en el ledger de ambos peers).

## 4. Asistente QVAC (Fase 6)

```
bare index.js ask "cuanto vendi hoy?"
```

La descarga del modelo (773MB, vía la misma red P2P) nunca terminó en el sandbox. Con red real debería completarse (puede tardar según el ancho de banda) y devolver una respuesta coherente basada en los datos propios. Si tarda más de 120s, subir `QVAC_LOAD_TIMEOUT_MS` en `.env`.

- [x] La descarga del modelo termina. (2026-08-23: completó los 773MB vía el registry P2P de QVAC en ~3 minutos con conectividad real — más de los 120s del timeout original, por eso hubo que subir `QVAC_LOAD_TIMEOUT_MS` a 600000 en `.env` antes de correrlo. El log del progreso confirma que el mecanismo de descarga funciona (fue subiendo de 0% a 100% de forma constante), y después cargó el modelo (logs de `llama.cpp` repackeando tensores) sin errores).
- [~] La respuesta es coherente con los datos reales. (2026-08-23: **parcialmente** — el pipeline funciona (devolvió texto en español, sin crashear), pero el contenido no fue del todo preciso: para la pregunta "cuanto vendi hoy?", con una factura real pagada (5 USDT, `inv_64375ac6c4f9`, status `submitted`) en el contexto que se le pasó, el modelo respondió que "no tengo información sobre las transacciones" y calificó la factura como "pendiente" cuando en realidad estaba pagada, sin sumar el monto. Es esperable dado que es un modelo muy chico (1B parámetros, cuantizado Q4) — vale la pena decidir si alcanza para el caso de uso o si conviene un modelo más grande/otro prompt, pero **no es un bug de la integración QVAC en sí** — la descarga, carga e inferencia funcionaron correctamente de punta a punta).

## 5. Distribución con Pear (Fase 7) — no se ejecutó ni un solo comando `pear`

```
pear --version          # primer chequeo: ¿siquiera bootstrapea?
pear stage dev
pear run pear://<key-que-imprime-stage>   # desde otra carpeta/máquina
```

Flujo completo de "producción" + actualización OTA:

```
pear stage production
pear release production
pear seed production
# cambiás algo chico, repetís stage+seed, y confirmás que el peer que ya instaló recibe el cambio
```

Chequeo de seguridad importante:

```
pear info --manifest
```

`pear.stage.ignore` ya está configurado para excluir `.env` y `.tiendapay/`, pero nunca se ejecutó este comando para confirmarlo.

- [x] `pear --version` bootstrapea correctamente. (2026-08-23: se instaló solo con `pnpm add -g pear`, primer `pear -v` dispara un bootstrap propio de Holepunch. Ojo: el flag correcto en esta versión (v3.2.0) es `-v`, no `--version`).
- [x] `pear stage dev` + `pear run pear://...` funciona desde otra carpeta/máquina. (2026-08-23: **el CLI de Pear cambió dos veces respecto al checklist original**: (1) `pear stage dev` ya no acepta nombres de canal, pide un `<link>` generado con `pear touch`; (2) **`pear run` fue eliminado** — el CLI devuelve "pear run has been removed. Use the pear-runtime module instead". El equivalente que sí funciona para bajar+correr la app como otro peer es `pear dump <link> <dir>` seguido de `bare index.js help` desde esa carpeta — probado en `/tmp/pear-run-test` (otra carpeta, mismo host) y funcionó: trajo `src/`, `node_modules/`, etc., sin `.env` ni `.tiendapay/`, y el CLI corrió normal. Link final: `pear://dtb98ajx6wkg8cbw9zmpabd95ie4ipkj5dq18da3frk6o34ixczo`. Nota: fue en la misma máquina, no se probó cruzando dos hosts físicos distintos — si el proyecto sigue orientándose a apps de escritorio, revisar si conviene usar `pear install` en vez de `dump` para ese caso).
- [~] Flujo `stage` → `release` → `seed` en producción funciona. (2026-08-23: **`pear release` fue eliminado por completo** en esta versión — `Unrecognized Argument`. El modelo de "canal de producción" del checklist original ya no existe así de simple: ahora "producción" se maneja con `pear provision <source-verlink> <target-link> <production-verlink>` + `pear multisig` (firma criptográfica por quorum, requiere configurar `multisig.publicKeys` / `namespace` / `quorum` en `pear.json`, que este proyecto no tiene). Es un cambio de flujo, no solo de sintaxis — requiere decisión de producto sobre si vale la pena montar multisig para este proyecto o si alcanza con seed/dump directo sobre un link único. `pear seed <link>` en sí sí funciona tal cual (probado, ver abajo) — lo que no existe es el paso intermedio de "release").
- [x] Un cambio chico se propaga vía OTA a un peer que ya había instalado. (2026-08-23: se bumpeó `package.json` version 0.0.1→0.0.2, se re-stageó el mismo link con `pear stage <link> --only package.json` — pasó de versión interna 8498→8499 —, y desde la carpeta peer (`/tmp/pear-run-test`, que ya tenía la app) se corrió `pear dump <link> . --force`: solo resincronizó `/package.json` y el peer terminó con `0.0.2`. Se revirtió el version bump después de la prueba).

**`pear seed` (probado por separado):** `pear seed pear://dtb98ajx6wkg8cbw9zmpabd95ie4ipkj5dq18da3frk6o34ixczo --no-tty` corre, anuncia el link en la red y queda sirviendo bloques ("0 peers" porque no había otro nodo real conectándose, pero el anuncio y el logging de `whoami`/`discovery key`/etc. funcionaron sin errores).
- [x] `pear info --manifest` NO lista `.env` ni `.tiendapay/`. (2026-08-23: confirmado — el manifiesto solo repite la config `pear.stage.ignore` de `package.json`; en el diff del stage no aparecieron esos archivos, solo `.env.example`).

**Nota sobre disco:** el `pear stage` de este proyecto sube `node_modules/` completo (incluidos los prebuilds nativos de `@qvac` para todas las plataformas) porque Pear empaqueta las dependencias para distribuir la app corriendo, no solo el código fuente. Esto hizo crecer el store interno de Pear (`~/.config/pear`) en ~3.4GB adicionales durante el staging. Disco libre bajó de 15GB (post `pnpm install`) a **7.6GB** tras este único `stage`. Si se van a hacer varios ciclos de `stage`/`release`/`seed`, conviene monitorear el disco o evaluar migrar a `@qvac/bare-sdk` antes de seguir.

**⚠️ No mover el store de Pear (`~/.config/pear`) a otro filesystem/dispositivo.** Se intentó reubicarlo a `/tmp` (otro device en este entorno) para liberar espacio, y Pear lo detectó y rompió el sidecar: `Error: Invalid device file, was modified` (graba un identificador de dispositivo en su RocksDB interno y se niega a arrancar si detecta que cambió). Hubo que descartar ese store (`rm -rf`, se perdió el link/versión ya stageado) y re-bootstrapear Pear desde cero. El store de **pnpm sí se pudo mover sin problema** (`pnpm store status` confirmó integridad tras el move) — la diferencia es de diseño: pnpm es puramente content-addressable, Pear ata su storage a un dispositivo físico. Si hace falta más espacio para Pear, la única vía segura es limpiar con `pear gc cores <link>` (borra cores huérfanos de un link específico) o reducir lo que se stagea, no reubicar el directorio.

## 6. Ya cerrado (no hace falta re-probar)

- CLI completo sin red (`init`, `wallet address`, `invoice create/show`, `ledger`, `receipt show/verify`) — probado en vivo, incluida la detección de manipulación del ledger.
- Toda la lógica de fusión P2P (firma, dedupe, conflictos) — probada simulando dos identidades directamente.
- Responsive de la landing (320px a 1440px, claro y oscuro) — probado con Playwright, cero overflow.

## 7. Multisig / producción con Pear — investigación para el futuro (no implementado)

**Decisión (2026-08-23): no se monta multisig por ahora.** Es infraestructura pensada para cuando varias partes independientes deben co-firmar antes de que un release llegue a producción (quorum N-de-M). Para el tamaño actual del proyecto, alcanza con seguir usando un único link estable vía `stage`+`seed` (ya validado en la sección 5). Trade-off a tener presente: sin multisig, cualquiera con acceso al link de staging puede publicar una actualización que los peers reciben automáticamente vía OTA, sin ninguna revisión intermedia. Si en el futuro entran más manos al proyecto o se necesita ese control, esto es lo que hay que armar:

### Cómo se configura (Pear v3.2.0)

1. **Definir el quorum en `pear.json`** (no existe en este proyecto todavía):
   ```json
   {
     "multisig": {
       "publicKeys": ["<pubkey1>", "<pubkey2>", "<pubkey3>"],
       "namespace": "tiendapay",
       "quorum": 2
     }
   }
   ```
   Con esto, 2 de 3 claves listadas deben firmar para que un release se considere válido.

2. **Generar/gestionar claves de firma**: `pear multisig keys <get|paths|list|add|remove>`. `get` inicializa una clave local si no existe; `paths` muestra dónde vive (pública/privada); cada persona que va a co-firmar necesita la suya, y su clave pública es la que se agrega a `publicKeys` en `pear.json`.

3. **Obtener el link multisig del proyecto**: `pear multisig link` — se deriva de `publicKeys` + `quorum` + `namespace` de `pear.json` (soporta `--vanity` para un prefijo elegido). Este es el link de "producción" que los usuarios finales van a instalar/seguir.

4. **Preparar un target pre-producción**: `pear touch` genera un link nuevo, y `pear provision <source-verlink> <target-link> <production-verlink>` sincroniza bloques desde el link de staging (versionado, ej. `pear://0.8499.<key>`) hacia ese target, dejándolo listo para pedir firmas contra el link de producción real.

5. **Ciclo de firma**:
   - `pear multisig request <verlink>` — crea una solicitud de firma para sincronizar un link versionado al link multisig del proyecto. Devuelve un `<request>` para repartir a los firmantes.
   - `pear multisig sign <request> [nombre-clave=default]` — cada firmante corre esto con su clave local; devuelve una `response` de firma.
   - `pear multisig verify <source-link> <request> [...responses]` — junta las respuestas recolectadas y hace un dry-run del commit para chequear que el quorum se cumple antes de aplicarlo de verdad.
   - `pear multisig commit <source-link> <request> [...responses]` — aplica las firmas y habilita la sincronización real desde el link de staging hacia el link multisig (recién ahí el cambio queda "en producción").

Ninguno de estos comandos se ejecutó en la práctica (solo se revisó su `--help`); si en el futuro se decide adoptarlo, falta un ensayo end-to-end con 2+ identidades de firma reales, similar a como se probó el sync P2P en la sección 3.

## 8. Pear Track (Tether) — CLI instalable con `pear install` + OTA real

Track separado del hackathon con su propio brief: "Build a standalone CLI tool, deploy it with the Pear CLI, and make it installable with `pear install`, with peer-to-peer OTA updates", arrancando desde el boilerplate oficial `hello-pear-bare`. Vive en [`pear-cli/`](pear-cli/) (subcarpeta de este mismo repo) — detalle completo en [`pear-cli/README.md`](pear-cli/README.md). Esto es una entrega distinta a la sección 5 (que probaba el `stage`/`seed`/`dump` de la app "normal" corriendo con `bare`); acá el requisito duro es un **binario standalone real**, instalable sin Node/Bare/Pear.

- [x] Arranca desde `hello-pear-bare` rama `variant/daemon` (pensada para comandos cortos tipo git — el patrón real de uso de TiendaPay), con el CLI real portado (todo menos `ask`/QVAC, excluido por el peso de `@qvac/sdk`).
- [x] `bare-build` genera un binario standalone linux-x64 (~119MB) que corre sin ningún `node_modules` al lado — probado en una carpeta vacía.
- [x] `pear install pear://<key>` instala de verdad, vía P2P real (con un `pear seed` corriendo), directo a `~/.local/bin/`. (2026-08-23: confirmado con `pear install` descargando a ~45MB/s desde el propio seed).
- [x] **OTA real**: con una copia instalada en `0.0.4`, se stageó `0.0.5` en el mismo link, y la copia instalada se actualizó **sola** en ~2 segundos (`updating → updating-delta → updated → update-applied`, log real en `pear-cli/README.md`). Confirmado corriendo `--version` antes y después.

**Dos bugs reales encontrados y arreglados en el camino** (documentados con más detalle en `pear-cli/README.md`):
1. `--update-window` es en **milisegundos**, no segundos — pasarle `90`/`180` (interpretados como 90-180ms) hacía que el updater se cerrara antes de que el swarm llegara a conectar con nada, pareciendo "no encuentra peers" cuando en realidad nunca tuvo tiempo de intentarlo.
2. `bin.mjs` armaba el nombre del binario a buscar con `pkg.productName` ("tiendapay"), pero `pear install` arma esa ruta con `pkg.name` ("tiendapay-cli") — mismatch que tiraba `Error: update not found`. Se corrigió usando `pkg.name` consistentemente.

**Pendiente / limitaciones conocidas:**
- Solo se buildeó **linux-x64** — este entorno no tiene los SDKs de macOS/Windows para cross-compilar con `bare-build`.
- El `pear seed` de este link necesita seguir corriendo en una máquina que se mantenga prendida durante todo el judging — este sandbox es efímero, no sirve para eso.
- Falta grabar el video demo (instalación + update OTA en vivo) — eso lo tiene que hacer el usuario.

## 9. WDK Track (Tether) — agente con guardrails sobre `@tetherto/wdk-cli` + MCP

Track separado, mismo sponsor que Pears. Regla del brief: "Pick one prize track and go deep" — se priorizó **Track 1 (CLI + MCP, $1000)** sobre Track 2 (gasless, $500) porque no depende de ningún servicio externo nuevo (Track 2 necesita un paymaster propio de Candide/Pimlico, y ademas se encontró que el USD₮ "oficial" que el paymaster público de Sepolia exige tiene el `mint` restringido a una wallet que no controlamos — ver hallazgo abajo).

**Qué se construyó**: `merchant agent settle <invoice-id> [--yes] [--json]` (`src/commands/agent.js`) — un comando nuevo que paga una factura de TiendaPay usando `@tetherto/wdk-cli` (no el SDK crudo `@tetherto/wdk` que ya usa `pay.js` — es una pieza nueva y central, no un wrapper decorativo), con guardrails **en código, no en un prompt**:
1. Tope de gasto (`AGENT_SPEND_CAP_USDT`) — rechazado antes de llamar a `wdk send` si la factura lo supera.
2. Allowlist implícita — el destinatario es siempre `invoice.recipient`, nunca un parámetro libre.
3. Confirmación explícita — sin `--yes` solo cotiza (`wdk send --dry-run`), igual patrón que `pay <id>`/`pay <id> --yes`.

Expuesto a un agente vía un servidor MCP propio (`mcp/server.js`, Node.js — no Bare, por compatibilidad con `@modelcontextprotocol/sdk`) con dos tools: `quote_invoice_payment` y `confirm_invoice_payment`. Cada una solo recibe un `invoiceId`; el servidor no reimplementa ninguna lógica, solo invoca `bare index.js agent settle ...` y devuelve el resultado.

**Validado de punta a punta (2026-08-23), contra la wallet real ya fondeada en Sepolia**:
- [x] `wdk wallet import --seed-stdin` con el mismo `MERCHANT_SEED_PHRASE` de `.env` → misma wallet exacta confirmada (`wdk get address --index 1` devuelve `0x86aCC9bc...`, la misma que veníamos usando).
- [x] `wdk get balance --token tpusdt --index 1` lee el balance real (990 tpUSDT, coincide con lo que quedó tras los pagos de la sección 2).
- [x] `agent settle <id>` sin `--yes` cotiza vía `wdk send --dry-run` (monto + comisión real estimada), no manda nada.
- [x] `agent settle <id> --yes` manda de verdad — `txHash` real, recibo firmado y encadenado igual que con `pay` (mismo `receipt verify` con firma y encadenamiento OK).
- [x] Guardrail de tope: una factura de 50 USDT (tope configurado en 10) se rechaza **antes** de invocar `wdk send`, con o sin `--yes`.
- [x] Probado tanto por CLI directa como a través del servidor MCP real (con un cliente MCP de prueba: `listTools` devuelve las dos tools, `callTool` en ambos casos — cotización y rechazo por guardrail — devuelve exactamente el mismo resultado que la CLI).

**Hallazgo importante (no bloquea Track 1, sí a Track 2 por ahora)**: el token USD₮ "oficial" que `wdk-cli` reconoce built-in para Sepolia (`0xd077A400968890Eacc75cdc901F0356c943e4fDb`, el mismo que exige el paymaster público de Candide preconfigurado en la network `smart-account-sepolia`) tiene su función `mint` restringida a una wallet que no controlamos (`Ownable: caller is not the owner`, verificado con `eth_call` directo). Por eso el `agent settle` usa nuestro propio `ERC20Mock` de la sección 2 bajo un símbolo custom (`tpusdt`, agregado con `wdk token add`), no el `usdt` built-in.

## Orden sugerido

1. **#2 Pagos** (WDK contra red real).
2. **#5 Pear** — es la más "nueva", nunca corrió ni una vez.
3. **#3 Sync** — dejarla para el final porque necesita coordinar dos máquinas al mismo tiempo.
