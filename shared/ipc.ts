import type { AppState, Post, ProgressEvent, Settings } from './types'

export interface Api {
  lerEstado(): Promise<AppState>
  salvarConfig(parcial: Partial<Settings>): Promise<Settings>

  salvarChaveGemini(chave: string): Promise<boolean>
  testarGemini(): Promise<string>
  gerarComGemini(postId: string): Promise<string>

  criarPost(): Promise<Post>
  atualizarPost(id: string, patch: Partial<Pick<Post, 'entrada' | 'campos' | 'status' | 'erro'>>): Promise<Post>
  removerPost(id: string): Promise<void>
  duplicarPost(id: string): Promise<Post>

  escolherMidias(postId: string): Promise<{ post: Post; avisos: string[] }>
  adicionarMidias(postId: string, caminhos: string[]): Promise<{ post: Post; avisos: string[] }>
  removerMidia(postId: string, midiaId: string): Promise<Post>
  caminhoDoArquivo(file: File): string

  entrarNoEngage(): Promise<void>
  verificarEngage(): Promise<{ logado: boolean; mensagem: string }>
  trocarContaEngage(): Promise<void>
  publicar(ids: string[]): Promise<void>
  cancelarFila(): Promise<void>
  aoProgresso(cb: (e: ProgressEvent) => void): () => void
  aoFimDaFila(cb: () => void): () => void

  copiar(texto: string): Promise<void>
  abrirSite(url: string): Promise<void>
  abrirPastaLogs(): Promise<void>
}

declare global {
  interface Window {
    api: Api
  }
}
