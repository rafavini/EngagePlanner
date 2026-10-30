export type PostStatus = 'rascunho' | 'pronta' | 'publicando' | 'publicada' | 'falhou'

export interface MediaItem {
  id: string
  nome: string
  /** caminho relativo à pasta de mídias do app: <postId>/<arquivo> */
  rel: string
  tipo: 'imagem' | 'video'
  tamanho: number
}

/** Os 5 campos do padrão da escola */
export interface PostFields {
  dataAula: string
  ferramentas: string
  turma: string
  uc: string
  descricao: string
}

export interface Post {
  id: string
  criadoEm: string
  atualizadoEm: string
  status: PostStatus
  /** entradas do professor (usadas para montar o pedido à IA) */
  entrada: {
    dataISO: string // yyyy-mm-dd
    turma: string
    uc: string
    relato: string
  }
  campos: PostFields
  midias: MediaItem[]
  erro?: string
  publicadoEm?: string
}

export type NavegadorPreferido = 'auto' | 'msedge' | 'chrome'

export interface Settings {
  comunidadeUrl: string
  navegador: NavegadorPreferido
  modoIA: 'copiar' | 'gemini'
  geminiModelo: string
  /** true = preenche tudo e espera o professor clicar em Publicar no Engage */
  pararAntesDePublicar: boolean
  /** tenta aplicar negrito nos rótulos (Data da aula:, Turma:, ...) */
  rotulosEmNegrito: boolean
  /** pausa entre postagens da fila, em segundos */
  pausaEntrePostagens: number
}

export const SETTINGS_PADRAO: Settings = {
  comunidadeUrl: '',
  navegador: 'auto',
  modoIA: 'copiar',
  geminiModelo: 'gemini-2.5-flash',
  pararAntesDePublicar: true,
  rotulosEmNegrito: true,
  pausaEntrePostagens: 8,
}

export interface AppState {
  settings: Settings
  posts: Post[]
  temChaveGemini: boolean
}

export interface ProgressEvent {
  postId: string
  status: PostStatus
  mensagem?: string
}

export const LIMITES = {
  imagemMaxMB: 25,
  videoMaxMB: 500,
  extensoesImagem: ['.jpg', '.jpeg', '.png', '.webp'],
  extensoesVideo: ['.mp4', '.mov', '.webm'],
}
