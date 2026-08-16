# Copilot de planta — Campo Norte WMS

No es un chatbot genérico. Lee el snapshot y responde cinco preguntas.

| Pregunta | Fuente |
|---|---|
| ¿Qué expediciones están en riesgo? | `outbound` cut-off ≤2 h, status ≠ pendiente/expedido |
| ¿Qué SKUs tienen riesgo de ruptura? | qty viva vs `minStock` |
| ¿Dónde debería colocar este SKU? | `suggestPutawaySlot` + zona de categoría. Exige código/nombre |
| ¿Qué wave debería priorizar? | líneas reales + cut-off. No «38» si la ola tiene 8 |
| ¿Qué está causando retrasos? | ASN tardíos, cut-off vencido, `slotFixes` |

Cada respuesta:

`finding` · `evidence` · `confidence` · `recommendation` · `optional_action`

`optional_action.requiresConfirmation = true`. `requireConfirmation(false)` bloquea. La IA **no** pica, no expide, no asigna sola: abre pantalla tras el segundo clic.

Motor: `src/lib/wms/copilot.ts`. UI: `WmsCopilot.tsx`. Sin LLM.
