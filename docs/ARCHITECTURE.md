# Arquitectura WMS (implementada)

Ver `docs/TARGET_ARCHITECTURE.md` y `docs/ARCHITECTURE_AUDIT.md`.

DEMO: `WmsSnapshot` + funciones puras. PRODUCTION: mismas reglas de dominio; persistencia `wms_*` + RLS (`wms_org_ids` / `wms_has`).

Control Tower: `computeTowerActions` (ASIGNAR_PICKER, LANZAR_OLA, REPOSICION, CORTE_FEFO, BLOQUEO_MUELLE).
Copiloto: `answerWmsCopilot` → `{ finding, evidence, confidence, recommendation, optional_action }`.
