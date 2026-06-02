import { useState, useEffect, useRef, useCallback } from "react"
import {
  getPortfolio, upsertPortfolio, deletePortfolioRow,
  getHistory, insertHistory, clearHistory, clearPortfolio
} from "./lib/supabase"
import { refreshCotizaciones, getPortafolioIOL } from "./lib/iol"

// ─── DATOS INICIALES ──────────────────────────────────────────────────────────
const INITIAL_PORTFOLIO = [
  { symbol:"YPFD", name:"YPF S.A.",           type:"Acción AR", currentValue:314500, rendimiento:23.87, avgPrice:63000, targetPrice:95000, notes:"", alertHigh:0, alertLow:0 },
  { symbol:"B",    name:"Barrick Gold",        type:"CEDEAR",   currentValue:63320,  rendimiento:4.70,  avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"PAAS", name:"Pan American Silver", type:"CEDEAR",   currentValue:56520,  rendimiento:0.14,  avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"HMY",  name:"Harmony Gold",        type:"CEDEAR",   currentValue:54320,  rendimiento:14.74, avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"MSFT", name:"Microsoft",           type:"CEDEAR",   currentValue:22260,  rendimiento:6.05,  avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"NVDA", name:"Nvidia Corporation",   type:"CEDEAR",   currentValue:251100, rendimiento:2.49,  avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"MOS",  name:"Mosaic Co.",          type:"CEDEAR",   currentValue:0,      rendimiento:0,     avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"NTR",  name:"Nutrien Ltd.",        type:"CEDEAR",   currentValue:0,      rendimiento:0,     avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
  { symbol:"ICL",  name:"ICL Group",           type:"CEDEAR",   currentValue:0,      rendimiento:0,     avgPrice:0,     targetPrice:0,     notes:"", alertHigh:0, alertLow:0 },
]

const MAESTROS_COLORS = { "Acción AR":"#f59e0b","CEDEAR":"#06b6d4","ETF":"#8b5cf6","FCI":"#10b981","Crypto":"#f97316","Bono":"#ec4899" }

const INVERSORES = [
  { name:"Warren Buffett", style:"Value investing",         sectors:["Finanzas","Consumo","Energía","Seguros"],          topHoldings:["AAPL 49%","BAC 10%","AXP 9%"],             filosofia:"Compra empresas con ventaja competitiva durable. Largo plazo. Nada de crypto ni commodities puros.", emoji:"🎩", match:"BRK, KO, AXP, BAC" },
  { name:"Ray Dalio",      style:"All Weather / Macro",     sectors:["Oro","Commodities","Bonos","Emergentes"],          topHoldings:["GLD 14%","SPY 10%","EEM 9%"],              filosofia:"Diversificación radical. Oro como cobertura. Ciclos económicos. Balance entre activos de riesgo y seguros.", emoji:"⚖️", match:"GLD, GDX, Commodities" },
  { name:"Michael Burry",  style:"Deep Value / Contrarian", sectors:["Acciones subvaluadas","China","Materias primas"],  topHoldings:["JD 18%","BABA 15%","HCA 12%"],             filosofia:"Busca activos odiados con fundamentos sólidos. Alto riesgo, alta convicción. Anticíclico.", emoji:"🔍", match:"Energía, Metales, YPF" },
  { name:"Peter Lynch",    style:"GARP",                    sectors:["Consumo","Tech","Salud","Retail"],                 topHoldings:["Consumer staples","Regional banks","Growth mid-caps"], filosofia:"Invertí en lo que conocés. P/E razonable + crecimiento. Pequeñas y medianas con potencial.", emoji:"📈", match:"Acciones regionales, midcaps" },
]

const THEMES = {
  dark:  { bg:"#070b14",surface:"#0d1421",card:"#111827",border:"#1e293b",text:"#f1f5f9",muted:"#64748b",subtle:"#94a3b8",accent:"#f59e0b",green:"#10b981",red:"#ef4444",blue:"#3b82f6",tabBg:"#0d1421",tabActive:"#1e293b",inputBg:"#1e293b",gradient:"linear-gradient(135deg,#f59e0b,#f97316)" },
  light: { bg:"#f0f4f8",surface:"#ffffff",card:"#ffffff",border:"#e2e8f0",text:"#0f172a",muted:"#64748b",subtle:"#475569",accent:"#d97706",green:"#059669",red:"#dc2626",blue:"#2563eb",tabBg:"#e2e8f0",tabActive:"#ffffff",inputBg:"#f8fafc",gradient:"linear-gradient(135deg,#d97706,#ea580c)" },
}

function downloadTxt(name, content) {
  try {
    const b = new Blob([content ?? ""], { type:"text/plain;charset=utf-8" })
    const u = URL.createObjectURL(b)
    const a = document.createElement("a")
    a.href = u; a.download = name; document.body.appendChild(a); a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u) }, 200)
  } catch(e) { console.error("downloadTxt error:", e) }
}

const fARS = n => n > 0 ? "$" + Number(n).toLocaleString("es-AR") : "S/D"
const fPct = n => (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%"

// ─── PIE ──────────────────────────────────────────────────────────────────────
function PieChart({ data, t }) {
  const COLS = ["#f59e0b","#06b6d4","#8b5cf6","#10b981","#f97316","#ef4444","#3b82f6","#ec4899","#a78bfa","#34d399"]
  const fil = data.filter(d => d.value > 0)
  const tot = fil.reduce((s,d) => s + d.value, 0)
  let cum = 0
  const sl = fil.map((d,i) => {
    const p = d.value / tot, s = cum; cum += p
    return { ...d, x1:Math.cos(2*Math.PI*s-Math.PI/2), y1:Math.sin(2*Math.PI*s-Math.PI/2), x2:Math.cos(2*Math.PI*cum-Math.PI/2), y2:Math.sin(2*Math.PI*cum-Math.PI/2), large:p>0.5?1:0, color:COLS[i%COLS.length], pct:p }
  })
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
      <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ width:120, flexShrink:0 }}>
        {sl.map((s,i) => <path key={i} d={`M0 0 L${s.x1} ${s.y1} A1 1 0 ${s.large} 1 ${s.x2} ${s.y2}Z`} fill={s.color} stroke={t.bg} strokeWidth="0.04" opacity="0.9"/>)}
        <circle cx="0" cy="0" r="0.58" fill={t.card}/>
        <text x="0" y="-0.05" textAnchor="middle" fill={t.text} fontSize="0.15" fontWeight="bold">CARTERA</text>
        <text x="0" y="0.13"  textAnchor="middle" fill={t.muted} fontSize="0.10">{fil.length} activos</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1 }}>
        {sl.map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, color:t.text, fontWeight:600 }}>{s.label}</span>
            <span style={{ fontSize:10, color:t.muted, marginLeft:"auto" }}>{(s.pct*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ rend, color }) {
  const pts = Array.from({length:8},(_,i) => Math.max(5, Math.min(95, 50 + rend*(i/7) + Math.sin(i*1.3)*8)))
  const path = pts.map((y,x) => `${x===0?"M":"L"}${(x/7)*90+5},${95-y}`).join(" ")
  return (
    <svg viewBox="0 0 100 60" style={{ width:60, height:28 }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d={path + " L95,95 L5,95 Z"} fill={color} opacity="0.08"/>
    </svg>
  )
}

function Badge({ label, color, t }) {
  return <span style={{ fontSize:8, padding:"2px 6px", borderRadius:4, background:t.bg, color:color||t.muted, letterSpacing:"1px", fontWeight:700, border:`1px solid ${color||t.border}22` }}>{label}</span>
}

// ─── BALANCES TAB ─────────────────────────────────────────────────────────────
function BalancesTab({ t, isDark, portfolio, btn, inp, card, showToast, setHistory }) {
  const [file,     setFile]     = useState(null)
  const [fileB64,  setFileB64]  = useState(null)
  const [fileType, setFileType] = useState(null)
  const [empresa,  setEmpresa]  = useState("")
  const [tickers,  setTickers]  = useState([])
  const [sectores, setSectores] = useState(["Energía"])
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState("")
  const [fase,     setFase]     = useState("")
  const fileRef = useRef()

  const SECTORES = ["Energía","Minería","Tecnología","Finanzas","Consumo","Agro","Industria","Salud","Telecomunicaciones"]
  const tickerSuggestions = portfolio.filter(r => r.currentValue > 0).map(r => r.symbol)

  function toggleTicker(s) { setTickers(p => p.includes(s) ? p.filter(x=>x!==s) : [...p, s]) }
  function toggleSector(s) { setSectores(p => p.includes(s) ? (p.length > 1 ? p.filter(x=>x!==s) : p) : [...p, s]) }

  function handleFile(e) {
    const f = e.target.files[0]; if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => { setFileB64(ev.target.result.split(",")[1]); setFileType(f.type) }
    reader.readAsDataURL(f)
  }

  const hoy = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})
  const tickerLabel = tickers.length > 0 ? tickers.join(" · ") : "sin ticker"
  const sectorLabel = sectores.join(", ")
  const FASES = { balance:"📄 Analizando balance...", web:"🌐 Buscando contexto...", final:"⚡ Generando recomendación..." }

  async function analizar() {
    if (!fileB64 || !empresa) { showToast("⚠️ Subí un archivo y completá la empresa","err"); return }
    setLoading(true); setResult("")
    try {
      setFase("balance")
      const r1 = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{ role:"user", content:[
            { type: fileType==="application/pdf"?"document":"image", source:{ type:"base64", media_type:fileType, data:fileB64 }},
            { type:"text", text:`Hoy es ${hoy}. Sos analista financiero senior. Analizá este balance/reporte de ${empresa} (${tickerLabel}, sector ${sectorLabel}).\n\n1.📊 MÉTRICAS CLAVE: ingresos, EBITDA, deuda neta, márgenes, FCF\n2.📈 TENDENCIAS vs períodos anteriores\n3.💪 FORTALEZAS del balance\n4.⚠️ SEÑALES DE ALERTA\n5.🎯 VALORACIÓN IMPLÍCITA\n\nRespondé en español.` }
          ]}]
        })
      })
      const d1 = await r1.json()
      const analisisBalance = d1.content?.map(b=>b.text||"").join("") || "Error en análisis."

      setFase("web")
      const r2 = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{ role:"user", content:`Hoy es ${hoy}. Buscá info actualizada sobre ${empresa} (${tickerLabel}) sector ${sectorLabel}.\n\nBuscá: noticias recientes, contexto sectorial, factores macro globales/locales, precio actual.\n\nCon este análisis de balance:\n---\n${analisisBalance}\n---\n\nGenerá recomendación completa:\n🟢🟡🔴 VEREDICTO: COMPRAR/MANTENER/VENDER\n\n⏱️ HORIZONTES:\n- CORTO (1-3 meses)\n- MEDIANO (3-12 meses)\n- LARGO (+1 año)\n\n🌍 FACTORES EXTERNOS\n📌 CATALIZADORES A MONITOREAR\n⚡ CONVICCIÓN: Alto/Medio/Bajo\n\nEspañol, directo, accionable.` }]
        })
      })
      const d2 = await r2.json()
      const recomendacion = d2.content?.map(b=>b.text||"").join("") || "Error en recomendación."

      setFase("final")
      const textoFinal = `════════════════════════════════════\nANÁLISIS — ${empresa.toUpperCase()}${tickers.length>0?" ("+tickers.join(", ")+")":""}\nSectores: ${sectorLabel} · ${hoy}\n════════════════════════════════════\n\n📄 ANÁLISIS DEL BALANCE\n${"─".repeat(36)}\n${analisisBalance}\n\n🎯 RECOMENDACIÓN + CONTEXTO\n${"─".repeat(36)}\n${recomendacion}`
      setResult(textoFinal)
      const entry = { mode:`balance-${empresa}`, text:textoFinal, date:new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) }
      await insertHistory(entry)
      setHistory(h => [entry, ...h.slice(0,9)])
      showToast("✓ Análisis completado")
    } catch(err) { setResult("❌ Error: " + err.message) }
    setLoading(false); setFase("")
  }

  return (
    <div>
      <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:10 }}>ANÁLISIS DE BALANCES E INFORMES</div>
      <div style={{ ...card, background:isDark?"#0d2010":"#f0fdf4", border:`1px solid ${t.green}44`, marginBottom:14 }}>
        <div style={{ fontSize:11, color:t.green, lineHeight:1.7 }}>📄 Subí el balance o reporte de resultados. La IA analiza los números <b>y</b> busca contexto en internet para una recomendación completa.</div>
      </div>
      <div style={card}>
        <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:10 }}>DATOS DE LA EMPRESA</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:9, color:t.muted, marginBottom:4 }}>Empresa *</div>
            <input value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Ej: YPF S.A." style={inp}/>
          </div>
          <div>
            <div style={{ fontSize:9, color:t.muted, marginBottom:4 }}>Ticker manual (Enter)</div>
            <input placeholder="Ej: YPFD" onKeyDown={e=>{ if((e.key==="Enter"||e.key===",")&&e.target.value.trim()){ toggleTicker(e.target.value.trim().toUpperCase()); e.target.value=""; e.preventDefault() }}} style={inp}/>
          </div>
        </div>
        {tickerSuggestions.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, color:t.muted, marginBottom:5 }}>De tu cartera:</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {tickerSuggestions.map(s => {
                const on = tickers.includes(s)
                return <button key={s} onClick={()=>toggleTicker(s)} style={{ background:on?t.accent:"transparent", border:`1px solid ${on?t.accent:t.border}`, borderRadius:6, padding:"5px 10px", color:on?"#000":t.muted, cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:700, transition:"all 0.15s" }}>{on?"✓ ":""}{s}</button>
              })}
            </div>
            {tickers.length > 0 && <div style={{ marginTop:6, fontSize:9, color:t.green }}>Seleccionados: {tickers.join(" · ")}</div>}
          </div>
        )}
        <div>
          <div style={{ fontSize:9, color:t.muted, marginBottom:5 }}>Sectores (mínimo 1)</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {SECTORES.map(s => {
              const on = sectores.includes(s)
              return <button key={s} onClick={()=>toggleSector(s)} style={{ background:on?t.accent:"transparent", border:`1px solid ${on?t.accent:t.border}`, borderRadius:6, padding:"5px 10px", color:on?"#000":t.muted, cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:on?700:400, transition:"all 0.15s", marginBottom:4 }}>{on?"✓ ":""}{s}</button>
            })}
          </div>
        </div>
      </div>
      <div style={{ ...card, border:`2px dashed ${file?t.green:t.border}`, cursor:"pointer" }} onClick={()=>fileRef.current.click()}>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display:"none" }}/>
        <div style={{ textAlign:"center", padding:"10px 0" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>{file?"✅":"📂"}</div>
          {file
            ? <><div style={{ fontSize:12, color:t.green, fontWeight:700 }}>{file.name}</div><div style={{ fontSize:10, color:t.muted, marginTop:3 }}>{(file.size/1024).toFixed(0)} KB · tocá para cambiar</div></>
            : <><div style={{ fontSize:12, color:t.subtle, fontWeight:600 }}>Tocá para subir el balance</div><div style={{ fontSize:10, color:t.muted, marginTop:3 }}>PDF, PNG o JPG</div></>
          }
        </div>
      </div>
      <button onClick={analizar} disabled={loading||!file||!empresa} style={{ width:"100%", background:loading||!file||!empresa?"transparent":`linear-gradient(135deg,${t.green},#059669)`, border:`1px solid ${t.green}`, borderRadius:10, padding:"14px", color:loading||!file||!empresa?t.muted:"#fff", cursor:loading||!file||!empresa?"not-allowed":"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13, marginBottom:14, transition:"all 0.2s" }}>
        {loading ? (FASES[fase]||"Procesando...") : "🔍 ANALIZAR BALANCE + CONTEXTO"}
      </button>
      {loading && (
        <div style={{ ...card, textAlign:"center", padding:"20px" }}>
          <div style={{ fontSize:11, color:t.accent, marginBottom:12, fontWeight:700 }}>{FASES[fase]}</div>
          <div style={{ display:"flex", justifyContent:"center", gap:16 }}>
            {["balance","web","final"].map(f => (
              <div key={f} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:fase===f?t.accent:t.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, border:`2px solid ${fase===f?t.accent:t.border}`, transition:"all 0.3s" }}>
                  {f==="balance"?"📄":f==="web"?"🌐":"⚡"}
                </div>
                <div style={{ fontSize:8, color:fase===f?t.accent:t.muted }}>{f==="balance"?"Balance":f==="web"?"Internet":"Veredicto"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && result && (
        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:10, color:t.accent, fontWeight:700 }}>ANÁLISIS · {empresa.toUpperCase()}</div>
            <button onClick={()=>downloadTxt(`balance-${empresa}-${new Date().toISOString().slice(0,10)}.txt`,result)} style={{ background:"transparent", border:`1px solid ${t.border}`, borderRadius:6, padding:"4px 9px", color:t.muted, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>⬇️ TXT</button>
          </div>
          <div style={{ fontSize:11, lineHeight:1.8, color:isDark?"#cbd5e1":t.subtle, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{result}</div>
        </div>
      )}
    </div>
  )
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [isDark,     setIsDark]     = useState(true)
  const [portfolio,  setPortfolio]  = useState([])
  const [history,    setHistory]    = useState([])
  const [ready,      setReady]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [analysis,   setAnalysis]   = useState("")
  const [loading,    setLoading]    = useState(false)
  const [tab,        setTab]        = useState("cartera")
  const [toast,      setToast]      = useState({ msg:"", type:"ok" })
  const [noteModal,  setNoteModal]  = useState(null)
  const [alertModal, setAlertModal] = useState(null)
  const [showClear,  setShowClear]  = useState(false)
  const [maestroSel, setMaestroSel] = useState(null)
  const [newRow,     setNewRow]     = useState({ symbol:"",name:"",type:"CEDEAR",currentValue:"",rendimiento:"",avgPrice:"",targetPrice:"",notes:"",alertHigh:"",alertLow:"" })
  const [cotizaciones,setCotizaciones] = useState({})
  const [loadingCot,  setLoadingCot]   = useState(false)
  const [lastUpdate,  setLastUpdate]   = useState(null)

  const t = isDark ? THEMES.dark : THEMES.light

  useEffect(() => {
    (async () => {
      try {
        // Cargamos extras desde Supabase (notas, alertas, targets)
        const [extras, h] = await Promise.all([getPortfolio(), getHistory()])
        setHistory(h)

        // Cargamos posiciones reales desde IOL
        const iolData = await getPortafolioIOL()
        const merged = iolData.map(row => {
          const extra = extras.find(e => e.symbol === row.symbol) || {}
          return {
            symbol:       row.symbol,
            name:         row.nombre,
            type:         extra.type || "CEDEAR",
            currentValue: row.valorActual,
            rendimiento:  Number(row.ganancia.toFixed(2)),
            avgPrice:     extra.avgPrice  || 0,
            targetPrice:  extra.targetPrice || 0,
            notes:        extra.notes    || "",
            alertHigh:    extra.alertHigh || 0,
            alertLow:     extra.alertLow  || 0,
            _id:          extra._id,
          }
        })

        // Agregamos activos de Supabase sin posición en IOL (ej: watchlist)
        extras.forEach(e => {
          if (!merged.find(m => m.symbol === e.symbol)) {
            merged.push({ ...e, currentValue: e.currentValue || 0 })
          }
        })

        setPortfolio(merged.length ? merged : INITIAL_PORTFOLIO)
        setLastUpdate(new Date().toLocaleTimeString("es-AR"))
      } catch(e) {
        console.error("Error carga inicial:", e)
        // Fallback a Supabase si IOL falla
        try {
          const [p, h] = await Promise.all([getPortfolio(), getHistory()])
          setPortfolio(p.length ? p : INITIAL_PORTFOLIO)
          setHistory(h)
        } catch { setPortfolio(INITIAL_PORTFOLIO) }
      }
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (!ready || portfolio.length === 0) return
    setSaving(true)
    upsertPortfolio(portfolio).then(() => setTimeout(() => setSaving(false), 600)).catch(console.error)
  }, [portfolio, ready])

  function showToast(msg, type="ok") { setToast({ msg, type }); setTimeout(() => setToast({ msg:"", type:"ok" }), 2500) }

  const actualizarCotizaciones = useCallback(async () => {
    setLoadingCot(true)
    try {
      const cots = await refreshCotizaciones(portfolio)
      setCotizaciones(cots)
      setLastUpdate(new Date().toLocaleTimeString("es-AR"))
      setPortfolio(prev => prev.map(r => {
        const cot = cots[r.symbol]
        if (!cot || !cot.ultimo) return r
        const rendimiento = r.avgPrice > 0
          ? ((cot.ultimo - r.avgPrice) / r.avgPrice * 100)
          : cot.variacion ?? r.rendimiento
        return { ...r, currentValue: cot.ultimo, rendimiento: Number(rendimiento.toFixed(2)) }
      }))
      showToast("✓ Cotizaciones actualizadas")
    } catch(e) { showToast("⚠️ Error IOL: " + e.message, "err") }
    setLoadingCot(false)
  }, [portfolio])

  const cargarPortafolioIOL = useCallback(async () => {
    setLoadingCot(true)
    try {
      const data = await getPortafolioIOL()
      setPortfolio(prev => {
        // Actualizá los que ya existen
        const updated = prev.map(r => {
          const row = data.find(d => d.symbol === r.symbol)
          if (!row) return r
          return { ...r, currentValue: row.valorActual, rendimiento: Number(row.ganancia.toFixed(2)) }
        })
        // Agregá los que vienen de IOL y no están en la lista
        data.forEach(row => {
          const existe = updated.find(r => r.symbol === row.symbol)
          if (!existe) {
            updated.push({
              symbol: row.symbol, name: row.nombre, type: "CEDEAR",
              currentValue: row.valorActual, rendimiento: Number(row.ganancia.toFixed(2)),
              avgPrice: 0, targetPrice: 0, notes: "", alertHigh: 0, alertLow: 0
            })
          }
        })
        return updated
      })
      setLastUpdate(new Date().toLocaleTimeString("es-AR"))
      showToast("✓ Portafolio IOL sincronizado")
    } catch(e) { showToast("⚠️ Error IOL: " + e.message, "err") }
    setLoadingCot(false)
  }, [])

  const active  = portfolio.filter(r => r.currentValue > 0)
  const total   = active.reduce((s,r) => s + Number(r.currentValue), 0)
  const avgRend = active.length ? active.reduce((s,r) => s + Number(r.rendimiento)*(Number(r.currentValue)/(total||1)), 0) : 0
  const topPos  = [...active].sort((a,b) => b.currentValue - a.currentValue)[0]
  const alertas = portfolio.filter(r => r.currentValue>0 && ((r.alertHigh>0&&r.currentValue>=r.alertHigh)||(r.alertLow>0&&r.currentValue<=r.alertLow)))

  async function runAnalysis(mode) {
    setLoading(true); setAnalysis(""); setTab("analisis")
    const hoy = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})
    const res = portfolio.map(r => {
      const cot = cotizaciones[r.symbol]
      return `${r.symbol}(${r.type}):$${r.currentValue}${cot?` live:$${cot.ultimo} var:${cot.variacion}%`:""} rend:${r.rendimiento}%${r.targetPrice?" tgt:$"+r.targetPrice:""}${r.notes?" nota:"+r.notes:""}`
    }).join("\n")
    const P = {
      full:      `Hoy es ${hoy}. Sos analista financiero experto. Analiza esta cartera con datos en tiempo real.\nTotal:$${total.toLocaleString()} rend:${avgRend.toFixed(2)}%\n${res}\n\n1.📋 RESUMEN EJECUTIVO\n2.💪 FORTALEZAS\n3.⚠️ RIESGOS\n4.🎯 OPORTUNIDADES\n5.🚨 SEÑALES DE SALIDA por activo\n6.🌍 CONTEXTO MACRO\n\nEspañol, directo, accionable.`,
      alertas:   `Hoy es ${hoy}. Señales de alerta con cotizaciones actuales:\n${res}\nPor activo:\n🟢 Mantener si...\n🟡 Reducir si...\n🔴 Salir si...\nCon niveles de precio en ARS.`,
      macro:     `Hoy es ${hoy}. Analista macro. Considera: tensión Ormuz, Brent~$117, oro~$4500, YPF récord, RIGI Vaca Muerta.\nCartera con datos live:\n${res}\nImpacto próximas 2-4 semanas por activo.`,
      rebalanceo:`Hoy es ${hoy}. Rebalanceo óptimo con cotizaciones actuales:\n${res}\nTotal $${total.toLocaleString()}\n- Porcentajes objetivo\n- Qué vender primero\n- Qué comprar y en qué orden`,
      merval:    `Hoy es ${hoy}. Comparar cartera vs Merval y S&P 500 YTD.\nCartera live:\n${res}\nRend ponderado: ${avgRend.toFixed(2)}%\n- Performance vs Merval YTD\n- Performance vs S&P YTD\n- Beta estimado\n- Alpha positivo o no`,
      fosforo:   `Hoy es ${hoy}. Análisis fertilizantes/fósforo (MOS,NTR,ICL).\nCartera:\n${res}\n¿Conviene entrar? ¿Precio objetivo? ¿% cartera ideal?`,
    }
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, tools:[{type:"web_search_20250305",name:"web_search"}], messages:[{ role:"user", content:P[mode] }] })
      })
      const d = await r.json()
      const tx = d.content?.map(b=>b.text||"").join("") || "Error."
      setAnalysis(tx)
      const entry = { mode, text:tx, date:new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) }
      await insertHistory(entry)
      setHistory(h => [entry, ...h.slice(0,9)])
      showToast("✓ Análisis guardado")
    } catch { setAnalysis("❌ Error de conexión.") }
    setLoading(false)
  }

  const TABS = [
    { id:"cartera",  icon:"📊", label:"Cartera"  },
    { id:"analisis", icon:"🤖", label:"IA"        },
    { id:"maestros", icon:"🎩", label:"Maestros"  },
    { id:"fosforo",  icon:"⚗️",  label:"Fósforo"  },
    { id:"balances", icon:"📄", label:"Balances"  },
    { id:"historial",icon:"🕐", label:"Historial" },
  ]

  const card = { background:t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:"13px 14px", marginBottom:9 }
  const inp  = { background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, padding:"8px 10px", color:t.text, fontSize:12, fontFamily:"inherit", outline:"none", width:"100%" }
  const btn  = (active, col) => ({ background:active?t.surface:"transparent", border:`1px solid ${col||t.border}`, borderRadius:8, padding:"9px 13px", color:active?t.text:t.muted, cursor:"pointer", fontFamily:"inherit", fontSize:11, transition:"all 0.15s" })

  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.text, fontFamily:"'DM Mono','Courier New',monospace", padding:"16px 13px 80px", maxWidth:480, margin:"0 auto", transition:"background 0.3s,color 0.3s" }}>

      {toast.msg && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:toast.type==="ok"?t.green:"#ef4444", color:"#fff", padding:"8px 20px", borderRadius:20, fontSize:12, fontWeight:700, zIndex:999, boxShadow:"0 4px 24px rgba(0,0,0,0.35)", whiteSpace:"nowrap" }}>{toast.msg}</div>}

      {alertas.length > 0 && <div style={{ background:"#7c1d1d", border:"1px solid #ef4444", borderRadius:10, padding:"9px 12px", marginBottom:10, fontSize:11, color:"#fca5a5" }}>🚨 <b>{alertas.length} alerta{alertas.length>1?"s":""} activa{alertas.length>1?"s":""}:</b> {alertas.map(a=>a.symbol).join(", ")}</div>}

      {noteModal !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:800, padding:16 }}>
          <div style={{ ...card, width:"100%", maxWidth:380, margin:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:t.text, marginBottom:10 }}>📝 Nota · {portfolio[noteModal]?.symbol}</div>
            <textarea value={portfolio[noteModal]?.notes||""} onChange={e=>setPortfolio(p=>p.map((r,i)=>i===noteModal?{...r,notes:e.target.value}:r))} rows={4} style={{ ...inp, resize:"none" }} placeholder="Tesis de inversión, recordatorios..."/>
            <button onClick={()=>{ setNoteModal(null); showToast("✓ Nota guardada") }} style={{ marginTop:9, width:"100%", background:t.accent, border:"none", borderRadius:8, padding:"9px", color:"#000", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>GUARDAR</button>
          </div>
        </div>
      )}

      {alertModal !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:800, padding:16 }}>
          <div style={{ ...card, width:"100%", maxWidth:380, margin:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:t.text, marginBottom:10 }}>🔔 Alertas · {portfolio[alertModal]?.symbol}</div>
            <div style={{ fontSize:10, color:t.muted, marginBottom:5 }}>Alerta si sube a ($ARS):</div>
            <input type="number" value={portfolio[alertModal]?.alertHigh||""} onChange={e=>setPortfolio(p=>p.map((r,i)=>i===alertModal?{...r,alertHigh:Number(e.target.value)}:r))} style={{ ...inp, marginBottom:8 }} placeholder="Ej: 400000"/>
            <div style={{ fontSize:10, color:t.muted, marginBottom:5 }}>Alerta si baja a ($ARS):</div>
            <input type="number" value={portfolio[alertModal]?.alertLow||""} onChange={e=>setPortfolio(p=>p.map((r,i)=>i===alertModal?{...r,alertLow:Number(e.target.value)}:r))} style={{ ...inp, marginBottom:9 }} placeholder="Ej: 200000"/>
            <button onClick={()=>{ setAlertModal(null); showToast("✓ Alertas guardadas") }} style={{ width:"100%", background:t.accent, border:"none", borderRadius:8, padding:"9px", color:"#000", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>GUARDAR</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${t.border}` }}>
        <div style={{ width:36, height:36, borderRadius:9, background:t.gradient, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>⚡</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:t.text, letterSpacing:"-0.5px" }}>Portfolio Analyzer</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:8, color:t.muted, letterSpacing:"2px" }}>CLAUDE AI · LVA</span>
            <span style={{ fontSize:8, color:saving?t.accent:t.green }}>{saving?"● guardando":"● sync"}</span>
            {lastUpdate && <span style={{ fontSize:8, color:t.muted }}>· IOL {lastUpdate}</span>}
          </div>
        </div>
        <button onClick={cargarPortafolioIOL} disabled={loadingCot} title="Sincronizar portafolio IOL"
          style={{ background:t.surface, border:`1px solid ${t.green}`, borderRadius:8, padding:"7px 9px", color:t.green, cursor:loadingCot?"not-allowed":"pointer", fontSize:13, opacity:loadingCot?0.5:1 }}>
          {loadingCot?"⏳":"🏦"}
        </button>
        <button onClick={actualizarCotizaciones} disabled={loadingCot} title="Actualizar cotizaciones IOL"
          style={{ background:t.surface, border:`1px solid ${t.accent}`, borderRadius:8, padding:"7px 9px", color:t.accent, cursor:loadingCot?"not-allowed":"pointer", fontSize:13, opacity:loadingCot?0.5:1 }}>
          {loadingCot?"⏳":"🔄"}
        </button>
        <button onClick={()=>setIsDark(d=>!d)}
          style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:8, padding:"7px 10px", cursor:"pointer", fontSize:15, color:t.text }}>
          {isDark?"☀️":"🌙"}
        </button>
        <button onClick={()=>downloadTxt(`portfolio-lva-${new Date().toISOString().slice(0,10)}.txt`, `PORTFOLIO ANALYZER — LVA\n${new Date().toLocaleString("es-AR")}\nTotal: $${total.toLocaleString("es-AR")}\nRend: ${avgRend.toFixed(2)}%\n\n${portfolio.filter(r=>r.currentValue>0).map(r=>`${r.symbol} | ${r.type} | $${r.currentValue.toLocaleString()} | ${r.rendimiento}%`).join("\n")}`)}
          style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:8, padding:"7px 9px", color:t.muted, cursor:"pointer", fontSize:13 }}>⬇️</button>
        <button onClick={()=>setShowClear(true)}
          style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:8, padding:"7px 9px", color:t.muted, cursor:"pointer", fontSize:13 }}>🗑️</button>
      </div>

      {showClear && (
        <div style={{ ...card, border:"1px solid #ef4444", background:isDark?"#1a0a0a":"#fef2f2", marginBottom:12 }}>
          <div style={{ fontSize:12, color:"#ef4444", marginBottom:8, fontWeight:700 }}>⚠️ ¿Borrar todos los datos?</div>
          <div style={{ fontSize:10, color:t.muted, marginBottom:10 }}>Se borran cartera e historial de Supabase.</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={async()=>{ await Promise.all([clearPortfolio(), clearHistory()]); setPortfolio(INITIAL_PORTFOLIO); setHistory([]); setShowClear(false); showToast("✓ Datos borrados") }}
              style={{ flex:1, background:"#ef4444", border:"none", borderRadius:7, padding:"8px", color:"white", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:11 }}>SÍ, BORRAR</button>
            <button onClick={()=>setShowClear(false)} style={{ flex:1, ...btn(false), textAlign:"center" }}>CANCELAR</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[
          { label:"TOTAL CARTERA",   val:fARS(total),         color:t.accent, sub:"ARS valorizado" },
          { label:"REND. PONDERADO", val:fPct(avgRend),       color:avgRend>=0?t.green:t.red, sub:"promedio pesado" },
          { label:"POSICIONES",      val:active.length,       color:t.blue,   sub:"activos activos" },
          { label:"MAYOR POSICIÓN",  val:topPos?.symbol||"-", color:"#8b5cf6",sub:topPos?((topPos.currentValue/total*100).toFixed(1)+"% del total"):"" },
        ].map((k,i) => (
          <div key={i} style={{ ...card, marginBottom:0, position:"relative", overflow:"hidden" }}>
            <div style={{ fontSize:7, color:t.muted, letterSpacing:"2px", marginBottom:5, textTransform:"uppercase" }}>{k.label}</div>
            <div style={{ fontSize:17, fontWeight:800, color:k.color, letterSpacing:"-0.5px" }}>{k.val}</div>
            <div style={{ fontSize:9, color:t.muted, marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:2, marginBottom:14, background:t.tabBg, borderRadius:10, padding:3, border:`1px solid ${t.border}` }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={()=>setTab(tb.id)} style={{ padding:"6px 2px", border:"none", borderRadius:7, cursor:"pointer", background:tab===tb.id?t.tabActive:"transparent", color:tab===tb.id?t.text:t.muted, fontFamily:"inherit", fontSize:8, fontWeight:tab===tb.id?700:400, transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span style={{ fontSize:12 }}>{tb.icon}</span>
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      {/* ══ CARTERA ══ */}
      {tab === "cartera" && (
        <>
          <div style={{ ...card, marginBottom:14 }}><PieChart data={[...active].sort((a,b)=>b.currentValue-a.currentValue).map(r=>({ label:r.symbol, value:Number(r.currentValue) }))} t={t}/></div>
          {portfolio.map((r,i) => {
            const cot = cotizaciones[r.symbol]
            return (
              <div key={i} style={{ ...card, opacity:r.currentValue>0?1:0.45 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:800, fontSize:14, color:t.text }}>{r.symbol}</span>
                      <Badge label={r.type} color={MAESTROS_COLORS[r.type]} t={t}/>
                      {r.currentValue===0 && <Badge label="sin posición" t={t}/>}
                      {(r.alertHigh>0||r.alertLow>0) && <Badge label="🔔 alerta" color="#f59e0b" t={t}/>}
                      {cot && <Badge label="● LIVE" color={t.green} t={t}/>}
                    </div>
                    <div style={{ fontSize:10, color:t.subtle, marginBottom:r.currentValue>0?4:0 }}>{r.name}</div>
                    {r.targetPrice>0 && <div style={{ fontSize:9, color:"#8b5cf6" }}>🎯 Target {fARS(r.targetPrice)}</div>}
                    {r.notes && <div style={{ fontSize:9, color:t.muted, marginTop:3, fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:180 }}>📝 {r.notes}</div>}
                    {cot && <div style={{ fontSize:9, color:t.muted, marginTop:3 }}>📊 Max {fARS(cot.maximo)} · Min {fARS(cot.minimo)}</div>}
                  </div>
                  {r.currentValue > 0 && (
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:t.text }}>{fARS(r.currentValue)}</div>
                      <div style={{ fontSize:12, color:r.rendimiento>=0?t.green:t.red, fontWeight:700 }}>{fPct(r.rendimiento)}</div>
                      <Sparkline rend={r.rendimiento} color={r.rendimiento>=0?t.green:t.red}/>
                      <div style={{ fontSize:8, color:t.muted }}>{((r.currentValue/total)*100).toFixed(1)}% cartera</div>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:5, marginTop:8, paddingTop:8, borderTop:`1px solid ${t.border}` }}>
                  <button onClick={()=>setNoteModal(i)}  style={{ ...btn(false), padding:"5px 8px", fontSize:10, flex:1 }}>📝 Nota</button>
                  <button onClick={()=>setAlertModal(i)} style={{ ...btn(false), padding:"5px 8px", fontSize:10, flex:1 }}>🔔 Alerta</button>
                  {editing && <button onClick={async()=>{ if(r._id) await deletePortfolioRow(r._id); setPortfolio(p=>p.filter((_,j)=>j!==i)) }} style={{ background:"#ef4444", border:"none", borderRadius:7, padding:"5px 9px", color:"white", cursor:"pointer", fontSize:10 }}>✕</button>}
                </div>
              </div>
            )
          })}
          {editing && (
            <div style={{ ...card, border:`1px dashed ${t.border}` }}>
              <span style={{ fontSize:8, color:t.muted, letterSpacing:"2px", display:"block", marginBottom:8 }}>AGREGAR ACTIVO</span>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {[["symbol","Símbolo"],["name","Nombre"],["currentValue","Valor ARS"],["rendimiento","Rend. %"],["avgPrice","P. Promedio"],["targetPrice","Target"]].map(([k,ph]) => (
                  <input key={k} placeholder={ph} value={newRow[k]} onChange={e=>setNewRow(p=>({...p,[k]:e.target.value}))} style={inp}/>
                ))}
              </div>
              <select value={newRow.type} onChange={e=>setNewRow(p=>({...p,type:e.target.value}))} style={{ ...inp, marginTop:6 }}>
                {["CEDEAR","Acción AR","ETF","FCI","Crypto","Bono"].map(tp=><option key={tp}>{tp}</option>)}
              </select>
              <button onClick={()=>{ if(!newRow.symbol||!newRow.currentValue)return; setPortfolio(p=>[...p,{...newRow,currentValue:Number(newRow.currentValue),rendimiento:Number(newRow.rendimiento||0),avgPrice:Number(newRow.avgPrice||0),targetPrice:Number(newRow.targetPrice||0),notes:"",alertHigh:0,alertLow:0}]); setNewRow({symbol:"",name:"",type:"CEDEAR",currentValue:"",rendimiento:"",avgPrice:"",targetPrice:"",notes:"",alertHigh:"",alertLow:""}) }}
                style={{ marginTop:8, width:"100%", background:t.accent, border:"none", borderRadius:8, padding:"9px", color:"#000", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>+ AGREGAR</button>
            </div>
          )}
          <button onClick={()=>setEditing(e=>!e)} style={{ ...btn(editing), width:"100%", marginBottom:12, textAlign:"center" }}>{editing?"✓ LISTO":"✏️ EDITAR CARTERA"}</button>
          <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:8 }}>ANÁLISIS CON IA</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[
              { mode:"full",       label:"🧠 Análisis Completo",  desc:"Resumen · riesgos · oportunidades" },
              { mode:"alertas",    label:"🚨 Señales de Alerta",   desc:"🟢🟡🔴 con niveles de precio" },
              { mode:"macro",      label:"🌍 Contexto Macro",      desc:"Impacto escenario global" },
              { mode:"rebalanceo", label:"⚖️ Rebalanceo",         desc:"Qué vender, qué comprar, en qué orden" },
              { mode:"merval",     label:"📊 vs Merval / S&P",     desc:"Comparativa de performance y alpha" },
            ].map(b => (
              <button key={b.mode} onClick={()=>runAnalysis(b.mode)} disabled={loading} style={{ background:isDark?"linear-gradient(135deg,#1e293b,#0f172a)":"linear-gradient(135deg,#f8fafc,#f1f5f9)", border:`1px solid ${t.border}`, borderRadius:10, padding:"12px 14px", color:t.text, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", textAlign:"left", opacity:loading?0.5:1 }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:2 }}>{b.label}</div>
                <div style={{ fontSize:10, color:t.muted }}>{b.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ══ ANÁLISIS ══ */}
      {tab === "analisis" && (
        <div>
          {loading && <div style={{ textAlign:"center", padding:"60px 0" }}><div style={{ fontSize:36, marginBottom:12, animation:"spin 2s linear infinite" }}>⚡</div><div style={{ color:t.muted, fontSize:12 }}>Analizando con Claude AI...</div></div>}
          {!loading && !analysis && <div style={{ textAlign:"center", padding:"60px 0" }}><div style={{ fontSize:40, marginBottom:10 }}>🤖</div><div style={{ fontSize:12, color:t.muted }}>Elegí un análisis en la tab Cartera</div></div>}
          {!loading && analysis && (
            <>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <button onClick={()=>{ downloadTxt(`analisis-lva-${new Date().toISOString().slice(0,10)}.txt`,analysis); showToast("✓ Descargando") }} style={{ ...btn(false), flex:1, textAlign:"center" }}>⬇️ Descargar</button>
                <button onClick={()=>setTab("cartera")} style={{ ...btn(false), padding:"9px 14px" }}>← Volver</button>
              </div>
              <div style={card}>
                <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:10 }}>ANÁLISIS · {new Date().toLocaleString("es-AR")}</div>
                <div style={{ fontSize:12, lineHeight:1.8, color:isDark?"#cbd5e1":t.subtle, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{analysis}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ MAESTROS ══ */}
      {tab === "maestros" && (
        <>
          <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:10 }}>ESTRATEGIAS · GRANDES INVERSORES</div>
          <div style={{ ...card, background:isDark?"#0d1f35":"#eff6ff", border:`1px solid ${t.blue}33`, marginBottom:14 }}>
            <div style={{ fontSize:11, color:t.blue, lineHeight:1.6 }}>🧠 Comparás tu cartera con las estrategias de los mejores inversores del mundo.</div>
          </div>
          {INVERSORES.map((m,i) => (
            <div key={i} style={{ ...card, cursor:"pointer", border:`1px solid ${maestroSel===i?t.accent:t.border}` }} onClick={()=>setMaestroSel(maestroSel===i?null:i)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:22 }}>{m.emoji}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:t.text }}>{m.name}</div>
                      <div style={{ fontSize:9, color:t.accent, letterSpacing:"1px" }}>{m.style.toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:t.subtle, lineHeight:1.5 }}>{m.filosofia}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:8, color:t.muted, marginBottom:4 }}>TOP HOLDINGS</div>
                  {m.topHoldings.map((h,j) => <div key={j} style={{ fontSize:9, color:t.text, marginBottom:2 }}>{h}</div>)}
                </div>
              </div>
              {maestroSel === i && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}` }}>
                  <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:6 }}>MATCH CON TU CARTERA</div>
                  <div style={{ fontSize:10, color:t.green, marginBottom:8 }}>✅ Compatibles: {m.match}</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                    {m.sectors.map((s,j) => <Badge key={j} label={s} color={t.accent} t={t}/>)}
                  </div>
                  <button onClick={e=>{ e.stopPropagation(); runAnalysis("full") }} style={{ width:"100%", background:t.accent, border:"none", borderRadius:8, padding:"9px", color:"#000", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>🤖 Analizar con enfoque {m.name.split(" ")[0]}</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ══ FÓSFORO ══ */}
      {tab === "fosforo" && (
        <>
          <div style={{ fontSize:8, color:t.muted, letterSpacing:"2px", marginBottom:10 }}>EMPRESAS · FÓSFORO & FERTILIZANTES · NYSE</div>
          {[
            { symbol:"MOS", name:"The Mosaic Company", focus:"Fósforo + Potasio",   signal:"🟡", signalTxt:"Cautela — curtailments mayo, costos suben", color:"#f59e0b", nota:"Mayor productor fosfato EEUU. Q1 2026: pérdida neta. DAP FOB ~$760-780/t Q2." },
            { symbol:"NTR", name:"Nutrien Ltd.",        focus:"N + P + K completo",  signal:"🟢", signalTxt:"Positivo — Brasil expansión, demanda sólida", color:"#10b981", nota:"Mayor productor mundial de potasio. Beneficiado por disrupciones 2026. Zacks: Buy." },
            { symbol:"ICL", name:"ICL Group Ltd.",      focus:"Fósforo + Bromo + K", signal:"🟡", signalTxt:"Seguimiento — riesgo geopolítico Israel",    color:"#8b5cf6", nota:"Empresa israelí. Dead Sea estable pese al conflicto. Diversificada globalmente." },
            { symbol:"CF",  name:"CF Industries",       focus:"Nitrógeno",           signal:"🟢", signalTxt:"Positivo — earnings +6.2% estimado 2026",   color:"#06b6d4", nota:"Foco en nitrógeno y amonio. Estimados +36.5% en 60 días. Beat 4 trimestres seguidos." },
          ].map((c,i) => (
            <div key={i} style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                    <span style={{ fontWeight:800, fontSize:16, color:c.color }}>{c.symbol}</span>
                    <Badge label="NYSE" t={t}/>
                    {cotizaciones[c.symbol] && <Badge label={`$${cotizaciones[c.symbol].ultimo}`} color={t.green} t={t}/>}
                  </div>
                  <div style={{ fontSize:11, color:t.subtle }}>{c.name}</div>
                  <div style={{ fontSize:9, color:t.muted }}>🧪 {c.focus}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:20 }}>{c.signal}</div>
                  <div style={{ fontSize:9, color:t.muted, maxWidth:90, textAlign:"right", marginTop:3 }}>{c.signalTxt}</div>
                </div>
              </div>
              <div style={{ background:isDark?"#0f172a":t.bg, borderRadius:8, padding:"8px 10px", fontSize:10, color:t.muted, lineHeight:1.6 }}>{c.nota}</div>
            </div>
          ))}
          <button onClick={()=>runAnalysis("fosforo")} disabled={loading} style={{ width:"100%", background:isDark?"linear-gradient(135deg,#1e3a5f,#0c1929)":"linear-gradient(135deg,#dbeafe,#bfdbfe)", border:`1px solid ${t.blue}`, borderRadius:10, padding:"13px", color:isDark?"#93c5fd":t.blue, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", fontWeight:700, fontSize:12, opacity:loading?0.6:1 }}>
            {loading?"⚡ Analizando...":"🤖 Análisis IA · Posicionamiento en Fósforo"}
          </button>
        </>
      )}

      {/* ══ BALANCES ══ */}
      {tab === "balances" && <BalancesTab t={t} isDark={isDark} portfolio={portfolio} btn={btn} inp={inp} card={card} showToast={showToast} setHistory={setHistory}/>}

      {/* ══ HISTORIAL ══ */}
      {tab === "historial" && (
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <button onClick={()=>downloadTxt(`historial-lva-${new Date().toISOString().slice(0,10)}.txt`, history.map((h,i)=>`[${i+1}] ${h.mode.toUpperCase()} — ${h.date}\n${"─".repeat(40)}\n${h.text}`).join("\n\n"))} style={{ ...btn(false), flex:1, textAlign:"center" }}>⬇️ Descargar historial</button>
            <button onClick={async()=>{ await clearHistory(); setHistory([]); showToast("✓ Historial borrado") }} style={{ ...btn(false,"#ef4444"), padding:"9px 12px", color:"#ef4444" }}>🗑️</button>
          </div>
          {history.length === 0
            ? <div style={{ textAlign:"center", padding:"60px 0" }}><div style={{ fontSize:40, marginBottom:10 }}>🕐</div><div style={{ fontSize:12, color:t.muted }}>Sin análisis guardados</div></div>
            : history.map((h,i) => (
              <div key={i} style={card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:t.accent, textTransform:"uppercase" }}>{h.mode}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:9, color:t.muted }}>{h.date}</span>
                    <button onClick={()=>downloadTxt(`analisis-${h.mode}-${i}.txt`,`PORTFOLIO ANALYZER — LVA\nTipo: ${h.mode}\nFecha: ${h.date}\n\n${h.text}`)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:13, padding:"2px" }}>⬇️</button>
                  </div>
                </div>
                <div style={{ fontSize:11, lineHeight:1.65, color:t.muted, whiteSpace:"pre-wrap", wordBreak:"break-word", maxHeight:140, overflow:"hidden", maskImage:"linear-gradient(black 60%,transparent)" }}>{h.text}</div>
              </div>
            ))
          }
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        button:hover:not(:disabled) { opacity: 0.8 !important }
        input:focus, select:focus, textarea:focus { border-color: ${t.accent} !important }
        * { box-sizing: border-box }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px }
      `}</style>
    </div>
  )
}