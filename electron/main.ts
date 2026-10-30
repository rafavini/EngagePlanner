import { app, BrowserWindow, clipboard, dialog, ipcMain, net, Notification, protocol, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { montarPrompt, pendentesDoPost, ROTULOS } from '../shared/format'
import type { Post, ProgressEvent } from '../shared/types'
import { Gemini } from './ai'
import { ErroSessao, VERSAO_ADAPTADOR, VivaEngageAdapter } from './engage/adapter'
import { apagarPerfil, fecharContexto } from './engage/browser'
import { log, pastaLogs } from './log'
import * as store from './store'

protocol.registerSchemesAsPrivileged([
  { scheme: 'app-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

const SITES_PERMITIDOS = [
  'https://chatgpt.com',
  'https://claude.ai',
  'https://copilot.microsoft.com',
  'https://m365.cloud.microsoft',
  'https://gemini.google.com',
  'https://aistudio.google.com',
]

let janela: BrowserWindow | null = null
let rodando = false
const engage = new VivaEngageAdapter()

/** Aviso do sistema (canto da tela): aparece mesmo com a janela do Engage na frente. */
function notificar(titulo: string, corpo: string): void {
  try {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: titulo, body: corpo.slice(0, 240) })
    n.on('click', () => {
      if (janela) {
        if (janela.isMinimized()) janela.restore()
        janela.show()
        janela.focus()
      }
    })
    n.show()
  } catch (e) {
    log('erro', `notificação: ${(e as Error).message}`)
  }
}

function criarJanela(): void {
  janela = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Postagens Engage',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // O app só carrega o próprio conteúdo; links externos são bloqueados.
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  janela.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) e.preventDefault()
  })

  if (process.env.ELECTRON_DEV) {
    void janela.loadURL('http://localhost:5173')
  } else {
    void janela.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
  janela.on('closed', () => {
    janela = null
  })
}

// ---------- IPC ----------

type Resposta<T> = { ok: true; data: T } | { ok: false; erro: string }

function h<T>(canal: string, fn: (...args: any[]) => T | Promise<T>): void {
  ipcMain.handle(canal, async (_e, ...args): Promise<Resposta<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (e) {
      const msg = (e as Error).message || 'Algo deu errado.'
      log('erro', `${canal}: ${msg}`)
      return { ok: false, erro: msg }
    }
  })
}

function emitir(e: ProgressEvent): void {
  janela?.webContents.send('publicar:progresso', e)
}

h('estado:ler', () => ({
  settings: store.getSettings(),
  posts: store.getPosts(),
  temChaveGemini: store.temChaveGemini(),
}))
h('config:salvar', (parcial) => store.salvarSettings(parcial))

h('gemini:salvarChave', (chave: string) => {
  store.salvarChaveGemini(chave)
  return store.temChaveGemini()
})
h('gemini:testar', async () => {
  const ia = new Gemini(store.getSettings().geminiModelo)
  await ia.gerar('Responda apenas com a palavra: ok')
  return 'Conexão funcionando.'
})
h('gemini:gerar', async (postId: string) => {
  const post = store.getPost(postId)
  if (!post) throw new Error('Postagem não encontrada.')
  if (!post.entrada.relato.trim()) throw new Error('Escreva o que aconteceu na aula antes de gerar o texto.')
  const ia = new Gemini(store.getSettings().geminiModelo)
  // Só o relato em texto vai para a IA: fotos e vídeos nunca saem do computador.
  return ia.gerar(montarPrompt(post.entrada))
})

h('post:criar', () => store.criarPost())
h('post:atualizar', (id: string, patch) => store.atualizarPost(id, patch))
h('post:remover', (id: string) => store.removerPost(id))
h('post:duplicar', (id: string) => store.duplicarPost(id))

h('midia:escolher', async (postId: string) => {
  const r = await dialog.showOpenDialog(janela!, {
    title: 'Escolha as fotos e vídeos',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Fotos e vídeos', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'] }],
  })
  if (r.canceled) return { post: store.getPost(postId)!, avisos: [] as string[] }
  return store.adicionarMidias(postId, r.filePaths)
})
h('midia:adicionar', (postId: string, caminhos: string[]) => store.adicionarMidias(postId, caminhos))
h('midia:remover', (postId: string, midiaId: string) => store.removerMidia(postId, midiaId))

h('engage:login', async () => {
  await engage.abrirParaLogin(store.getSettings())
})
h('engage:trocarConta', async () => {
  if (rodando) throw new Error('Espere a publicação terminar antes de trocar de conta.')
  await apagarPerfil()
})
h('engage:verificar', () => engage.verificarSessao(store.getSettings()))

// ---------- fila de publicação ----------

let cancelar = false
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function confirmarManual(post: Post): Promise<'publicada' | 'nao-publicada'> {
  notificar('Postagem pronta para conferir', 'Confira na janela do Engage e clique em Publicar. Depois volte ao app e confirme.')
  const r = await dialog.showMessageBox({
    type: 'question',
    title: 'Confira no Engage',
    message: 'A postagem está pronta na janela do Engage.',
    detail:
      `Confira o texto e as mídias (${post.campos.turma || 'sem turma'}). ` +
      'Se estiver tudo certo, clique em "Publicar" na janela do Engage e só depois volte aqui e escolha "Já publiquei".',
    buttons: ['Já publiquei', 'Não publiquei'],
    defaultId: 0,
    cancelId: 1,
  })
  return r.response === 0 ? 'publicada' : 'nao-publicada'
}

async function rodarFila(ids: string[]): Promise<void> {
  if (rodando) throw new Error('Já existe uma publicação em andamento.')
  rodando = true
  cancelar = false
  let feitas = 0
  let falhas = 0
  try {
    const fila = ids.map((id) => store.getPost(id)).filter((p): p is Post => !!p && p.status !== 'publicada')
    for (let i = 0; i < fila.length; i++) {
      if (cancelar) break
      const post = store.getPost(fila[i].id)!
      const settings = store.getSettings()

      const faltando = pendentesDoPost(post.campos)
      if (faltando.length > 0) {
        const msg = `Faltam campos: ${faltando.map((c) => ROTULOS[c]).join(', ')}.`
        store.definirStatus(post.id, 'falhou', msg)
        emitir({ postId: post.id, status: 'falhou', mensagem: msg })
        falhas++
        notificar('Não foi possível publicar', `${post.entrada.turma || 'Postagem'}: ${msg}`)
        continue
      }

      store.definirStatus(post.id, 'publicando')
      emitir({ postId: post.id, status: 'publicando', mensagem: 'Abrindo o Engage…' })
      try {
        await engage.publicar(post, settings, {
          arquivos: post.midias.map((m) => store.caminhoAbsolutoMidia(m)),
          confirmarPublicacaoManual: () => confirmarManual(post),
        })
        store.definirStatus(post.id, 'publicada')
        emitir({ postId: post.id, status: 'publicada' })
        feitas++
      } catch (e) {
        const msg = (e as Error).message
        store.definirStatus(post.id, 'falhou', msg)
        emitir({ postId: post.id, status: 'falhou', mensagem: msg })
        falhas++
        notificar('Não foi possível publicar', `${post.entrada.turma || 'Postagem'}: ${msg}`)
        if (e instanceof ErroSessao) break // sem sessão, não adianta tentar as próximas
      }

      if (i < fila.length - 1 && !cancelar) await dormir(settings.pausaEntrePostagens * 1000)
    }
    if (feitas + falhas > 0) {
      if (falhas === 0) notificar('Publicação concluída', feitas === 1 ? 'A postagem foi publicada.' : `${feitas} postagens publicadas.`)
      else notificar('Publicação terminou com problemas', `${feitas} publicada(s), ${falhas} com erro. Abra o app para ver o que aconteceu.`)
    }
  } finally {
    rodando = false
    janela?.webContents.send('publicar:fim')
  }
}

h('publicar:iniciar', (ids: string[]) => {
  if (rodando) throw new Error('Já existe uma publicação em andamento.')
  // roda em segundo plano; o progresso volta por eventos
  void rodarFila(ids).catch((e) => log('erro', `fila: ${(e as Error).message}`))
})
h('publicar:cancelar', () => {
  cancelar = true
})

h('sistema:copiar', (t: string) => clipboard.writeText(t))
h('sistema:abrirSite', async (url: string) => {
  if (!SITES_PERMITIDOS.some((s) => url === s || url.startsWith(s + '/'))) throw new Error('Endereço não permitido.')
  await shell.openExternal(url)
})
h('sistema:abrirLogs', async () => {
  await shell.openPath(pastaLogs())
})

// ---------- ciclo de vida ----------

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore()
      janela.focus()
    }
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('br.senac.postagens-engage')
    // app-media://m/<postId>/<arquivo>  ->  arquivo dentro da pasta de mídias (e só dela)
    protocol.handle('app-media', (req) => {
      const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '')
      const abs = path.resolve(store.pastaMidias(), rel)
      if (!abs.startsWith(path.resolve(store.pastaMidias()) + path.sep)) {
        return new Response('negado', { status: 403 })
      }
      return net.fetch(pathToFileURL(abs).toString(), { headers: req.headers })
    })
    log('info', `App iniciado (adaptador ${VERSAO_ADAPTADOR})`)
    criarJanela()
  })

  app.on('window-all-closed', () => {
    void fecharContexto().finally(() => app.quit())
  })
}
