import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

const USER_ID = 'default'

// ── PORTFOLIO ──────────────────────────────────────────────────────────────
export async function getPortfolio() {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('user_id', USER_ID)
    .order('symbol')
  if (error) throw error
  return data.map(r => ({
    symbol:       r.symbol,
    name:         r.name,
    type:         r.type,
    currentValue: Number(r.current_value),
    rendimiento:  Number(r.rendimiento),
    avgPrice:     Number(r.avg_price),
    targetPrice:  Number(r.target_price),
    notes:        r.notes || '',
    alertHigh:    Number(r.alert_high),
    alertLow:     Number(r.alert_low),
    _id:          r.id,
  }))
}

export async function upsertPortfolio(rows) {
  // Borramos todas las filas del usuario y reinsertamos
  const { error: delError } = await supabase
    .from('portfolio')
    .delete()
    .eq('user_id', USER_ID)
  if (delError) throw delError

  if (!rows.length) return

  const records = rows.map(r => ({
    user_id:       USER_ID,
    symbol:        r.symbol,
    name:          r.name  || r.symbol,
    type:          r.type  || 'CEDEAR',
    current_value: Number(r.currentValue) || 0,
    rendimiento:   Number(r.rendimiento)  || 0,
    avg_price:     Number(r.avgPrice)     || 0,
    target_price:  Number(r.targetPrice)  || 0,
    notes:         r.notes     || '',
    alert_high:    Number(r.alertHigh)    || 0,
    alert_low:     Number(r.alertLow)     || 0,
    updated_at:    new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('portfolio')
    .insert(records)
  if (error) throw error
}

export async function deletePortfolioRow(id) {
  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── HISTORIAL ──────────────────────────────────────────────────────────────
export async function getHistory() {
  const { data, error } = await supabase
    .from('analysis_history')
    .select('*')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data.map(r => ({ mode: r.mode, text: r.text, date: r.date, _id: r.id }))
}

export async function insertHistory(entry) {
  const { error } = await supabase
    .from('analysis_history')
    .insert({ user_id: USER_ID, mode: entry.mode, text: entry.text, date: entry.date })
  if (error) throw error
}

export async function clearHistory() {
  const { error } = await supabase
    .from('analysis_history')
    .delete()
    .eq('user_id', USER_ID)
  if (error) throw error
}

export async function clearPortfolio() {
  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('user_id', USER_ID)
  if (error) throw error
}