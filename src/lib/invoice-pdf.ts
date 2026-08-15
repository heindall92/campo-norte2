import { jsPDF } from "jspdf";
import { COMPANY } from "./assumptions";
import { PAYMENT_LABEL, type Invoice } from "./ops-data";

/** Datos fiscales emisora (demo — validar con gestoría) */
const ISSUER = {
  legalName: COMPANY.legal,
  tradeName: COMPANY.name,
  cif: "B87555001",
  address: "Calle de ejemplo 12, 28001 Madrid",
  city: "Madrid",
  province: "Madrid",
  cp: "28001",
  country: "España",
  email: COMPANY.email,
  phone: COMPANY.phone,
  web: COMPANY.website,
  registro: "Inscrita en el Registro Mercantil de Madrid · Tomo demo · Folio demo · Hoja M-demo",
} as const;

function money(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function drawLine(doc: jsPDF, y: number) {
  doc.setDrawColor(30, 58, 72);
  doc.setLineWidth(0.3);
  doc.line(18, y, 192, y);
}

/**
 * Factura PDF formato empresarial español · agencia de viajes (REAV).
 * Incluye mención régimen especial, desglose margen/IVA e identificación Veri*FACTU (demo).
 */
export function downloadInvoicePdf(inv: Invoice) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 16;

  // —— Cabecera empresa ——
  doc.setFillColor(15, 76, 78);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(ISSUER.tradeName, 18, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(ISSUER.legalName, 18, 18);
  doc.text("FACTURA", pageW - 18, 12, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(inv.number, pageW - 18, 19, { align: "right" });

  y = 36;
  doc.setTextColor(30, 40, 45);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const issuerBlock = [
    `CIF: ${ISSUER.cif}`,
    `${ISSUER.address}`,
    `${ISSUER.cp} ${ISSUER.city} (${ISSUER.province}) · ${ISSUER.country}`,
    `Tel. ${ISSUER.phone} · ${ISSUER.email}`,
    ISSUER.web,
  ];
  issuerBlock.forEach((line, i) => doc.text(line, 18, y + i * 4));

  // —— Datos factura ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Datos de la factura", 120, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const meta = [
    `Nº: ${inv.number}`,
    `Fecha emisión: ${inv.issueDate}`,
    `Fecha operación: ${inv.operationDate}`,
    `Reserva: ${inv.reservationId}`,
    `Expedición: ${inv.expedition}`,
  ];
  meta.forEach((line, i) => doc.text(line, 120, y + 5 + i * 4));

  y = 62;
  drawLine(doc, y);
  y += 8;

  // —— Cliente (destinatario) ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CLIENTE / DESTINATARIO", 18, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(inv.clientName, 18, y);
  y += 5;
  doc.text(`NIF/CIF: ${inv.clientNif}`, 18, y);
  y += 5;
  const addrLines = doc.splitTextToSize(inv.clientAddress, 110);
  doc.text(addrLines, 18, y);
  y += addrLines.length * 5 + 4;

  drawLine(doc, y);
  y += 8;

  // —— Tabla conceptos ——
  doc.setFillColor(240, 245, 246);
  doc.rect(18, y - 4, 174, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Concepto", 20, y);
  doc.text("Base (margen)", 118, y);
  doc.text("IVA", 148, y);
  doc.text("Importe", 172, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const concept = `Servicio de organización de viaje / expedición «${inv.expedition}» — régimen especial de las agencias de viajes (REAV).`;
  const conceptLines = doc.splitTextToSize(concept, 95);
  doc.text(conceptLines, 20, y);
  doc.text(money(inv.taxBase), 130, y, { align: "right" });
  doc.text(`${inv.vatRate}%`, 155, y, { align: "right" });
  doc.text(money(inv.total), 190, y, { align: "right" });
  y += Math.max(conceptLines.length * 4.5, 10) + 4;

  // Mención REAV obligatoria
  doc.setFillColor(255, 250, 235);
  doc.rect(18, y - 3, 174, 14, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 60, 20);
  const reav =
    inv.reavMention
      ? "Operación sujeta al Régimen especial de las agencias de viajes (arts. 141 a 147 Ley 37/1992 del IVA). Clave régimen / Veri*FACTU: 05. La base imponible corresponde al margen."
      : "Sin mención REAV en esta demo.";
  doc.text(doc.splitTextToSize(reav, 168), 20, y + 2);
  doc.setTextColor(30, 40, 45);
  y += 18;

  // —— Totales ——
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const totalsX = 130;
  doc.text("Base imponible (margen REAV)", totalsX, y);
  doc.text(money(inv.taxBase), 190, y, { align: "right" });
  y += 6;
  doc.text(`IVA ${inv.vatRate}% (cuota)`, totalsX, y);
  doc.text(money(inv.vatAmount), 190, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL FACTURA", totalsX, y);
  doc.text(money(inv.total), 190, y, { align: "right" });
  y += 10;

  drawLine(doc, y);
  y += 8;

  // —— Pago ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FORMA DE PAGO Y COBRO", 18, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Medio: ${PAYMENT_LABEL[inv.paymentChannel]}`, 18, y);
  y += 4;
  doc.text(`Importe cobrado: ${money(inv.amountCollected)}`, 18, y);
  y += 4;
  doc.text(`Fecha cobro: ${inv.collectedAt ?? "—"}`, 18, y);
  y += 4;
  doc.text(`Referencia: ${inv.paymentRef ?? "—"}`, 18, y);
  y += 4;
  doc.text(`Estado factura: ${inv.status.replaceAll("_", " ")}`, 18, y);
  y += 8;

  // —— Veri*FACTU ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VERI*FACTU / TRAZABILIDAD (demo)", 18, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const vf = [
    `Hash registro: ${inv.verifactuHash}`,
    `Estado AEAT: ${inv.aeatStatus}`,
    `Calificación operación: ${inv.operationClass} · ClaveRégimen: ${inv.regimeKey}`,
    "Marco: LGT art. 29.2.j) · Ley 11/2021 · RD 1007/2023 · Orden HAC/1177/2024 · RD-ley 15/2025.",
    "Documento generado por el Growth OS interno Campo Norte. Validar con gestoría antes de uso oficial.",
  ];
  vf.forEach((line) => {
    const lines = doc.splitTextToSize(line, 174);
    doc.text(lines, 18, y);
    y += lines.length * 3.8 + 1;
  });

  y += 6;
  drawLine(doc, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 115);
  doc.text(ISSUER.registro, 18, y);
  y += 4;
  doc.text(
    `${COMPANY.tagline} · ${COMPANY.promise}`,
    18,
    y,
  );
  y += 8;
  doc.setFontSize(6.5);
  doc.text(
    "DEMO — datos ficticios del business case. No constituye factura oficial hasta emisión por SIF homologado y validación de gestoría.",
    18,
    y,
  );

  // Pie de página
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 135);
  doc.text(`Página 1/1 · ${inv.number} · ${ISSUER.legalName}`, pageW / 2, 287, {
    align: "center",
  });

  doc.save(`${inv.number.replace(/\//g, "-")}.pdf`);
}

/** Exporta el libro de facturas como PDFs individuales en secuencia (demo) */
export function downloadAllInvoicesPdf(invoices: Invoice[]) {
  invoices.forEach((inv, idx) => {
    window.setTimeout(() => downloadInvoicePdf(inv), idx * 350);
  });
}
