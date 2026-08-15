import type { Lang } from "@/lib/i18n";

export type PitchBlock =
  | { type: "quote"; text: string }
  | { type: "text"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "metrics"; items: { label: string; value: string; hint?: string }[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "cards"; items: { title: string; body: string; tone?: "brand" | "good" | "warn" }[] }
  | { type: "steps"; items: string[] }
  | { type: "matrix"; cells: { title: string; body: string; quadrant: "hi-lo" | "hi-hi" | "lo-lo" | "lo-hi" }[] };

export type PitchSlide = {
  kicker?: string;
  title: string;
  subtitle?: string;
  blocks: PitchBlock[];
  footer?: string;
};

/**
 * Presentación para entrevista con el CEO.
 * Lenguaje de negocio, sin jerga técnica. La demo del CRM se enseña aparte.
 */
const es: PitchSlide[] = [
  {
    kicker: "Producto · Campo Norte",
    title: "Crecer sin perder lo que os hace únicos",
    subtitle:
      "Un sistema interno para ordenar el negocio, liberar tiempo de Sofía y llegar al millón — sin que ninguna máquina hable con el viajero.",
    blocks: [
      {
        type: "text",
        text: "Equipo demo · Growth OS · demo de producto",
      },
      {
        type: "bullets",
        items: [
          "Ya hay un demo vivo para enseñar en la reunión: example.com",
          "Login del equipo · leads · clientes · reservas · números · facturas · contenido",
          "Regla de oro: los sistemas preparan; las personas firman la relación",
        ],
      },
    ],
    footer: "Ningún sistema habla nunca con un cliente.",
  },
  {
    kicker: "La idea central",
    title: "No os falta marketing. Os falta memoria y tiempo.",
    blocks: [
      {
        type: "quote",
        text: "El producto es 5 estrellas. El cuello de botella es el día a día: datos sueltos y todo pasando por Sofía.",
      },
      {
        type: "bullets",
        items: [
          "Los viajes se venden solos por calidad — el sistema detrás no acompaña",
          "Excel + correo de Sofía + newsletter = nadie ve el negocio entero",
          "Sofía tria leads, hace seguimiento y piensa contenido: horas que deberían ir a cerrar y cuidar",
        ],
      },
    ],
  },
  {
    kicker: "Los números",
    title: "De 800.000 € a 1.000.000 €",
    subtitle: "Las mismas cifras del business case. También están en el Dashboard del demo.",
    blocks: [
      {
        type: "table",
        headers: ["Dato", "Hoy", "Meta 2027"],
        rows: [
          ["Facturación", "800.000 €", "1.000.000 €"],
          ["Viajeros", "150", "168"],
          ["Salidas", "10", "14"],
          ["Ticket medio", "5.300 €", "5.950 €"],
          ["Margen por salida", "casi no se mide", "alrededor del 30 %"],
        ],
      },
      {
        type: "metrics",
        items: [
          { label: "El hueco", value: "200.000 €", hint: "Un +25 % en dos años" },
          { label: "Dónde verlo", value: "Dashboard", hint: "Una pantalla, cada mañana" },
        ],
      },
    ],
  },
  {
    kicker: "Tres palancas",
    title: "Esos 200.000 € salen de tres sitios",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "80–110 k € · llenar mejor",
            body: "4 salidas nuevas y más plazas ocupadas. El panel muestra ocupación y margen por ruta.",
            tone: "brand",
          },
          {
            title: "45–70 k € · antiguos clientes",
            body: "8–12 personas que ya viajaron y no han vuelto. El sistema lista a quién llamar; la llamada la hace el equipo.",
            tone: "good",
          },
          {
            title: "40–60 k € · precio con criterio",
            body: "Subir un poco donde hay demanda. Solo tiene sentido si ves el margen real de cada salida.",
            tone: "warn",
          },
        ],
      },
    ],
  },
  {
    kicker: "Qué duele hoy",
    title: "Problema → qué cambia con el sistema",
    blocks: [
      {
        type: "table",
        headers: ["Problema", "Urgencia", "Qué ve el equipo"],
        rows: [
          ["No sabemos de dónde vienen los interesados", "Alta", "Origen en cada lead · importar Excel"],
          ["No vemos margen ni ocupación clara", "Alta", "Dashboard con hueco a 1M y margen por ruta"],
          ["Sofía demasiado operativo", "Crítica", "Avisos internos + lista corta de trabajo"],
          ["Clientes que no vuelven", "Alta", "Cola «llamar este mes» · WhatsApp / llamada humana"],
          ["No sabemos a quién priorizar", "Media", "Ranking con razones en lenguaje claro"],
          ["Facturas y gestoría a mano", "Media", "Export listo para la gestoría · Veri*FACTU"],
        ],
      },
    ],
    footer: "Para crecer un 25 % no hace falta una moda tecnológica. Hace falta medir — y actuar.",
  },
  {
    kicker: "Qué proponemos",
    title: "Una plataforma interna, no tres proyectos sueltos",
    subtitle: "Se construye por fases. Cada fase deja algo usable la misma semana.",
    blocks: [
      {
        type: "steps",
        items: [
          "Orden: una sola base (leads, clientes, reservas) y origen visible",
          "Claridad: pantalla diaria con hueco a 1M, procedencia y margen",
          "Prioridad: ranking de leads — la IA solo ordena, no escribe al cliente",
          "Recurrencia: VIP, dormidos y «en riesgo» con botones de llamada humana",
          "Memoria: respuestas internas (Mongolia, Namibia…) con fuentes",
          "Contenido: borradores para newsletter y redes; una persona publica",
        ],
      },
      {
        type: "quote",
        text: "Datos → aviso al equipo → seguimiento humano. Nunca mensaje automático al viajero.",
      },
    ],
  },
  {
    kicker: "Demo · 90 segundos",
    title: "Qué enseñar en la reunión con el equipo",
    blocks: [
      {
        type: "steps",
        items: [
          "Entrar con el usuario del equipo y abrir la campana de avisos",
          "Base de datos: cobertura de origen e importar un Excel",
          "Dashboard: el hueco de 200k € y «sin origen» como problema nº 1",
          "Leads: score con razones que se entienden",
          "Clientes: un VIP con valor · botón WhatsApp (lo pulsa una persona)",
          "Reservas: estado de salidas y preparación logística",
          "Facturas: frase de 10 s para gestoría + export",
          "Contenido: un borrador con voz Campo Norte · Copiar y pegar",
          "Automatizaciones: el flujo formulario → aviso interno (sin tocar al cliente)",
          "Esta presentación + propuesta escrita si quiere llevársela",
        ],
      },
    ],
  },
  {
    kicker: "Primera pieza",
    title: "Un solo sitio donde vive el negocio",
    blocks: [
      {
        type: "text",
        text: "Dejáis de preguntaros «¿en qué Excel estaba esto?». Leads, clientes y reservas comparten la misma fuente.",
      },
      {
        type: "metrics",
        items: [
          { label: "Campos clave", value: "12+", hint: "Quién · origen · destino · estado · responsable…" },
          { label: "Entrada / salida", value: "Importar Excel", hint: "También backup completo" },
          { label: "Meta a 60 días", value: "≥ 90 %", hint: "interesados con origen conocido" },
        ],
      },
      {
        type: "bullets",
        items: [
          "Cola del día: sin origen · muy calientes · reservas en preparación · VIP / dormidos",
          "Marta o Sofía pueden importar y exportar sin pedir a un técnico",
        ],
      },
    ],
  },
  {
    kicker: "Números y salidas",
    title: "Decidir precio y salidas con el margen a la vista",
    blocks: [
      {
        type: "quote",
        text: "Si subo el precio un 6 % y pierdo una plaza, ¿gano o pierdo? El sistema da el contexto; la decisión sigue siendo humana.",
      },
      {
        type: "bullets",
        items: [
          "Pantalla diaria: ritmo del año, hueco a 1M, de dónde vienen y margen % por salida",
          "Reservas: crear, editar, duplicar · estado · checklist de preparación",
          "Cada cambio avisa al equipo (confirmada / modificada / cancelada)",
        ],
      },
    ],
  },
  {
    kicker: "Quién importa hoy",
    title: "La lista de los diez",
    blocks: [
      {
        type: "text",
        text: "Cada mañana: a quién llamar primero entre interesados nuevos y clientes que hace tiempo no viajan.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Interesados nuevos",
            body: "Ordenados con razones claras («referido», «destino premium»…). La IA clasifica; el equipo decide.",
            tone: "brand",
          },
          {
            title: "Clientes que ya conocéis",
            body: "VIP, dormidos, embajadores. Editar · WhatsApp · Llamar. La llamada la hace una persona.",
            tone: "good",
          },
        ],
      },
      {
        type: "quote",
        text: "El sistema prepara la lista. Sofía o Marta escriben desde su propio correo o WhatsApp.",
      },
    ],
  },
  {
    kicker: "Dinero y papeles",
    title: "Facturas listas para la gestoría",
    blocks: [
      {
        type: "text",
        text: "Frase de 10 segundos para el equipo: este módulo prepara las facturas con el régimen de agencias de viajes y deja el camino listo para Veri*FACTU (2027).",
      },
      {
        type: "bullets",
        items: [
          "Exportar CSV para la gestoría · PDF limpio",
          "Medios de pago habituales: tarjeta, transferencia SEPA, PayPal, depósito…",
          "La remisión a Hacienda se aborda por fases; no hay que inventar el futuro el mes 1",
        ],
      },
    ],
  },
  {
    kicker: "Tiempo del equipo",
    title: "Menos «pregúntale a Sofía» · más borradores listos",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "Fábrica de contenido",
            body: "Borradores con voz Campo Norte («Namibia no se cuenta. Se conduce.»). Una persona copia a newsletter o redes.",
            tone: "brand",
          },
          {
            title: "Memoria de la casa",
            body: "Preguntas internas con respuesta + fuentes. Si no hay dato: «no está en el sistema».",
            tone: "good",
          },
          {
            title: "Automatizaciones",
            body: "Formulario web → entra al sistema → avisa al equipo. Nunca envía nada al viajero solo.",
            tone: "warn",
          },
        ],
      },
    ],
  },
  {
    kicker: "Orden de ataque",
    title: "Qué ya está · qué sigue · qué espera",
    blocks: [
      {
        type: "matrix",
        cells: [
          {
            quadrant: "hi-lo",
            title: "Hecho · rápido",
            body: "Base del negocio + origen + pantalla diaria + CRM operable (este demo)",
          },
          {
            quadrant: "hi-hi",
            title: "Siguiente · mucho valor",
            body: "Conectar newsletter y web de verdad · afinar prioridades con datos vivos",
          },
          {
            quadrant: "lo-lo",
            title: "Hecho · apoyo interno",
            body: "Memoria de la casa + borradores de contenido editables",
          },
          {
            quadrant: "lo-hi",
            title: "Más adelante",
            body: "Modelos avanzados de ocupación o precio — solo cuando los datos estén limpios",
          },
        ],
      },
    ],
  },
  {
    kicker: "Riesgos y traspaso",
    title: "Qué pasa si yo no estoy · y qué ya está cubierto",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "Privacidad",
            body: "Solo datos necesarios · página legal · nunca mandar la ficha entera a un modelo de IA.",
            tone: "brand",
          },
          {
            title: "Independencia",
            body: "Podéis exportar todo. Documentación y formación. Marcharse ≠ dejaros colgados.",
            tone: "good",
          },
          {
            title: "Sin sobrecomplicar",
            body: "Se usa en minutos: login, menú, avisos. Si no lo usa el equipo, no sirve.",
            tone: "warn",
          },
          {
            title: "Marca Campo Norte",
            body: "Cero mensajes automáticos al cliente. Badge visible: «Sin mensajes al cliente».",
            tone: "brand",
          },
        ],
      },
    ],
  },
  {
    kicker: "Próximos 90 días",
    title: "Plan part-time sobre lo que ya corre",
    blocks: [
      {
        type: "steps",
        items: [
          "Hecho · demo en internet (login, base, CRM, facturas, legal)",
          "Semana 1 · sesión con Sofía y Marta · importar Excel / Brevo reales",
          "Semanas 2–4 · formulario web entra solo · origen en cada lead",
          "Semanas 4–8 · afinar la lista de dormidos y leads calientes con datos reales",
          "Semanas 8–12 · contratos de datos · formación · grabación de traspaso",
        ],
      },
      {
        type: "bullets",
        items: [
          "¿Quién será el dueño interno de esta base?",
          "¿Qué rutas se llenan casi solas?",
          "¿Cuánto entra por recomendación hoy?",
          "¿Qué parte del booking come más tiempo a Marta?",
        ],
      },
    ],
  },
  {
    kicker: "Cierre",
    title: "El mapa… y el terreno.",
    subtitle: "El objetivo no es que me necesitéis. Es que el sistema os sobreviva.",
    blocks: [
      {
        type: "quote",
        text: "No propongo sustituir el trato humano. Propongo quitar lo repetitivo de detrás del escenario — y aquí ya se puede tocar.",
      },
      {
        type: "text",
        text: "Equipo demo · Growth OS · example.com",
      },
    ],
    footer: "demo interno",
  },
];

const en: PitchSlide[] = [
  {
    kicker: "Product · Campo Norte",
    title: "Grow without losing what makes you unique",
    subtitle:
      "An internal system to organise the business, free Sofía's time and reach €1M — without any machine messaging the traveller.",
    blocks: [
      { type: "text", text: "Equipo demo · Growth OS · product demo" },
      {
        type: "bullets",
        items: [
          "Live demo for the meeting: example.com",
          "Team login · leads · clients · bookings · numbers · invoices · content",
          "Golden rule: systems prepare; people own the relationship",
        ],
      },
    ],
    footer: "No system ever speaks to a customer.",
  },
  {
    kicker: "Core idea",
    title: "You don’t lack marketing. You lack memory and time.",
    blocks: [
      {
        type: "quote",
        text: "The product is 5 stars. The bottleneck is daily ops: scattered data and everything through Sofía.",
      },
      {
        type: "bullets",
        items: [
          "Trips sell on quality — the system behind doesn’t keep up",
          "Sheets + Sofía's inbox + newsletter = nobody sees the whole business",
          "Sofía sorts leads, follows up and drafts content — hours that should close and care",
        ],
      },
    ],
  },
  {
    kicker: "The numbers",
    title: "From €800k to €1M",
    subtitle: "Same business-case figures. Also on the demo Dashboard.",
    blocks: [
      {
        type: "table",
        headers: ["Metric", "Today", "2027 goal"],
        rows: [
          ["Revenue", "€800,000", "€1,000,000"],
          ["Travelers", "150", "168"],
          ["Departures", "10", "14"],
          ["Avg. ticket", "€5,300", "€5,950"],
          ["Margin / trip", "barely measured", "around 30%"],
        ],
      },
      {
        type: "metrics",
        items: [
          { label: "The gap", value: "€200,000", hint: "+25% in two years" },
          { label: "Where to see it", value: "Dashboard", hint: "One screen, every morning" },
        ],
      },
    ],
  },
  {
    kicker: "Three levers",
    title: "That €200k comes from three places",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "€80–110k · fill better",
            body: "4 new departures and higher occupancy. The panel shows occupancy and margin per route.",
            tone: "brand",
          },
          {
            title: "€45–70k · past clients",
            body: "8–12 people who travelled once and didn’t return. The system lists who to call; humans dial.",
            tone: "good",
          },
          {
            title: "€40–60k · smarter price",
            body: "Modest lifts where demand is strong — only if you see real margin per departure.",
            tone: "warn",
          },
        ],
      },
    ],
  },
  {
    kicker: "What hurts today",
    title: "Problem → what the system changes",
    blocks: [
      {
        type: "table",
        headers: ["Problem", "Urgency", "What the team sees"],
        rows: [
          ["Don’t know where prospects come from", "High", "Origin on every lead · import sheets"],
          ["No clear margin / occupancy", "High", "Dashboard: €1M gap + margin by route"],
          ["Sofía too operational", "Critical", "Internal alerts + short work list"],
          ["Clients who don’t return", "High", "“Call this month” queue · human WhatsApp/call"],
          ["Don’t know who to prioritise", "Medium", "Ranking with plain-language reasons"],
          ["Invoices / tax pack by hand", "Medium", "Export for the accountant · Veri*FACTU"],
        ],
      },
    ],
  },
  {
    kicker: "What we propose",
    title: "One internal platform — not three loose projects",
    blocks: [
      {
        type: "steps",
        items: [
          "Order: one base (leads, clients, bookings) with visible origin",
          "Clarity: daily screen with €1M gap, provenance and margin",
          "Priority: lead ranking — AI only sorts, never writes to clients",
          "Recurrence: VIP / dormant / at-risk with human call buttons",
          "Memory: internal answers with sources",
          "Content: drafts for newsletter and social; a person publishes",
        ],
      },
    ],
  },
  {
    kicker: "Demo · 90 seconds",
    title: "What to show Sofía in the meeting",
    blocks: [
      {
        type: "steps",
        items: [
          "Log in · open the notification bell",
          "Data base: origin coverage + import a sheet",
          "Dashboard: €200k gap + “unknown origin” as #1 pain",
          "Leads: score with reasons you can explain",
          "Clients: a VIP · WhatsApp button (a person presses it)",
          "Bookings: departure status + prep checklist",
          "Invoices: 10s line for the accountant + export",
          "Content: a Campo Norte voice draft · Copy",
          "Automations: form → internal alert (never to the traveller)",
          "This deck + written proposal if he wants it",
        ],
      },
    ],
  },
  {
    kicker: "First piece",
    title: "One place where the business lives",
    blocks: [
      {
        type: "metrics",
        items: [
          { label: "Key fields", value: "12+" },
          { label: "In / out", value: "Import sheets" },
          { label: "60-day goal", value: "≥ 90%", hint: "prospects with known origin" },
        ],
      },
    ],
  },
  {
    kicker: "Numbers & departures",
    title: "Decide price and departures with margin in view",
    blocks: [
      {
        type: "bullets",
        items: [
          "Daily screen: year pace, €1M gap, origin, margin %",
          "Bookings: create / edit / status / prep checklist",
          "Every change notifies the team",
        ],
      },
    ],
  },
  {
    kicker: "Who matters today",
    title: "Today’s list of ten",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "New prospects",
            body: "Ranked with clear reasons. AI classifies; the team decides.",
            tone: "brand",
          },
          {
            title: "Clients you already know",
            body: "VIP, dormant, ambassadors. Edit · WhatsApp · Call. Humans dial.",
            tone: "good",
          },
        ],
      },
    ],
  },
  {
    kicker: "Money & paperwork",
    title: "Invoices ready for the accountant",
    blocks: [
      {
        type: "text",
        text: "10s line for Sofía: prepares invoices under the travel-agency scheme and the path to Veri*FACTU (2027).",
      },
    ],
  },
  {
    kicker: "Team time",
    title: "Fewer “ask Sofía” moments · more ready drafts",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "Content factory",
            body: "Drafts in Campo Norte voice. A person pastes to newsletter or social.",
            tone: "brand",
          },
          {
            title: "House memory",
            body: "Internal Q&A with sources. If unknown: “not in the system”.",
            tone: "good",
          },
          {
            title: "Automations",
            body: "Web form → system → alert the team. Never messages the traveller alone.",
            tone: "warn",
          },
        ],
      },
    ],
  },
  {
    kicker: "Order of attack",
    title: "Done · next · later",
    blocks: [
      {
        type: "matrix",
        cells: [
          {
            quadrant: "hi-lo",
            title: "Done · quick",
            body: "Business base + origin + daily screen + operable CRM",
          },
          {
            quadrant: "hi-hi",
            title: "Next · high value",
            body: "Real newsletter + website feed · refine priorities with live data",
          },
          {
            quadrant: "lo-lo",
            title: "Done · internal support",
            body: "House memory + editable content drafts",
          },
          {
            quadrant: "lo-hi",
            title: "Later",
            body: "Advanced occupancy/price models — only once data is clean",
          },
        ],
      },
    ],
  },
  {
    kicker: "Risks & handover",
    title: "What if I’m gone — and what’s already covered",
    blocks: [
      {
        type: "cards",
        items: [
          {
            title: "Privacy",
            body: "Minimum data · legal page · never send a full client file to an AI model.",
            tone: "brand",
          },
          {
            title: "Independence",
            body: "Full export. Docs and training. Leaving ≠ stranding you.",
            tone: "good",
          },
          {
            title: "No overbuild",
            body: "Usable in minutes. If the team won’t use it, it doesn’t count.",
            tone: "warn",
          },
          {
            title: "Campo Norte brand",
            body: "Zero auto messages to clients. Visible badge: “No client messages”.",
            tone: "brand",
          },
        ],
      },
    ],
  },
  {
    kicker: "Next 90 days",
    title: "Part-time plan on what already runs",
    blocks: [
      {
        type: "steps",
        items: [
          "Done · live demo (login, base, CRM, invoices, legal)",
          "Week 1 · session with Sofía & Marta · import real sheets / Brevo",
          "Weeks 2–4 · web form feeds in · origin on every lead",
          "Weeks 4–8 · refine dormant + hot lists with real data",
          "Weeks 8–12 · data agreements · training · recorded handover",
        ],
      },
    ],
  },
  {
    kicker: "Close",
    title: "The map… and the terrain.",
    subtitle: "The goal isn’t that you need me. It’s that the system outlives all of us.",
    blocks: [
      {
        type: "quote",
        text: "I don’t propose replacing human care. I propose removing repetitive backstage work — and you can already touch it here.",
      },
      {
        type: "text",
        text: "Equipo demo · Growth OS · example.com",
      },
    ],
    footer: "demo interno",
  },
];

export const PITCH_SLIDES: Record<Lang, PitchSlide[]> = { es, en };
