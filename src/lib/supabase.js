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
  const records = rows.map(r => ({
    id:            r._id || undefined,
    user_id:       USER_ID,
    symbol:        r.symbol,
    name:          r.name,
    type:          r.type,
    current_value: r.currentValue,
    rendimiento:   r.rendimiento,
    avg_price:     r.avgPrice,
    target_price:  r.targetPrice,
    notes:         r.notes,
    alert_high:    r.alertHigh,
    alert_low:     r.alertLow,
    updated_at:    new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('portfolio')
    .upsert(records, { onConflict: 'id' })
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