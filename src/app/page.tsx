import Convertidor from './convertidor';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">PDF Win Perfil → Excel</h1>
        <p className="mt-2 text-slate-600">
          Suba el &quot;Listado de barras a pedir&quot; de Win Perfil y descargue perfiles, accesorios y cristales en Excel.
          El PDF se procesa en memoria y no se guarda.
        </p>
      </header>
      <Convertidor />
    </main>
  );
}
