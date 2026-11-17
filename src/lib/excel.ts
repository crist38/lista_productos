// Arma el .xlsx (RESUMEN, PERFILES, ACCESORIOS, CRISTALES) con exceljs.
import ExcelJS from 'exceljs';
import { resumen, type Chequeo, type Listado } from './winperfil-pdf';

const FMT: Record<string, string> = {
  'Largo barra (m)': '0.0', Barras: '0', 'Total metros': '0.0',
  Cantidad: '0.##', 'Medida (m)': '0.000', 'Cantidad total': '0.00', 'Uds.': '0', 'Ancho (mm)': '#,##0',
  'Alto (mm)': '#,##0', M2: '0.00',
};
const WIDTH: Record<string, number> = {
  Proveedor: 24, Serie: 18, Codigo: 15, Articulo: 46, Color: 26, Acristalamiento: 44, Tipo: 12, Unidad: 7, Ventana: 9, Dato: 34,
};

type Row = Record<string, string | number | null>;

function addSheet(wb: ExcelJS.Workbook, name: string, title: string, sub: string, rows: Row[]) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = sub;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF595959' } };
  if (!rows.length) {
    ws.getCell('A4').value = '(sin filas en el PDF)';
    return ws;
  }
  const cols = Object.keys(rows[0]);
  ws.addTable({
    name: 't' + name.replace(/\W/g, ''), ref: 'A3', headerRow: true, totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: cols.map((c) => ({ name: c, filterButton: true })),
    rows: rows.map((r) => cols.map((c) => r[c] ?? null)),
  });
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = WIDTH[c] ?? Math.max(10, c.length + 2);
    if (FMT[c]) col.numFmt = FMT[c];
  });
  return ws;
}

// d ya viene sin precios; chk es el control de lectura (solo SI/NO).
export async function buildWorkbook(d: Listado, chk: Chequeo[], fileName: string): Promise<Buffer> {
  const r = resumen(d);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'pdf-winperfil-web';
  const sub = `Obra: ${d.obra || '-'}    Fecha: ${d.fecha || '-'}    Archivo: ${fileName}`;
  const res: Row[] = [
    { Dato: 'Codigos de perfil', Cantidad: r.codigosPerfil },
    { Dato: 'Barras a pedir', Cantidad: r.barras },
    { Dato: 'Metros de perfil', Cantidad: r.metros },
    { Dato: 'Lineas de accesorios', Cantidad: r.lineasAccesorios },
    { Dato: 'Vidrios (unidades)', Cantidad: r.vidriosUds },
    { Dato: 'Vidrios (m2)', Cantidad: r.vidriosM2 },
    ...chk.map((c) => ({ Dato: `Lectura completa: ${c.Dato}`, Cantidad: c.Cuadra })),
  ];
  const rs = addSheet(wb, 'RESUMEN', 'LISTADO DE MATERIALES WIN PERFIL', sub, res);
  rs.getColumn(2).numFmt = 'General';
  rs.getColumn(2).alignment = { horizontal: 'right' };
  res.forEach((row, i) => {
    if (row.Cantidad === 'NO') rs.getCell(4 + i, 2).font = { bold: true, color: { argb: 'FFC00000' } };
  });
  rs.getCell('D3').value = 'Si "Lectura completa" dice NO, revise ese listado en el PDF (fila cortada o formato nuevo).';
  rs.getCell('D3').font = { italic: true, size: 9 };
  addSheet(wb, 'PERFILES', 'PERFILES (barras a pedir)', sub, d.perfiles as unknown as Row[]);
  addSheet(wb, 'ACCESORIOS', 'ACCESORIOS Y MANO DE OBRA', sub, d.accesorios as unknown as Row[]);
  addSheet(wb, 'CRISTALES', 'CRISTALES', sub, d.cristales as unknown as Row[]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
