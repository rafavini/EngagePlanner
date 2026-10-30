import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, type BrowserContext } from 'playwright-core'
import type { NavegadorPreferido } from '../../shared/types'
import { log } from '../log'

let contexto: BrowserContext | null = null

export class ErroNavegador extends Error {}

/** Anota no registro as chamadas do Engage que falham (só endereço, sem parâmetros), para diagnóstico. */
function registrarDiagnostico(ctx: BrowserContext): void {
  let n = 0
  const curto = (url: string) => {
    try {
      const u = new URL(url)
      return `${u.host}${u.pathname.slice(0, 80)}`
    } catch {
      return 'url-invalida'
    }
  }
  const relevante = (url: string) => /engage\.cloud\.microsoft|yammer|office\.com|microsoft\.com/i.test(url)
  ctx.on('response', (r) => {
    if (n < 150 && r.status() >= 400 && relevante(r.url())) {
      n++
      log('erro', `HTTP ${r.status()} ${curto(r.url())}`)
    }
  })
  ctx.on('requestfailed', (r) => {
    if (n < 150 && relevante(r.url())) {
      n++
      log('erro', `Falha de rede ${curto(r.url())}: ${r.failure()?.errorText ?? '?'}`)
    }
  })
}

export function pastaPerfil(): string {
  // Perfil próprio do app: guarda o login da conta da escola entre uma execução e outra.
  return path.join(app.getPath('userData'), 'perfil-engage')
}

/** Abre (ou reaproveita) o navegador com perfil persistente. Só uma janela por vez. */
export async function obterContexto(preferido: NavegadorPreferido): Promise<BrowserContext> {
  if (contexto) {
    try {
      // se o usuário fechou a janela, isso lança
      contexto.pages()
      if (contexto.browser()?.isConnected() !== false) return contexto
    } catch {
      contexto = null
    }
  }

  const canais = preferido === 'auto' ? ['msedge', 'chrome'] : [preferido]
  let ultimoErro: unknown

  for (const canal of canais) {
    try {
      const ctx = await chromium.launchPersistentContext(pastaPerfil(), {
        channel: canal,
        headless: false,
        viewport: null,
        // Por padrão o Playwright liga --no-sandbox (o navegador mostra um aviso de segurança).
        // Aqui o navegador é o do próprio professor, então mantemos o sandbox ligado.
        chromiumSandbox: true,
        args: ['--start-maximized'],
      })
      registrarDiagnostico(ctx)
      ctx.on('close', () => {
        if (contexto === ctx) contexto = null
      })
      contexto = ctx
      log('info', `Navegador aberto (${canal}).`)
      return ctx
    } catch (e) {
      ultimoErro = e
      const msg = (e as Error).message
      log('erro', `Falha ao abrir ${canal}: ${msg.slice(0, 300)}`)
      if (/already in use|ProcessSingleton|user data directory/i.test(msg)) {
        throw new ErroNavegador(
          'A janela do Engage já está aberta em outro lugar. Feche a janela do navegador do app e tente de novo.',
        )
      }
    }
  }

  const nomes = preferido === 'auto' ? 'Microsoft Edge nem o Google Chrome' : preferido === 'msedge' ? 'Microsoft Edge' : 'Google Chrome'
  throw new ErroNavegador(
    `Não encontrei o ${nomes} neste computador. Instale um deles ou escolha outro navegador em Configurações.` +
      (ultimoErro ? '' : ''),
  )
}

export async function fecharContexto(): Promise<void> {
  const c = contexto
  contexto = null
  if (c) await c.close().catch(() => {})
}

/** Apaga o login guardado (cookies, contas) para poder entrar de novo com outra conta. */
export async function apagarPerfil(): Promise<void> {
  await fecharContexto()
  fs.rmSync(pastaPerfil(), { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
  log('info', 'Perfil do navegador do app apagado (troca de conta).')
}
