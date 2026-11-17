// POST /api/convertir  (multipart, campo "pdf")
//   ?formato=json  -> datos leidos + chequeo de totales (para la vista previa)
//   ?formato=xlsx  -> descarga el Excel
// Corre en el runtime Node.js de Vercel (por defecto). El PDF no se guarda: se procesa en memoria.
import { parseWinPerfilPdf, checkTotals, resumen, sinPrecios } from '@/lib/winperfil-pdf';
import { buildWorkbook } from '@/lib/excel';

export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel limita el cuerpo de una funcion a ~4,5 MB

export async function POST(request: Request) {
  const formato = new URL(request.url).searchParams.get('formato') ?? 'json';
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Envie el PDF como multipart/form-data en el campo "pdf".' }, { status: 400 });
  }
  const file = form.get('pdf');
  if (!(file instanceof File)) return Response.json({ error: 'Falta el archivo PDF (campo "pdf").' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'El PDF pesa mas de 4 MB.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    return Response.json({ error: 'El archivo no es un PDF.' }, { status: 415 });
  }

  let completo;
  try {
    completo = await parseWinPerfilPdf(bytes);
  } catch (e) {
    return Response.json({ error: 'No se pudo leer el PDF: ' + (e instanceof Error ? e.message : String(e)) }, { status: 422 });
  }
  // Los precios solo se usan para el control de lectura; no salen en la respuesta ni en el Excel.
  const chequeo = checkTotals(completo);
  const datos = sinPrecios(completo);
  if (!datos.perfiles.length && !datos.accesorios.length && !datos.cristales.length) {
    return Response.json({ error: 'El PDF no parece un "Listado de barras a pedir" de Win Perfil (no se encontraron tablas).' }, { status: 422 });
  }

  if (formato === 'xlsx') {
    const nombre = file.name.replace(/\.pdf$/i, '') || 'listado';
    const buf = await buildWorkbook(datos, chequeo, file.name);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}.xlsx`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return Response.json({ datos, chequeo, resumen: resumen(datos) }, { headers: { 'Cache-Control': 'no-store' } });
}
