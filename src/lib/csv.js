// Genera y descarga un CSV que Excel abre bien (UTF-8 con BOM, separador coma)
function celda(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function descargarCSV(nombre, encabezados, filas) {
  const texto = '﻿' + [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n')
  const archivo = new File([texto], nombre, { type: 'text/csv;charset=utf-8' })

  // En celular, compartir funciona mejor que descargar (sobre todo en la app instalada)
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre })
      return
    } catch (e) {
      if (e?.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fmtFechaHora = new Intl.DateTimeFormat('es-SV', {
  timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})
export const fechaCSV = (d) => fmtFechaHora.format(new Date(d))
