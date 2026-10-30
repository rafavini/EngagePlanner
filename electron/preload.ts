import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api } from '../shared/ipc'

type Resposta<T> = { ok: true; data: T } | { ok: false; erro: string }

async function chamar<T>(canal: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(canal, ...args)) as Resposta<T>
  if (!r.ok) throw new Error(r.erro)
  return r.data
}

const api: Api = {
  lerEstado: () => chamar('estado:ler'),
  salvarConfig: (p) => chamar('config:salvar', p),

  salvarChaveGemini: (c) => chamar('gemini:salvarChave', c),
  testarGemini: () => chamar('gemini:testar'),
  gerarComGemini: (id) => chamar('gemini:gerar', id),

  criarPost: () => chamar('post:criar'),
  atualizarPost: (id, patch) => chamar('post:atualizar', id, patch),
  removerPost: (id) => chamar('post:remover', id),
  duplicarPost: (id) => chamar('post:duplicar', id),

  escolherMidias: (id) => chamar('midia:escolher', id),
  adicionarMidias: (id, c) => chamar('midia:adicionar', id, c),
  removerMidia: (id, m) => chamar('midia:remover', id, m),
  caminhoDoArquivo: (file) => webUtils.getPathForFile(file),

  entrarNoEngage: () => chamar('engage:login'),
  verificarEngage: () => chamar('engage:verificar'),
  trocarContaEngage: () => chamar('engage:trocarConta'),
  publicar: (ids) => chamar('publicar:iniciar', ids),
  cancelarFila: () => chamar('publicar:cancelar'),
  aoProgresso: (cb) => {
    const h = (_: unknown, e: Parameters<typeof cb>[0]) => cb(e)
    ipcRenderer.on('publicar:progresso', h)
    return () => ipcRenderer.removeListener('publicar:progresso', h)
  },

  aoFimDaFila: (cb) => {
    const h = () => cb()
    ipcRenderer.on('publicar:fim', h)
    return () => ipcRenderer.removeListener('publicar:fim', h)
  },

  copiar: (t) => chamar('sistema:copiar', t),
  abrirSite: (u) => chamar('sistema:abrirSite', u),
  abrirPastaLogs: () => chamar('sistema:abrirLogs'),
}

contextBridge.exposeInMainWorld('api', api)
