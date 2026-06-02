const PROXY_URL = `https://mfrxdeubqfvxdubwapbf.supabase.co/functions/v1/iol-proxy`

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
}

// ── COTIZACIONES por lista de símbolos ────────────────────────────────────────
// mercado: "bCBA" (BYMA/Buenos Aires) | "nYSE" | "nASDAQ" | "aMEX"
export async function getCotizaciones(symbols, mercado = "bCBA") {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "cotizaciones", symbols, mercado }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || "Error IOL cotizaciones")
  return data.data // array de { symbol, ultimo, variacion, maximo, minimo, volumen, fecha }
}

// ── PORTAFOLIO real del usuario en IOL ────────────────────────────────────────
export async function getPortafolioIOL() {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "portafolio" }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || "Error IOL portafolio")
  return data.data // array de { symbol, nombre, cantidad, precioCompra, valorActual, ganancia, moneda }
}

// ── Mapeo de símbolos locales a IOL ──────────────────────────────────────────
// IOL usa los mismos tickers para CEDEARs y acciones AR
export const SYMBOL_MAP = {
  YPFD: { iol: "YPFD", mercado: "bCBA" },
  B:    { iol: "B",    mercado: "bCBA" },
  PAAS: { iol: "PAAS", mercado: "bCBA" },
  HMY:  { iol: "HMY",  mercado: "bCBA" },
  MSFT: { iol: "MSFT", mercado: "bCBA" },
  MOS:  { iol: "MOS",  mercado: "bCBA" },
  NTR:  { iol: "NTR",  mercado: "bCBA" },
  ICL:  { iol: "ICL",  mercado: "bCBA" },
}

// ── Obtener cotizaciones solo para activos con posición ───────────────────────
export async function refreshCotizaciones(portfolio) {
  const activos = portfolio.filter(r => r.currentValue > 0)
  if (!activos.length) return {}

  const symbols = activos.map(r => SYMBOL_MAP[r.symbol]?.iol || r.symbol)

  try {
    const cotizaciones = await getCotizaciones(symbols, "bCBA")
    // Devuelve un mapa { YPFD: { ultimo, variacion, ... }, ... }
    return Object.fromEntries(cotizaciones.map(c => [c.symbol, c]))
  } catch (e) {
    console.error("Error refreshCotizaciones:", e)
    return {}
  }
}