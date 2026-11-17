// Lee el PDF "Listado de barras / accesorios / cristales a pedir" de Win Perfil (FastReport).
// Numeros: columna cuyo encabezado tiene el borde derecho mas cercano (van alineados a la derecha).
// Textos: por banda de x. Descripciones y colores partidos en varias lineas se juntan en una fila.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Lo que se entrega (pantalla, JSON y Excel): solo cantidades, sin precios.
export type Perfil = {
  Proveedor: string | null; Serie: string | null; Codigo: string; Articulo: string; Color: string;
  'Largo barra (m)': number | null; Barras: number | null; 'Total metros': number | null;
};
export type Accesorio = {
  Tipo: 'Accesorio' | 'Mano de obra'; Proveedor: string; Codigo: string; Articulo: string;
  Cantidad: number | null; 'Medida (m)': number; 'Cantidad total': number | null; Unidad: 'un' | 'm' | 'h';
};
export type Cristal = {
  Tipo: 'Vidrio' | 'Separador'; Ventana: string; Acristalamiento: string; 'Uds.': number | null;
  'Ancho (mm)': number | null; 'Alto (mm)': number | null; M2: number | null;
};
// Control de lectura: los precios se leen solo para comparar con los totales del PDF y no se muestran.
export type Chequeo = { Dato: string; Cuadra: 'SI' | 'NO' | '-' };
export type Listado = { obra: string; fecha: string; perfiles: Perfil[]; accesorios: Accesorio[]; cristales: Cristal[] };

// Interno: filas con precio (hacen falta para ubicar las columnas y para el control).
type Precio = { Precio: number | null; 'Precio total': number | null };
type PerfilP = Perfil & { 'Precio/m': number | null; 'Precio/barra': number | null; 'Precio total': number | null };
type AccesorioP = Accesorio & Precio;
type CristalP = Cristal & Precio;
export type ListadoCompleto = {
  obra: string; fecha: string; perfiles: PerfilP[]; accesorios: AccesorioP[]; cristales: CristalP[];
  totales: Record<string, number | null>;
};

type Tok = { s: string; x: number; r: number; y: number };
type SectionName = 'perfiles' | 'accesorios' | 'cristales';
type Section = { key: string; text: [string, number][]; num: [string, string][] };

const NUM_RE = /^(CLP\$)?\s*-?[\d.]*\d(,\d+)?(\s*m\.)?$|^CLP\$$/;
const STOP = /^(Total |SERIE:|PROVEEDOR:|PÃ¡gina|LISTADO DE|Obra:|Fecha:)/;

export function num(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).replace(/CLP\$/g, '').replace(/m\./g, '').replace(/\s+/g, '');
  if (t === '') return null;
  const v = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// formulario fijo de Win Perfil
const SECTIONS: Record<SectionName, Section> = {
  perfiles: {
    key: 'Precio/Barra',
    text: [['Codigo', 90], ['Articulo', 235], ['Color', 318]],
    num: [['Medida', 'Largo barra (m)'], ['Uds.', 'Barras'], ['Precio/m', 'Precio/m'], ['Precio/Barra', 'Precio/barra'],
      ['Total Ms.', 'Total metros'], ['Precio Total', 'Precio total']],
  },
  accesorios: {
    key: 'Proveedor',
    text: [['Proveedor', 50], ['Codigo', 130], ['Articulo', 345]],
    num: [['Cantidad', 'Cantidad'], ['Ancho', 'Medida (m)'], ['Alto', 'Alto'], ['Precio', 'Precio'], ['Precio total', 'Precio total']],
  },
  cristales: {
    key: 'Orden/Ventana',
    text: [['Ventana', 90], ['Acristalamiento', 330]],
    num: [['Uds.', 'Uds.'], ['Ancho', 'Ancho (mm)'], ['Alto', 'Alto (mm)'], ['M2', 'M2'], ['Precio', 'Precio'], ['Precio total', 'Precio total']],
  },
};

async function readPages(data: Uint8Array): Promise<Tok[][]> {
  const task = getDocument({ data, verbosity: 0, useSystemFonts: true });
  const doc = await task.promise;
  const pages: Tok[][] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const toks: Tok[] = [];
      for (const it of tc.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        toks.push({ s: it.str.trim(), x: it.transform[4], r: it.transform[4] + it.width, y: it.transform[5] });
      }
      pages.push(toks);
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

export async function parseWinPerfilPdf(data: Uint8Array): Promise<ListadoCompleto> {
  const pages = await readPages(data);
  const out: ListadoCompleto = { obra: '', fecha: '', perfiles: [], accesorios: [], cristales: [], totales: {} };
  let serie: string | null = null;
  let proveedor: string | null = null;
  const setSP = (s: Tok) => {
    if (s.s.startsWith('SERIE:')) serie = s.s.slice(6).trim();
    else proveedor = s.s.slice(10).trim();
  };

  for (const toks of pages) {
    for (const t of toks) {
      if (t.s.startsWith('Fecha:') && !out.fecha) out.fecha = t.s.slice(6).trim();
      if (t.s.startsWith('Obra:') && !out.obra) {
        const rest = toks.filter((u) => Math.abs(u.y - t.y) < 2 && u.x > t.r && !u.s.startsWith('Fecha:')).sort((a, b) => a.x - b.x);
        out.obra = clean(t.s.slice(5) + ' ' + rest.map((u) => u.s).join(' '));
      }
      const m = t.s.match(/^(Total (Pedido|Accesorios|Mano de Obra|vidrios)):$/);
      if (m) {
        const v = toks.filter((u) => Math.abs(u.y - t.y) < 2 && u.s.startsWith('CLP$'))
          .sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x))[0];
        if (v) out.totales[m[1]] = num(v.s);
      }
    }
    // encabezados de seccion de esta pagina (puede haber mas de uno)
    const heads: { name: SectionName; sec: Section; y: number; cols: { col: string; r: number }[] }[] = [];
    for (const [name, sec] of Object.entries(SECTIONS) as [SectionName, Section][]) {
      for (const h of toks.filter((t) => t.s === sec.key)) {
        const row = toks.filter((t) => Math.abs(t.y - h.y) < 3);
        const cols = sec.num.map(([lab, col]) => {
          const hh = row.find((t) => t.s === lab);
          return hh ? { col, r: hh.r } : null;
        });
        if (cols.some((c) => !c)) continue;
        heads.push({ name, sec, y: h.y, cols: cols as { col: string; r: number }[] });
      }
    }
    heads.sort((a, b) => b.y - a.y);
    const series = toks.filter((t) => t.s.startsWith('SERIE:') || t.s.startsWith('PROVEEDOR:')).sort((a, b) => b.y - a.y);
    const stops = toks.filter((t) => STOP.test(t.s)).map((t) => t.y);

    heads.forEach((hd, i) => {
      const yTop = hd.y - 4;
      const yBot = i + 1 < heads.length ? heads[i + 1].y + 4 : -1e9;
      const zone = toks.filter((t) => t.y < yTop && t.y > yBot);
      const firstMax = hd.sec.text[0][1];
      const anchors = zone.filter((t) => t.x < firstMax && !STOP.test(t.s)).sort((a, b) => b.y - a.y);
      const numZoneStart = Math.min(...hd.cols.map((c) => c.r)) - 60;

      anchors.forEach((a, k) => {
        const top = a.y + 4;
        const bot = Math.max(k + 1 < anchors.length ? anchors[k + 1].y + 4 : yBot, ...stops.filter((y) => y < a.y - 2));
        const band = zone.filter((t) => t.y <= top && t.y > bot && !STOP.test(t.s)).sort((u, v) => v.y - u.y || u.x - v.x);
        const rec: Record<string, string[]> = {};
        for (const [n] of hd.sec.text) rec[n] = [];
        for (const c of hd.cols) rec[c.col] = [];
        for (const t of band) {
          if (NUM_RE.test(t.s) && t.x >= numZoneStart - 10) {
            const c = hd.cols.reduce((b, c2) => (Math.abs(c2.r - t.r) < Math.abs(b.r - t.r) ? c2 : b));
            rec[c.col].push(t.s);
          } else {
            const tc = hd.sec.text.find(([, mx]) => t.x < mx) ?? hd.sec.text[hd.sec.text.length - 1];
            rec[tc[0]].push(t.s);
          }
        }
        for (const s of series) if (s.y > a.y) setSP(s);
        const T = (c: string) => clean((rec[c] ?? []).join(' '));
        const N = (c: string) => num((rec[c] ?? []).join(' '));

        if (hd.name === 'perfiles') {
          out.perfiles.push({
            Proveedor: proveedor, Serie: serie, Codigo: T('Codigo'), Articulo: T('Articulo'),
            Color: clean(T('Color').split(' /')[0]),
            'Largo barra (m)': N('Largo barra (m)'), Barras: N('Barras'), 'Total metros': N('Total metros'),
            'Precio/m': N('Precio/m'), 'Precio/barra': N('Precio/barra'), 'Precio total': N('Precio total'),
          });
        } else if (hd.name === 'accesorios') {
          const art = T('Articulo');
          const cant = N('Cantidad');
          const med = N('Medida (m)') ?? 0;
          const mo = /^MANO DE OBRA/i.test(art);
          out.accesorios.push({
            Tipo: mo ? 'Mano de obra' : 'Accesorio', Proveedor: T('Proveedor'), Codigo: T('Codigo'), Articulo: art,
            Cantidad: cant, 'Medida (m)': med, 'Cantidad total': med > 0 && cant != null ? +(cant * med).toFixed(3) : cant,
            Unidad: mo ? 'h' : med > 0 ? 'm' : 'un', Precio: N('Precio'), 'Precio total': N('Precio total'),
          });
        } else {
          const acr = T('Acristalamiento');
          out.cristales.push({
            Tipo: /SEPARADOR/i.test(acr) ? 'Separador' : 'Vidrio', Ventana: T('Ventana'), Acristalamiento: acr,
            'Uds.': N('Uds.'), 'Ancho (mm)': N('Ancho (mm)'), 'Alto (mm)': N('Alto (mm)'), M2: N('M2'),
            Precio: N('Precio'), 'Precio total': N('Precio total'),
          });
        }
      });
      // SERIE / PROVEEDOR al final de la zona siguen en la pagina siguiente
      for (const s of series) if (s.y < yTop && s.y > yBot) setSP(s);
    });
  }
  return out;
}

// Compara la suma de cada listado con el total del PDF; devuelve solo SI/NO (sin montos).
export function checkTotals(d: ListadoCompleto): Chequeo[] {
  const sum = <T,>(arr: T[], f: (r: T) => number | null, filt: (r: T) => boolean = () => true) =>
    +arr.filter(filt).reduce((a, r) => a + (f(r) ?? 0), 0).toFixed(2);
  const rows: [string, number | null | undefined, number][] = [
    ['Perfiles', d.totales['Total Pedido'], sum(d.perfiles, (r) => r['Precio total'])],
    ['Accesorios', d.totales['Total Accesorios'], sum(d.accesorios, (r) => r['Precio total'], (r) => r.Tipo === 'Accesorio')],
    ['Mano de obra', d.totales['Total Mano de Obra'], sum(d.accesorios, (r) => r['Precio total'], (r) => r.Tipo === 'Mano de obra')],
    ['Cristales', d.totales['Total vidrios'], sum(d.cristales, (r) => r['Precio total'])],
  ];
  return rows.map(([Dato, pdf, Suma]) => ({ Dato, Cuadra: pdf == null ? '-' : Math.abs(pdf - Suma) <= 1 ? 'SI' : 'NO' }));
}

// Quita todos los precios y totales en dinero.
export function sinPrecios(d: ListadoCompleto): Listado {
  return {
    obra: d.obra, fecha: d.fecha,
    perfiles: d.perfiles.map(({ 'Precio/m': _a, 'Precio/barra': _b, 'Precio total': _c, ...r }) => r),
    accesorios: d.accesorios.map(({ Precio: _a, 'Precio total': _b, ...r }) => r),
    cristales: d.cristales.map(({ Precio: _a, 'Precio total': _b, ...r }) => r),
  };
}

export function resumen(d: Listado) {
  const vid = d.cristales.filter((r) => r.Tipo === 'Vidrio');
  return {
    codigosPerfil: d.perfiles.length,
    barras: d.perfiles.reduce((a, r) => a + (r.Barras ?? 0), 0),
    metros: +d.perfiles.reduce((a, r) => a + (r['Total metros'] ?? 0), 0).toFixed(1),
    lineasAccesorios: d.accesorios.filter((r) => r.Tipo === 'Accesorio').length,
    vidriosUds: vid.reduce((a, r) => a + (r['Uds.'] ?? 0), 0),
    vidriosM2: +vid.reduce((a, r) => a + (r.M2 ?? 0), 0).toFixed(2),
  };
}
