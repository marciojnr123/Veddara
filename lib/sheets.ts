// Leitura de Google Sheets públicos (compartilhados "qualquer pessoa com o link").
// Usa a exportação CSV por aba. Para produção, o ideal é migrar p/ conta de serviço.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// sheetName vazio/omitido → primeira aba (export CSV padrão)
export async function fetchSheet(spreadsheetId: string, sheetName?: string): Promise<string[][]> {
  const url = sheetName
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Falha ao ler planilha (${res.status})`)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error('Planilha não está pública (veio HTML)')
  return parseCsv(text)
}

// número em pt-BR ("1.234,50") ou simples ("50")
export function numBR(v: string): number {
  const s = String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
