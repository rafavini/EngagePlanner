import { app, safeStorage } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { LIMITES, SETTINGS_PADRAO, type MediaItem, type Post, type Settings } from '../shared/types'
import { camposVazios } from '../shared/format'

interface Dados {
  settings: Settings
  posts: Post[]
  /** chave do Gemini criptografada com safeStorage (base64) */
  geminiChaveCript?: string
}

const base = () => app.getPath('userData')
const arquivoDados = () => path.join(base(), 'dados.json')
export const pastaMidias = () => {
  const d = path.join(base(), 'midias')
  fs.mkdirSync(d, { recursive: true })
  return d
}

let dados: Dados | null = null

function carregar(): Dados {
  if (dados) return dados
  let lido: Partial<Dados> = {}
  try {
    lido = JSON.parse(fs.readFileSync(arquivoDados(), 'utf8'))
  } catch {
    /* primeira execução ou arquivo ilegível */
  }
  dados = {
    settings: { ...SETTINGS_PADRAO, ...(lido.settings ?? {}) },
    posts: lido.posts ?? [],
    geminiChaveCript: lido.geminiChaveCript,
  }
  // Postagem que ficou "publicando" quando o app fechou: NÃO republicar sozinho.
  for (const p of dados.posts) {
    if (p.status === 'publicando') {
      p.status = 'falhou'
      p.erro = 'O app foi fechado durante a publicação. Confira no Engage se a postagem já saiu antes de tentar de novo.'
    }
  }
  salvar()
  return dados
}

function salvar(): void {
  if (!dados) return
  const tmp = arquivoDados() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2))
  fs.renameSync(tmp, arquivoDados())
}

export const getSettings = () => carregar().settings
export const getPosts = () => carregar().posts
export const getPost = (id: string) => carregar().posts.find((p) => p.id === id)

export function salvarSettings(parcial: Partial<Settings>): Settings {
  const d = carregar()
  d.settings = { ...d.settings, ...parcial }
  salvar()
  return d.settings
}

/** Data de hoje no fuso do computador (não em UTC, que vira "amanhã" à noite). */
function dataLocalISO(): string {
  const d = new Date()
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

export function criarPost(): Post {
  const d = carregar()
  const agora = new Date().toISOString()
  const post: Post = {
    id: crypto.randomUUID(),
    criadoEm: agora,
    atualizadoEm: agora,
    status: 'rascunho',
    entrada: { dataISO: dataLocalISO(), turma: '', uc: '', relato: '' },
    campos: camposVazios(),
    midias: [],
  }
  d.posts.unshift(post)
  salvar()
  return post
}

export function atualizarPost(id: string, patch: Partial<Pick<Post, 'entrada' | 'campos' | 'status' | 'erro' | 'publicadoEm'>>): Post {
  const p = getPost(id)
  if (!p) throw new Error('Postagem não encontrada.')
  if (p.status === 'publicando') throw new Error('Esta postagem está sendo publicada agora.')
  Object.assign(p, patch)
  p.atualizadoEm = new Date().toISOString()
  salvar()
  return p
}

/** Uso interno da publicação (permite mudar o status durante o envio) */
export function definirStatus(id: string, status: Post['status'], erro?: string): Post {
  const p = getPost(id)
  if (!p) throw new Error('Postagem não encontrada.')
  p.status = status
  p.erro = erro
  if (status === 'publicada') p.publicadoEm = new Date().toISOString()
  p.atualizadoEm = new Date().toISOString()
  salvar()
  return p
}

export function removerPost(id: string): void {
  const d = carregar()
  const p = getPost(id)
  if (p?.status === 'publicando') throw new Error('Esta postagem está sendo publicada agora.')
  d.posts = d.posts.filter((x) => x.id !== id)
  fs.rmSync(path.join(pastaMidias(), id), { recursive: true, force: true })
  salvar()
}

export function duplicarPost(id: string): Post {
  const d = carregar()
  const orig = getPost(id)
  if (!orig) throw new Error('Postagem não encontrada.')
  const novo = criarPost()
  novo.entrada = { ...orig.entrada }
  novo.campos = { ...orig.campos }
  // mídias não são copiadas: cada postagem tem suas próprias fotos
  d.posts = [novo, ...d.posts.filter((p) => p.id !== novo.id)]
  salvar()
  return novo
}

// ---------- mídias ----------

export function classificar(arquivo: string): { tipo: MediaItem['tipo']; erro?: string } | { erro: string } {
  const ext = path.extname(arquivo).toLowerCase()
  if (LIMITES.extensoesImagem.includes(ext)) return { tipo: 'imagem' }
  if (LIMITES.extensoesVideo.includes(ext)) return { tipo: 'video' }
  return { erro: `Formato não aceito: ${ext || 'sem extensão'}. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.` }
}

export function adicionarMidias(postId: string, caminhos: string[]): { post: Post; avisos: string[] } {
  const p = getPost(postId)
  if (!p) throw new Error('Postagem não encontrada.')
  const avisos: string[] = []
  const destDir = path.join(pastaMidias(), postId)
  fs.mkdirSync(destDir, { recursive: true })

  for (const origem of caminhos) {
    try {
      const c = classificar(origem)
      if ('erro' in c && c.erro) {
        avisos.push(`${path.basename(origem)}: ${c.erro}`)
        continue
      }
      const stat = fs.statSync(origem)
      if (!stat.isFile()) continue
      const tipo = (c as { tipo: MediaItem['tipo'] }).tipo
      const maxMB = tipo === 'imagem' ? LIMITES.imagemMaxMB : LIMITES.videoMaxMB
      if (stat.size > maxMB * 1024 * 1024) {
        avisos.push(`${path.basename(origem)}: maior que ${maxMB} MB.`)
        continue
      }
      const id = crypto.randomUUID()
      const nomeSeguro = id.slice(0, 8) + '-' + path.basename(origem).replace(/[^\w.\-]+/g, '_')
      fs.copyFileSync(origem, path.join(destDir, nomeSeguro))
      p.midias.push({ id, nome: path.basename(origem), rel: `${postId}/${nomeSeguro}`, tipo, tamanho: stat.size })
    } catch (e) {
      avisos.push(`${path.basename(origem)}: ${(e as Error).message}`)
    }
  }
  p.atualizadoEm = new Date().toISOString()
  salvar()
  return { post: p, avisos }
}

export function removerMidia(postId: string, midiaId: string): Post {
  const p = getPost(postId)
  if (!p) throw new Error('Postagem não encontrada.')
  const m = p.midias.find((x) => x.id === midiaId)
  if (m) fs.rmSync(path.join(pastaMidias(), m.rel), { force: true })
  p.midias = p.midias.filter((x) => x.id !== midiaId)
  salvar()
  return p
}

export function caminhoAbsolutoMidia(m: MediaItem): string {
  const abs = path.resolve(pastaMidias(), m.rel)
  if (!abs.startsWith(path.resolve(pastaMidias()) + path.sep)) throw new Error('Caminho de mídia inválido.')
  return abs
}

// ---------- chave do Gemini (criptografada pelo sistema operacional) ----------

export function temChaveGemini(): boolean {
  return !!carregar().geminiChaveCript
}

export function salvarChaveGemini(chave: string): void {
  const d = carregar()
  const limpa = chave.trim()
  if (!limpa) {
    d.geminiChaveCript = undefined
  } else {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Este computador não permite guardar a chave com segurança. Use o modo "Copiar e colar".')
    }
    d.geminiChaveCript = safeStorage.encryptString(limpa).toString('base64')
  }
  salvar()
}

export function lerChaveGemini(): string | null {
  const c = carregar().geminiChaveCript
  if (!c) return null
  try {
    return safeStorage.decryptString(Buffer.from(c, 'base64'))
  } catch {
    return null
  }
}
