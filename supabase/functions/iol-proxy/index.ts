const IOL_BASE = "https://api.invertironline.com"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── TOKEN CACHE (en memoria, dura hasta que la función se recicla) ──────────
let cachedToken: string | null = null
let tokenExpiry: number = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const user = Deno.env.get("IOL_USER")
  const pass = Deno.env.get("IOL_PASS")

  if (!user || !pass) throw new Error("IOL_USER o IOL_PASS no configurados")

  const res = await fetch(`${IOL_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username:   user,
      password:   pass,
      grant_type: "password",
    }),
  })

  if (!res.ok) throw new Error(`Error auth IOL: ${res.status}`)

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

// ── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { action, symbols, mercado } = await req.json()
    const token = await getToken()

    const authHeader = { Authorization: `Bearer ${token}` }

    // ── COTIZACIONES por lista de símbolos ──────────────────────────────────
    if (action === "cotizaciones") {
      const mkt = mercado || "bCBA"
      const results = await Promise.all(
        (symbols as string[]).map(async (symbol) => {
          try {
            const r = await fetch(
              `${IOL_BASE}/api/v2/${mkt}/Titulos/${symbol}/Cotizacion`,
              { headers: authHeader }
            )
            if (!r.ok) return { symbol, error: r.status }
            const d = await r.json()
            return {
              symbol,
              ultimo:    d.ultimoPrecio  ?? d.ultimo ?? 0,
              variacion: d.variacion     ?? 0,
              apertura:  d.apertura      ?? 0,
              maximo:    d.maximo        ?? 0,
              minimo:    d.minimo        ?? 0,
              volumen:   d.volumenNominal ?? 0,
              fecha:     d.fechaHora     ?? new Date().toISOString(),
            }
          } catch {
            return { symbol, error: "fetch_error" }
          }
        })
      )
      return Response.json({ ok: true, data: results }, { headers: CORS })
    }

    // ── PORTAFOLIO real del usuario ─────────────────────────────────────────
    if (action === "portafolio") {
      const r = await fetch(
        `${IOL_BASE}/api/v2/portafolio/argentina`,
        { headers: authHeader }
      )
      if (!r.ok) throw new Error(`Error portafolio: ${r.status}`)
      const d = await r.json()

      const activos = (d.activos ?? []).map((a: any) => ({
        symbol:       a.titulo?.simbolo   ?? "",
        nombre:       a.titulo?.descripcion ?? "",
        cantidad:     a.cantidad          ?? 0,
        precioCompra: a.precioCompra      ?? 0,
        valorActual:  a.valorizado        ?? 0,
        ganancia:     a.gananciaPorcentaje ?? 0,
        moneda:       a.titulo?.moneda    ?? "ARS",
      }))

      return Response.json({ ok: true, data: activos }, { headers: CORS })
    }

    return Response.json({ ok: false, error: "Acción no reconocida" }, { status: 400, headers: CORS })

  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500, headers: CORS }
    )
  }
})