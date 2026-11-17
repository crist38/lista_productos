# PDF Win Perfil → Excel (web)

Aplicación web (Next.js 16 + TypeScript + Tailwind CSS 4) que recibe el PDF **"Listado de barras / accesorios /
cristales a pedir"** de Win Perfil y entrega un Excel con las hojas RESUMEN, PERFILES, ACCESORIOS y CRISTALES.
Solo entrega cantidades (barras, metros, unidades, m²): **no muestra precios** ni en pantalla, ni en el JSON, ni en el Excel.
Los precios se leen solo internamente para el "Control de lectura" (SI/NO por listado contra el total del PDF).

## Estructura
- `src/lib/winperfil-pdf.ts`: lector del PDF (pdfjs-dist, por posición del texto). Misma lógica que la versión
  de consola en `C:\Agmsoft\pdf-winperfil-node`.
- `src/lib/excel.ts`: arma el .xlsx con exceljs.
- `src/app/api/convertir/route.ts`: `POST /api/convertir?formato=json|xlsx` (campo multipart `pdf`). Corre en el
  runtime **Node.js** de Vercel; el PDF se procesa en memoria y no se guarda. Límite: 4 MB por PDF.
- `src/app/page.tsx` + `src/app/convertidor.tsx`: pantalla para arrastrar el PDF, revisar y descargar.
- `next.config.ts`: `serverExternalPackages: ['pdfjs-dist']` y `outputFileTracingIncludes` para que Vercel incluya
  `pdf.worker.mjs` (sin eso el API falla con "Setting up fake worker failed").

## Uso local
```
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # igual que en producción
```

## Publicar en Vercel
Opción A — con GitHub: suba esta carpeta a un repositorio, en vercel.com "Add New > Project", elija el repositorio
y deje la configuración por defecto (Framework: Next.js). Cada push publica de nuevo.

Opción B — sin Git, desde esta carpeta:
```
npx vercel          # primera vez: inicia sesión y crea el proyecto (vista previa)
npx vercel --prod   # publica en producción
```

Ojo: el listado trae precios y costos. Si la URL va a ser pública, active la protección de Vercel
(Settings > Deployment Protection) o agregue un login antes de compartirla.

## Publicado
https://pdf-winperfil.vercel.app (proyecto `pdf-winperfil` en crist38's projects). Protegido con Vercel Authentication: hay que entrar con la cuenta de Vercel del equipo.
