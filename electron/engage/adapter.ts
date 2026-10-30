import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from 'playwright-core'
import { textoPlanoDoPost, trechosDoPost } from '../../shared/format'
import type { Post, Settings } from '../../shared/types'
import { log, pastaCapturas } from '../log'
import { obterContexto } from './browser'
import { HOSTS_DE_LOGIN, primeiroVisivel, SELETORES } from './selectors'

/** Muda a cada correção importante: aparece no registro para sabermos qual versão rodou. */
export const VERSAO_ADAPTADOR = '2026-10-29-v4-notificacoes'

export class ErroSessao extends Error {}
export class ErroAdaptador extends Error {}

export type Confirmacao = 'publicada' | 'nao-publicada'

export interface OpcoesPublicacao {
  /** caminhos absolutos dos arquivos, na ordem de envio */
  arquivos: string[]
  /** usado quando "parar antes de publicar" está ligado */
  confirmarPublicacaoManual: () => Promise<Confirmacao>
}

export interface AdaptadorPlataforma {
  nome: string
  abrirParaLogin(s: Settings): Promise<void>
  verificarSessao(s: Settings): Promise<{ logado: boolean; mensagem: string }>
  publicar(post: Post, s: Settings, op: OpcoesPublicacao): Promise<void>
}

async function paginaAtiva(s: Settings): Promise<Page> {
  const ctx = await obterContexto(s.navegador)
  const existente = ctx.pages().find((p) => !p.isClosed())
  const page = existente ?? (await ctx.newPage())
  await page.bringToFront().catch(() => {})
  return page
}

function emTelaDeLogin(url: string): boolean {
  try {
    return HOSTS_DE_LOGIN.includes(new URL(url).host)
  } catch {
    return false
  }
}

async function irParaComunidade(page: Page, s: Settings): Promise<void> {
  if (!/^https:\/\//i.test(s.comunidadeUrl)) {
    throw new ErroAdaptador('Cole o link da comunidade nas Configurações (precisa começar com https://).')
  }
  await page.goto(s.comunidadeUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  // O Engage mantém conexões abertas, então "networkidle" pode nunca chegar: é só uma ajuda.
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
  // dá tempo de um eventual redirecionamento para o login acontecer
  await page.waitForTimeout(1500)
}

async function capturar(page: Page, nome: string): Promise<string | null> {
  try {
    const arq = path.join(pastaCapturas(), `${nome}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
    await page.screenshot({ path: arq, fullPage: false })
    return arq
  } catch {
    return null
  }
}

/** Salva a estrutura acessível da tela: ajuda a descobrir os nomes certos dos botões. */
async function salvarEstrutura(alvo: Page | Locator, nome: string): Promise<void> {
  try {
    const raiz = 'locator' in alvo ? alvo.locator('body') : alvo
    const txt = await raiz.ariaSnapshot({ timeout: 8000 })
    fs.writeFileSync(path.join(pastaCapturas(), `${nome}-estrutura.txt`), txt)
  } catch {
    /* melhor esforço */
  }
}

async function digitarTexto(page: Page, post: Post, s: Settings): Promise<void> {
  const editor = await primeiroVisivel(page, SELETORES.editor, 10_000)
  if (!editor) throw new ErroAdaptador('Não achei a caixa de texto da postagem.')
  await editor.click()

  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  const trechos = s.rotulosEmNegrito
    ? trechosDoPost(post.campos)
    : [{ texto: textoPlanoDoPost(post.campos), negrito: false }]

  for (const t of trechos) {
    if (t.negrito) await page.keyboard.press(`${mod}+B`)
    const linhas = t.texto.split('\n')
    for (let i = 0; i < linhas.length; i++) {
      if (i > 0) await page.keyboard.press('Shift+Enter')
      if (linhas[i]) await page.keyboard.insertText(linhas[i])
    }
    if (t.negrito) await page.keyboard.press(`${mod}+B`)
  }

  // confere que o texto realmente entrou
  const trecho = post.campos.descricao.slice(0, 25)
  const dentro = await editor.innerText().catch(() => '')
  if (trecho && !dentro.includes(trecho)) {
    throw new ErroAdaptador('O texto não apareceu na caixa de postagem como esperado.')
  }
}

/**
 * Acha a janela de "nova postagem". Tudo o que for anexar acontece SÓ dentro dela:
 * a página do Engage tem outros campos de arquivo (por exemplo, o da foto de capa
 * da comunidade) e usar um deles mudaria a capa em vez de anexar à postagem.
 */
async function acharJanelaDePostagem(page: Page): Promise<Locator> {
  const dialogo = page.getByRole('dialog').filter({ has: page.getByRole('textbox') })
  if ((await dialogo.count()) > 0) return dialogo.last()

  const alternativa = page
    .locator('div')
    .filter({ has: page.locator('[contenteditable="true"]') })
    .filter({ has: page.getByRole('button', { name: /^(publicar|postar|enviar|post|publish)$/i }) })
    .last()
  if ((await alternativa.count()) > 0) return alternativa

  throw new ErroAdaptador(
    'Não consegui identificar a janela de nova postagem. Por segurança, não anexei nada (para não mexer em outro lugar da página).',
  )
}

async function anexarArquivos(page: Page, janela: Locator, arquivos: string[]): Promise<void> {
  if (arquivos.length === 0) return

  // 1) O caminho "de gente": clica no botão de anexar DENTRO da janela e escolhe os arquivos.
  const botao = await primeiroVisivel(page, SELETORES.anexar, 4000, janela)
  if (botao) {
    const nome = (await botao.getAttribute('aria-label').catch(() => null)) ?? (await botao.innerText().catch(() => '')) ?? ''
    log('info', `anexar: cliquei no botão "${nome.slice(0, 40)}"`)
    const esperaDireta = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null)
    await botao.click()
    let chooser = await esperaDireta

    if (!chooser) {
      // o botão abriu um menu (que fica fora da janela): escolhe a opção "do computador"
      const item = await primeiroVisivel(page, SELETORES.anexarMenuItem, 3000)
      if (item) {
        log('info', 'anexar: escolhi a opção "do computador" no menu')
        const espera = page.waitForEvent('filechooser', { timeout: 10_000 })
        await item.click()
        chooser = await espera
      }
    }
    if (chooser) {
      await chooser.setFiles(arquivos)
      log('info', 'anexar: arquivos enviados pela escolha de arquivos')
      return
    }
  }

  // 2) Alternativa: um campo de arquivo que esteja DENTRO da janela de postagem.
  const input = janela.locator('input[type="file"]')
  if ((await input.count()) > 0) {
    await input.first().setInputFiles(arquivos)
    log('info', 'anexar: arquivos enviados pelo campo de arquivo da janela')
    return
  }

  throw new ErroAdaptador(
    'Não consegui anexar: não achei o botão de anexar dentro da janela de postagem (veja a pasta de capturas).',
  )
}

/** Espera as miniaturas das mídias aparecerem na janela de postagem (o Engage pode demorar). */
async function esperarMiniaturas(page: Page, janela: Locator, antes: number, esperadas: number, timeoutMs: number): Promise<number> {
  const fim = Date.now() + timeoutMs
  let atual = antes
  while (Date.now() < fim) {
    atual = await janela.locator('img, video').count().catch(() => antes)
    if (atual >= antes + esperadas) return atual
    await page.waitForTimeout(700)
  }
  return atual
}

async function esperarEnvioDasMidias(page: Page, janela: Locator, timeoutMs: number): Promise<void> {
  const fim = Date.now() + timeoutMs
  let seguidasSemProgresso = 0
  while (Date.now() < fim) {
    const ocupados = await janela.getByRole('progressbar').count().catch(() => 0)
    seguidasSemProgresso = ocupados === 0 ? seguidasSemProgresso + 1 : 0
    if (seguidasSemProgresso >= 4) return
    await page.waitForTimeout(500)
  }
  throw new ErroAdaptador('O envio das fotos/vídeos demorou demais.')
}

export class VivaEngageAdapter implements AdaptadorPlataforma {
  nome = 'Viva Engage'

  async abrirParaLogin(s: Settings): Promise<void> {
    const page = await paginaAtiva(s)
    await irParaComunidade(page, s)
  }

  async verificarSessao(s: Settings): Promise<{ logado: boolean; mensagem: string }> {
    const page = await paginaAtiva(s)
    await irParaComunidade(page, s)
    if (emTelaDeLogin(page.url())) {
      return { logado: false, mensagem: 'Você ainda não entrou. Faça o login na janela que abriu.' }
    }
    const abrir = await primeiroVisivel(page, [...SELETORES.abrirEditor], 8000)
    return abrir
      ? { logado: true, mensagem: 'Tudo certo: a comunidade abriu e o botão de nova postagem foi encontrado.' }
      : {
          logado: true,
          mensagem:
            'Você está logado, mas não encontrei o botão de nova postagem. Pode ser que seu perfil não possa postar ali, ou que o nome do botão precise de ajuste (veja a pasta de capturas).',
        }
  }

  async publicar(post: Post, s: Settings, op: OpcoesPublicacao): Promise<void> {
    const page = await paginaAtiva(s)
    const rotuloLog = `post ${post.id.slice(0, 8)}`
    try {
      log('info', `${rotuloLog}: abrindo comunidade (adaptador ${VERSAO_ADAPTADOR})`)
      await irParaComunidade(page, s)
      if (emTelaDeLogin(page.url())) {
        throw new ErroSessao('Sua sessão expirou. Vá em Configurações e clique em "Entrar no Engage".')
      }

      log('info', `${rotuloLog}: abrindo editor`)
      const abrir = await primeiroVisivel(page, SELETORES.abrirEditor, 15_000)
      if (!abrir) throw new ErroAdaptador('Não achei o botão para começar uma nova postagem.')
      await abrir.click()

      log('info', `${rotuloLog}: digitando texto`)
      await digitarTexto(page, post, s)

      if (op.arquivos.length > 0) {
        log('info', `${rotuloLog}: anexando ${op.arquivos.length} arquivo(s)`)
        const janela = await acharJanelaDePostagem(page)
        const dentro = await janela.locator('input[type="file"]').count()
        const naPagina = await page.locator('input[type="file"]').count()
        log('info', `${rotuloLog}: campos de arquivo — na janela: ${dentro}, na página toda: ${naPagina}`)
        await salvarEstrutura(janela, `janela-${post.id.slice(0, 8)}`)
        const antes = await janela.locator('img, video').count()
        await anexarArquivos(page, janela, op.arquivos)
        const temVideo = post.midias.some((m) => m.tipo === 'video')
        await esperarEnvioDasMidias(page, janela, temVideo ? 10 * 60_000 : 2 * 60_000)

        // confere que as mídias apareceram na postagem (e não em outro lugar)
        const depois = await esperarMiniaturas(page, janela, antes, op.arquivos.length, temVideo ? 120_000 : 30_000)
        if (depois <= antes) {
          const aviso = 'Anexei os arquivos, mas não vi as miniaturas aparecerem na janela de postagem.'
          if (!s.pararAntesDePublicar) throw new ErroAdaptador(aviso + ' Por segurança, não publiquei.')
          log('erro', `${rotuloLog}: ${aviso} (seguindo: o professor confere na tela)`)
        } else if (depois < antes + op.arquivos.length) {
          log('info', `${rotuloLog}: apareceram ${depois - antes} de ${op.arquivos.length} miniaturas (pode ser só o jeito da tela)`)
        }
      }

      await capturar(page, `pronta-${post.id.slice(0, 8)}`)

      if (s.pararAntesDePublicar) {
        const r = await op.confirmarPublicacaoManual()
        if (r === 'nao-publicada') throw new ErroAdaptador('Você escolheu não publicar esta postagem.')
        return
      }

      log('info', `${rotuloLog}: publicando`)
      const publicar = await primeiroVisivel(page, SELETORES.publicar, 8000)
      if (!publicar) throw new ErroAdaptador('Não achei o botão final de publicar.')
      await publicar.click()

      // confirma: o texto novo precisa aparecer no feed
      const marca = post.campos.descricao.slice(0, 40)
      const apareceu = await page
        .getByText(marca, { exact: false })
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false)
      if (!apareceu) {
        throw new ErroAdaptador(
          'Cliquei em publicar, mas não consegui confirmar que a postagem apareceu. Confira no Engage ANTES de tentar de novo, para não duplicar.',
        )
      }
      log('info', `${rotuloLog}: publicada`)
    } catch (e) {
      const nome = `falha-${post.id.slice(0, 8)}`
      await capturar(page, nome)
      await salvarEstrutura(page, nome)
      log('erro', `${rotuloLog}: ${(e as Error).message}`)
      throw e
    }
  }
}
