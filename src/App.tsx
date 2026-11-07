import { CalendarDays, CheckCircle2, ChevronsLeft, FileText, History, Home, ListChecks, Plus, Settings as Cog, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Post, ProgressEvent } from '../shared/types'
import { Configuracoes } from './components/Configuracoes'
import { Dashboard } from './components/Dashboard'
import { PostEditor } from './components/PostEditor'
import { PostList } from './components/PostList'

type Aviso = { id: number; msg: string; tipo: 'ok' | 'erro' }
type Tela = 'geral' | 'posts' | 'fila' | 'historico' | 'config'

/** Postagens que ainda vão sair: prontas e em andamento. */
const naFila = (p: Post) => p.status === 'pronta' || p.status === 'publicando'

export default function App() {
  const [estado, setEstado] = useState<AppState | null>(null)
  const [tela, setTela] = useState<Tela>('geral')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [fila, setFila] = useState(false)
  const [recolhido, setRecolhido] = useState(false)
  const [engage, setEngage] = useState<{ logado: boolean; mensagem: string } | null>(null)
  const [verificando, setVerificando] = useState(false)
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

  if (!estado) return <div className="flex h-full items-center justify-center bg-page text-slate-500">Carregando…</div>

  const substituir = (p: Post) => setEstado((e) => (e ? { ...e, posts: e.posts.map((x) => (x.id === p.id ? p : x)) } : e))
  const ocupado = fila || estado.posts.some((p) => p.status === 'publicando')
  const semComunidade = !estado.settings.comunidadeUrl
  const naFilaQtd = estado.posts.filter(naFila).length

  // lista mostrada na coluna do meio, conforme a tela
  const visiveis = tela === 'fila' ? estado.posts.filter(naFila) : tela === 'historico' ? estado.posts.filter((p) => p.status === 'publicada') : estado.posts
  const atual = visiveis.find((p) => p.id === selecionado) ?? null
  const comLista = tela === 'posts' || tela === 'fila' || tela === 'historico'

  async function novo() {
    try {
      const p = await window.api.criarPost()
      setEstado((e) => (e ? { ...e, posts: [p, ...e.posts] } : e))
      setSelecionado(p.id)
      setTela('posts')
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  async function publicar(ids: string[]) {
    if (semComunidade) {
      avisar('Configure o link da comunidade antes de publicar.', 'erro')
      setTela('config')
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

  /** Só roda quando a pessoa clica: abre o navegador do app e olha se o login ainda vale. */
  async function verificarEngage() {
    if (semComunidade) {
      setTela('config')
      return
    }
    if (ocupado) {
      avisar('Espere a publicação terminar para verificar a conexão.', 'erro')
      return
    }
    setVerificando(true)
    try {
      const r = await window.api.verificarEngage()
      setEngage(r)
      avisar(r.mensagem, r.logado ? 'ok' : 'erro')
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setVerificando(false)
    }
  }

  const statusEngage = semComunidade
    ? { cor: 'bg-amber-400', texto: 'Engage não configurado' }
    : engage === null
      ? { cor: 'bg-slate-400', texto: 'Conexão não verificada' }
      : engage.logado
        ? { cor: 'bg-green-700', texto: 'Viva Engage conectado' }
        : { cor: 'bg-red-600', texto: 'Viva Engage desconectado' }

  const itens: { id: Tela | 'nova'; nome: string; Icone: LucideIcon; contador?: number }[] = [
    { id: 'geral', nome: 'Visão geral', Icone: Home },
    { id: 'posts', nome: 'Publicações', Icone: FileText },
    { id: 'nova', nome: 'Nova publicação', Icone: Plus },
    { id: 'fila', nome: 'Fila de publicação', Icone: ListChecks, contador: naFilaQtd },
    { id: 'historico', nome: 'Histórico', Icone: History },
    { id: 'config', nome: 'Configurações', Icone: Cog },
  ]

  return (
    <div className="flex h-full flex-col bg-page text-slate-800">
      <div className="flex min-h-0 flex-1">
        <aside className={`flex shrink-0 flex-col border-r border-slate-200 bg-side transition-all ${recolhido ? 'w-[4.5rem]' : 'w-64'}`}>
          <div className="flex items-center gap-3 px-4 py-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><CalendarDays className="h-5 w-5" /></div>
            {!recolhido && (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold leading-tight text-slate-900">Engage Planner</p>
                <p className="truncate text-xs text-slate-500">Publicações inteligentes</p>
              </div>
            )}
          </div>

          <nav className="space-y-1 px-3">
            {itens.map(({ id, nome, Icone, contador }) => {
              const ativo = id === tela
              return (
                <button
                  key={id}
                  title={nome}
                  onClick={() => (id === 'nova' ? void novo() : setTela(id))}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${ativo ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'} ${recolhido ? 'justify-center' : ''}`}
                >
                  <Icone className="h-[18px] w-[18px] shrink-0" />
                  {!recolhido && <span className="flex-1 truncate text-left">{nome}</span>}
                  {!recolhido && contador ? <span className="rounded-md bg-amber-400 px-1.5 text-xs font-semibold text-black">{contador}</span> : null}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-slate-200 p-3">
            <button
              onClick={verificarEngage}
              disabled={verificando}
              title="Verificar conexão com o Viva Engage"
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-slate-100 ${recolhido ? 'justify-center' : ''}`}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusEngage.cor} ${verificando ? 'animate-pulse' : ''}`} />
              {!recolhido && (
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{verificando ? 'Verificando…' : statusEngage.texto}</span>
                  <span className="block text-xs text-slate-500">Clique para verificar</span>
                </span>
              )}
            </button>
            <button
              onClick={() => setRecolhido((v) => !v)}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${recolhido ? 'justify-center' : ''}`}
            >
              <ChevronsLeft className={`h-4 w-4 transition-transform ${recolhido ? 'rotate-180' : ''}`} />
              {!recolhido && 'Recolher sidebar'}
            </button>
          </div>
        </aside>

        {comLista && (
          <section className="w-80 shrink-0 border-r border-slate-200 bg-side">
            <PostList
              posts={visiveis}
              selecionado={selecionado}
              ocupado={ocupado}
              vazio={tela === 'fila' ? 'Nenhuma postagem na fila. Marque uma postagem como pronta para ela aparecer aqui.' : tela === 'historico' ? 'Nada foi publicado ainda.' : undefined}
              onSelecionar={setSelecionado}
              onNovo={novo}
              onPublicarProntas={() => publicar(estado.posts.filter((p) => p.status === 'pronta').map((p) => p.id).reverse())}
              onParar={() => window.api.cancelarFila().then(() => avisar('A fila vai parar depois da postagem atual.')).catch((e) => avisar(e.message, 'erro'))}
            />
          </section>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          {semComunidade && tela !== 'config' && (
            <div className="mx-6 mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              <span>Primeiro passo: cadastre o link da comunidade e entre no Engage.</span>
              <button className="ml-auto font-medium underline" onClick={() => setTela('config')}>Abrir configurações</button>
            </div>
          )}

          {tela === 'config' ? (
            <Configuracoes estado={estado} onEstado={setEstado} avisar={avisar} />
          ) : tela === 'geral' ? (
            <Dashboard
              posts={estado.posts}
              metaMensal={estado.settings.metaMensal}
              onNovo={novo}
              onAbrir={(id) => {
                setSelecionado(id)
                setTela('posts')
              }}
              onVerTodas={() => setTela('historico')}
            />
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
                    setTela('posts')
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
              <p>{estado.posts.length === 0 ? 'Crie sua primeira postagem para começar.' : 'Escolha uma postagem na lista.'}</p>
              {estado.posts.length === 0 && (
                <button onClick={novo} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">Nova postagem</button>
              )}
            </div>
          )}
        </main>
      </div>

      <footer className="flex shrink-0 items-center gap-5 border-t border-slate-200 bg-side px-5 py-2 text-xs text-slate-500">
        <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${statusEngage.cor}`} />{statusEngage.texto}</span>
        <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" />{naFilaQtd} {naFilaQtd === 1 ? 'publicação' : 'publicações'} na fila</span>
        {ocupado && <span className="animate-pulse text-amber-700">Publicando…</span>}
      </footer>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
        {avisos.map((a) => (
          <div key={a.id} className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${a.tipo === 'erro' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-surface text-slate-800'}`}>
            {a.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
