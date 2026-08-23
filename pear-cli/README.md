# CLIQ CLI — Pear Track submission

Entrega para el track "Pears" (Tether) de Aleph Hackathon 2026: la CLI real de [CLIQ](../README.md) empaquetada como binario standalone e instalable P2P con `pear install`, con actualizaciones OTA.

## De dónde parte

Arranca desde el boilerplate oficial [`hello-pear-bare`](https://github.com/holepunchto/hello-pear-bare), rama **`variant/daemon`** — pensada para comandos cortos tipo git (el proceso corre y termina mientras un daemon desprendido chequea updates en background), que es exactamente el patrón de uso de CLIQ (`invoice create`, `pay`, etc.), a diferencia de un TUI/servicio de larga vida.

Se mantuvo intacto el mecanismo de updates del boilerplate (`bin.mjs` / `app.js`, basado en `pear-runtime` + `bare-daemon`). Lo que se agregó es el CLI real de CLIQ (`src/`, portado 1:1 desde la raíz del repo) conectado como el comando que corre después de que el updater arranca en background.

## Qué incluye (y qué no)

Incluye todo CLIQ **excepto el asistente `ask` (QVAC)**:

- `init`, `wallet address/balance/generate-seed`
- `invoice create/show`, `pay`, `ledger`
- `receipt show/verify`
- `sync --room`, `peers --room`

Se excluyó `ask` porque `@qvac/sdk` pesa ~6GB con binarios nativos para todas las plataformas — es el mayor riesgo de que el build standalone (`bare-build`) falle o tarde demasiado bajo el reloj del hackathon, y no aporta nada a la validación de "instala + actualiza OTA" que pide este track.

## Cómo instalarlo (igual que lo haría un juez)

```
pear install pear://yfaoocfpgnqxawjgx9bkakq4fx3tur856enabkmg847rfmts36oo
```

Esto descarga el binario standalone (~119MB, sin necesitar Node/Bare/Pear instalados) directamente de un peer y lo deja listo para usar:

```
cliq-cli --version
cliq-cli --no-updates help
cliq-cli --no-updates wallet generate-seed
```

`--no-updates` es opcional — sin ese flag, cada corrida dispara en background un chequeo de actualización OTA sobre el mismo link.

## Build local (para reproducir el binario)

```
cd pear-cli
pnpm install
# pnpm es estricto con node_modules; bare-pack (usado por bare-build) espera
# resolución estilo flat/npm. Por eso hay un .npmrc con shamefully-hoist=true.
# Además, 'ws' (dependencia transitiva de @tetherto/wdk) intenta requerir
# 'utf-8-validate' y 'bufferutil' de forma opcional (try/catch) — bare-pack
# igual necesita resolverlos estaticamente. Hay stubs minimos en
# node_modules/{utf-8-validate,bufferutil} que hay que recrear tras cada
# reinstall (no son paquetes reales de npm, son shims locales).
npm run make:linux-x64   # o make:darwin-*/win32-* en el host correspondiente
```

El binario resultante (`out/linux-x64/cliq`) se copia a `deploy/by-arch/<host>/app/cliq-cli` — esa es la estructura de carpetas que `pear install` espera (`/by-arch/<plataforma>-<arch>/app/<name>`, con `<name>` = el campo `"name"` de `deploy/package.json`). Se stagea parado en `deploy/` (que tiene su propio `package.json`, separado del de desarrollo) para no subir accidentalmente `node_modules`/`src` al drive — solo el binario final.

## Plataformas buildeadas

Solo **linux-x64** — este entorno de desarrollo (sandbox headless) no tiene los SDKs de macOS/Windows para cross-compilar con `bare-build`. Para tener los otros binarios hay que correr `npm run make:darwin-arm64` / `make:win32-x64` / etc. desde un host de esa plataforma (o CI con esos runners) y copiarlos a su propia carpeta `by-arch/<host>/app/`.

## Estado de las actualizaciones OTA

**Validado de punta a punta contra una instalación real.** Con `cliq-cli` instalado vía `pear install` en `0.0.4`, se stageó una `0.0.5` nueva en el mismo link, y se corrió el daemon de update sobre la copia instalada (`cliq-cli --updater --storage <dir> --update-window 150000`). Log real:

```
info  [updater] getting new update
info  [updater] { op: 'add', key: '/by-arch/linux-x64/app/cliq-cli', bytesAdded: 119309064 }
info  [updater] update complete... applying
info  [updater] applied update, restart to run latest version
```

`cliq-cli --version` pasó de `0.0.4` a `0.0.5` solo, en ~2 segundos una vez que arrancó el chequeo — nada de lentitud de red real.

Dos bugs reales aparecieron y se corrigieron en el camino:

1. **`--update-window` es en milisegundos, no segundos** (así lo indica su propio `--help`). Pasar `90`/`180` (o sea, 90-180*ms*) hacía que el updater se cerrara casi al instante, antes de que el swarm llegue a conectar con ningún peer — parecía "no encuentra nada" pero en realidad nunca tuvo tiempo de intentarlo.
2. **`productName` vs `name` en `package.json`**: `bin.mjs` armaba el nombre del updater con `pkg.productName` ("cliq"), pero `pear install` arma la ruta del binario en el drive con `pkg.name` ("cliq-cli") — el updater buscaba `/by-arch/linux-x64/app/cliq` cuando el archivo real vivía en `/by-arch/linux-x64/app/cliq-cli`, y tiraba `Error: update not found`. Se arregló usando `pkg.name` consistentemente en `bin.mjs`.

## Mantener seedeado

Mientras se evalúa este track hace falta un `pear seed` corriendo en una máquina que se mantenga encendida (no alcanza con este sandbox, que es efímero):

```
pear seed pear://yfaoocfpgnqxawjgx9bkakq4fx3tur856enabkmg847rfmts36oo --no-tty
```
