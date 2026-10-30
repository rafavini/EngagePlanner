import { CheckCircle2, FileText, Settings as Cog, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Post, ProgressEvent } from '../shared/types'
import { Configuracoes } from './components/Configuracoes'
import { PostEditor } from './components/PostEditor'
import { PostList } from './components/PostList'

type Aviso = { id: number; msg: string; tipo: 'ok' | 'erro' }

export default function App() {
  const [estado, setEstado] = useState<AppState | null>(null)
  const [aba, setAba] = useState<'posts' | 'config'>('posts')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [fila, setFila] = useState(false)
  const proximoId = useRef(1)

  const avisar = useCallback((msg: string, tipo: 'ok' | 'erro' = 'ok') => {
    const id = proximoId.current++
    setAvisos((a) => [...a, { id, msg, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 7000 : 4000)
  }, [])

  const recarregar = useCallback(async () => {
    try {
      const e = await window.api.lerEstado()
      setEstado(e)
      setSelecionado((s) => s ?? e.posts[0]?.id ?? null)
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }, [avisar])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // progresso da publicação vindo do processo principal
  useEffect(() => {
    return window.api.aoProgresso((ev: ProgressEvent) => {
      setEstado((e) =>
        e
          ? { ...e, posts: e.posts.map((p) => (p.id === ev.postId ? { ...p, status: ev.status, erro: ev.status === 'falhou' ? ev.mensagem : undefined } : p)) }
          : e,
      )
      if (ev.status === 'publicada') avisar('Postagem publicada!')
      if (ev.status === 'falhou') avisar(ev.mensagem ?? 'A publicação falhou.', 'erro')
      if (ev.status === 'publicada' || ev.status === 'falhou') void recarregar()
    })
  }, [avisar, recarregar])

  // o processo principal avisa quando a fila termina (ou é interrompida)
  useEffect(() => {
    return window.api.aoFimDaFila(() => {
      setFila(false)
      void recarregar()
    })
  }, [recarregar])

  if (!estado) return <div className="flex h-full items-center justify-center text-slate-500">Carregando…</div>

  const substituir = (p: Post) => setEstado((e) => (e ? { ...e, posts: e.posts.map((x) => (x.id === p.id ? p : x)) } : e))
  const atual = estado.posts.find((p) => p.id === selecionado) ?? null
  const ocupado = fila || estado.posts.some((p) => p.status === 'publicando')
  const semComunidade = !estado.settings.comunidadeUrl

  async function novo() {
    try {
      const p = await window.api.criarPost()
      setEstado((e) => (e ? { ...e, posts: [p, ...e.posts] } : e))
      setSelecionado(p.id)
      setAba('posts')
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  async function publicar(ids: string[]) {
    if (semComunidade) {
      avisar('Configure o link da comunidade antes de publicar.', 'erro')
      setAba('config')
      return
    }
    try {
      setFila(true)
      await window.api.publicar(ids)
      avisar(estado!.settings.pararAntesDePublicar ? 'Abrindo o Engage… você confere e publica lá.' : 'Publicando…')
    } catch (e) {
      setFila(false)
      avisar((e as Error).message, 'erro')
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white"><FileText className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">Postagens Engage</p>
            <p className="text-xs text-slate-500">Registro de aulas</p>
          </div>
        </div>
        <nav className="flex gap-1 border-b border-slate-200 p-2">
          <button onClick={() => setAba('posts')} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${aba === 'posts' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>Postagens</button>
          <button onClick={() => setAba('config')} className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${aba === 'config' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Cog className="h-3.5 w-3.5" /> Configurações
          </button>
        </nav>
        <div className="min-h-0 flex-1">
          <PostList
            posts={estado.posts}
            selecionado={selecionado}
            ocupado={ocupado}
            onSelecionar={(id) => {
              setSelecionado(id)
              setAba('posts')
            }}
            onNovo={novo}
            onPublicarProntas={() => publicar(estado.posts.filter((p) => p.status === 'pronta').map((p) => p.id).reverse())}
            onParar={() => window.api.cancelarFila().then(() => avisar('A fila vai parar depois da postagem atual.')).catch((e) => avisar(e.message, 'erro'))}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {semComunidade && aba === 'posts' && (
          <div className="m-6 mb-0 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>Primeiro passo: cadastre o link da comunidade e entre no Engage.</span>
            <button className="ml-auto font-medium underline" onClick={() => setAba('config')}>Abrir configurações</button>
          </div>
        )}
        {aba === 'config' ? (
          <Configuracoes estado={estado} onEstado={setEstado} avisar={avisar} />
        ) : atual ? (
          <div className="p-6">
            <PostEditor
              key={atual.id}
              post={atual}
              estado={estado}
              ocupado={ocupado}
              onPost={substituir}
              onRemover={async () => {
                if (!confirm('Excluir esta postagem e as mídias dela?')) return
                try {
                  await window.api.removerPost(atual.id)
                  const resto = estado.posts.filter((p) => p.id !== atual.id)
                  setEstado({ ...estado, posts: resto })
                  setSelecionado(resto[0]?.id ?? null)
                } catch (e) {
                  avisar((e as Error).message, 'erro')
                }
              }}
              onDuplicar={async () => {
                try {
                  const p = await window.api.duplicarPost(atual.id)
                  setEstado((e) => (e ? { ...e, posts: [p, ...e.posts] } : e))
                  setSelecionado(p.id)
                } catch (e) {
                  avisar((e as Error).message, 'erro')
                }
              }}
              onPublicar={() => publicar([atual.id])}
              avisar={avisar}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <CheckCircle2 className="h-10 w-10 text-slate-300" />
            <p>Crie sua primeira postagem para começar.</p>
            <button onClick={novo} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">Nova postagem</button>
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
        {avisos.map((a) => (
          <div key={a.id} className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${a.tipo === 'erro' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-white text-slate-800'}`}>
            {a.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
