# GS1 / códigos de barras

Módulo: `src/infrastructure/barcode/`. **Ninguna pantalla lo importa.**

`parseBarcode` extrae, si vienen:

- GTIN (`01` / EAN-13)
- LOT (`10`)
- EXP (`17` / `15` → ISO)
- SSCC (`00` o 18 dígitos)
- SERIAL (`21`)

Simbologías reconocidas: EAN-13, EAN-128, GS1-128, SSCC, GTIN. DataMatrix = mismo payload GS1 cuando el escáner entrega AIs.

No genera SSCC. `gs1CheckDigitOk` solo valida.

La pistola sigue clasificando «¿es hueco o SSCC?» en `rf.ts`. Cuando se cablee, RF llamará a este parser; no al revés.
