'use client';

import { useCallback, useRef, useState } from 'react';
import type { Chequeo, Listado } from '@/lib/winperfil-pdf';

type Resultado = {
  datos: Listado;
  chequeo: Chequeo[];
  resumen: { codigosPerfil: number; barras: number; metros: number; lineasAccesorios: number; vidriosUds: number; vidriosM2: number };
};
type Pestana = 'perfiles' | 'accesorios' | 'cristales';

const dec = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 });
const fmt = (v: unknown) => (typeof v === 'number' ? dec.format(v) : v == null ? '' : String(v));

export default function Convertidor() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [tab, setTab] = useState<Pestana>('perfiles');
  const input = useRef<HTMLInputElement>(null);

  const enviar = useCallback(async (f: File, formato: 'json' | 'xlsx') => {
    const fd = new FormData();
    fd.append('pdf', f);
    const r = await fetch(`/api/convertir?formato=${formato}`, { method: 'POST', body: fd });
    if (!r.ok) {
      const j = await r.json().catch(() => ({ error: `Error ${r.status}` }));
      throw new Error(j.error ?? `Error ${r.status}`);
    }
    return r;
  }, []);

  const leer = useCallback(async (f: File) => {
    setArchivo(f); setRes(null); setError(null); setCargando(true);
    try {
      const r = await enviar(f, 'json');
      setRes(await r.json());
      setTab('perfiles');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [enviar]);

  const descargar = useCallback(async () => {
    if (!archivo) return;
    setBajando(true);
    try {
      const r = await enviar(archivo, 'xlsx');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = archivo.name.replace(/\.pdf$/i, '') + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBajando(false);
    }
  }, [archivo, enviar]);

  const elegir = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Elija un archivo PDF.'); return; }
    void leer(f);
  };

  const filas = res ? (res.datos[tab] as unknown as Record<string, unknown>[]) : [];
  const cols = filas.length ? Object.keys(filas[0]) : [];
  const todoCuadra = res?.chequeo.every((c) => c.Cuadra !== 'NO');

  return (
    <div className="space-y-6">
      <div
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition
          ${arrastrando ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white hover:border-sky-400 hover:bg-slate-50'}`}
      >
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => elegir(e.target.files)} />
        <p className="text-lg font-semibold text-slate-800">Arrastre aquí el PDF de Win Perfil</p>
        <p className="mt-1 text-sm text-slate-500">o haga clic para elegirlo · &quot;Listado de barras a pedir&quot; (perfiles, accesorios y cristales)</p>
        {archivo && <p className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{archivo.name}</p>}
      </div>

      {cargando && <p className="text-center text-slate-600">Leyendo el PDF…</p>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>}

      {res && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
              <p className="text-sm text-slate-500">Obra</p>
              <p className="text-lg font-semibold text-slate-900">{res.datos.obra || '—'}</p>
              <p className="text-sm text-slate-500">Fecha {res.datos.fecha || '—'}</p>
            </div>
            <button
              onClick={descargar}
              disabled={bajando}
              className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              {bajando ? 'Generando…' : 'Descargar Excel'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-3 font-semibold text-slate-800">
                Control de lectura{' '}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${todoCuadra ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {todoCuadra ? 'leído completo' : 'revisar'}
                </span>
              </h2>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr><th className="py-1">Listado</th><th className="text-center">Lectura completa</th></tr>
                </thead>
                <tbody>
                  {res.chequeo.map((c) => (
                    <tr key={c.Dato} className="border-t border-slate-100">
                      <td className="py-1.5">{c.Dato}</td>
                      <td className={`text-center font-semibold ${c.Cuadra === 'NO' ? 'text-red-600' : 'text-emerald-600'}`}>{c.Cuadra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">Compara cada listado con el total del PDF. Si dice NO, revise ese listado en el PDF.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Códigos de perfil', res.resumen.codigosPerfil], ['Barras a pedir', res.resumen.barras], ['Metros de perfil', res.resumen.metros],
                ['Líneas de accesorios', res.resumen.lineasAccesorios], ['Vidrios (uds.)', res.resumen.vidriosUds], ['Vidrios (m²)', res.resumen.vidriosM2],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{dec.format(v as number)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex gap-1 border-b border-slate-200 px-3 pt-3">
              {(['perfiles', 'accesorios', 'cristales'] as Pestana[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {t} <span className="opacity-70">({res.datos[t].length})</span>
                </button>
              ))}
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                  <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {filas.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60">
                      {cols.map((c) => (
                        <td key={c} className={`whitespace-nowrap px-3 py-1.5 ${typeof r[c] === 'number' ? 'text-right tabular-nums' : ''}`}>{fmt(r[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
