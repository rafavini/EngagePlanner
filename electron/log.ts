import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function pastaLogs(): string {
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function pastaCapturas(): string {
  const dir = path.join(pastaLogs(), 'capturas')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Remove possíveis chaves/tokens antes de gravar */
function sanitizar(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, 'AIza***')
    .replace(/(key|token|authorization)=([^&\s]+)/gi, '$1=***')
}

export function log(nivel: 'info' | 'erro', msg: string): void {
  const linha = `${new Date().toISOString()} [${nivel}] ${sanitizar(msg)}\n`
  try {
    fs.appendFileSync(path.join(pastaLogs(), 'app.log'), linha)
  } catch {
    /* sem log não é motivo para quebrar o app */
  }
  if (!app.isPackaged) console.log(linha.trimEnd())
}
