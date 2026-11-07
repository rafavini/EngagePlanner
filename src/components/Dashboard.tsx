import { CalendarDays, Clock, Image as ImageIcon, LineChart, List, Plus, Send, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatarDataPt } from '../../shared/format'
import type { Post } from '../../shared/types'
import { titulo } from './PostList'
import { Botao, StatusChip } from './ui'

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Data em que a postagem entrou no Engage (ou, na falta, a última alteração). */
function dataDePublicacao(p: Post): Date {
  return new Date(p.publicadoEm ?? p.atualizadoEm)
}

function inicioDaSemana(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - r.getDay()) // domingo
  return r
}

function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

function Variacao({ valor, legenda }: { valor: number | null; legenda: string }) {
  if (valor === null) return <p className="mt-2 text-xs text-slate-500">{legenda}</p>
  const sobe = valor >= 0
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`font-semibold ${sobe ? 'text-green-700' : 'text-red-600'}`}>{sobe ? '↑' : '↓'} {Math.abs(valor)}%</span>
      {legenda}
    </p>
  )
}

function Cartao({ icone, rotulo, valor, rodape }: { icone: React.ReactNode; rotulo: string; valor: number; rodape: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-brand">{icone}</div>
      <p className="text-sm text-slate-700">{rotulo}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{valor}</p>
      {rodape}
    </div>
  )
}

function Miniatura({ post }: { post: Post }) {
  const foto = post.midias.find((m) => m.tipo === 'imagem')
  return foto ? (
    <img src={`app-media://m/${encodeURI(foto.rel)}`} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
      <ImageIcon className="h-5 w-5" />
    </div>
  )
}

export function Dashboard({
  posts,
  metaMensal,
  nome,
  onNovo,
  onAbrir,
  onVerTodas,
}: {
  posts: Post[]
  metaMensal: number
  nome?: string
  onNovo: () => void
  onAbrir: (id: string) => void
  onVerTodas: () => void
}) {
  const [meses, setMeses] = useState<6 | 12>(6)

  const dados = useMemo(() => {
    const agora = new Date()
    const publicadas = posts.filter((p) => p.status === 'publicada')

    const doMes = (ref: Date) =>
      publicadas.filter((p) => {
        const d = dataDePublicacao(p)
        return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
      })
    const mesAtual = doMes(agora)
    const mesAnterior = doMes(new Date(agora.getFullYear(), agora.getMonth() - 1, 1))

    const iniSemana = inicioDaSemana(agora)
    const iniSemanaAnt = new Date(iniSemana)
    iniSemanaAnt.setDate(iniSemanaAnt.getDate() - 7)
    const semanaAtual = publicadas.filter((p) => dataDePublicacao(p) >= iniSemana).length
    const semanaAnterior = publicadas.filter((p) => {
      const d = dataDePublicacao(p)
      return d >= iniSemanaAnt && d < iniSemana
    }).length

    const serie = Array.from({ length: 12 }, (_, i) => {
      const ref = new Date(agora.getFullYear(), agora.getMonth() - (11 - i), 1)
      return { rotulo: MESES_CURTOS[ref.getMonth()], total: doMes(ref).length, atual: i === 11 }
    })

    return {
      total: publicadas.length,
      mesAtual,
      semanaAtual,
      aguardando: posts.filter((p) => p.status === 'rascunho' || p.status === 'pronta').length,
      varMes: variacao(mesAtual.length, mesAnterior.length),
      varSemana: variacao(semanaAtual, semanaAnterior),
      serie,
      fotosMes: mesAtual.reduce((n, p) => n + p.midias.filter((m) => m.tipo === 'imagem').length, 0),
      videosMes: mesAtual.reduce((n, p) => n + p.midias.filter((m) => m.tipo === 'video').length, 0),
    }
  }, [posts])

  const serie = dados.serie.slice(12 - meses)
  const maximo = Math.max(5, ...serie.map((s) => s.total))
  const escala = Math.ceil(maximo / 5) * 5
  const pct = metaMensal > 0 ? Math.min(100, Math.round((dados.mesAtual.length / metaMensal) * 100)) : 0
  const recentes = posts.filter((p) => p.status === 'publicada').sort((a, b) => dataDePublicacao(b).getTime() - dataDePublicacao(a).getTime()).slice(0, 5)

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  // anel de progresso da meta
  const raio = 34
  const circ = 2 * Math.PI * raio

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{saudacao}{nome ? `, ${nome}` : ''}! 👋</h1>
          <p className="mt-1 text-sm text-slate-500">Acompanhe suas publicações e atividades no Viva Engage.</p>
        </div>
        <Botao variante="primary" icone={<Plus className="h-4 w-4" />} onClick={onNovo}>Nova publicação</Botao>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Cartao icone={<Send className="h-5 w-5" />} rotulo="Total de publicações" valor={dados.total} rodape={<p className="mt-2 text-xs text-slate-500">desde o início</p>} />
        <Cartao icone={<CalendarDays className="h-5 w-5" />} rotulo="Publicações neste mês" valor={dados.mesAtual.length} rodape={<Variacao valor={dados.varMes} legenda="em relação ao mês anterior" />} />
        <Cartao icone={<LineChart className="h-5 w-5" />} rotulo="Publicações nesta semana" valor={dados.semanaAtual} rodape={<Variacao valor={dados.varSemana} legenda="em relação à semana anterior" />} />
        <Cartao icone={<Clock className="h-5 w-5" />} rotulo="Aguardando publicação" valor={dados.aguardando} rodape={<p className="mt-2 text-xs text-slate-500">Rascunhos e fila</p>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-2xl border border-slate-200 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><LineChart className="h-4 w-4 text-brand" /> Sua atividade</h2>
              <div className="flex gap-1 rounded-full bg-page p-1 text-xs">
                {([6, 12] as const).map((n) => (
                  <button key={n} onClick={() => setMeses(n)} className={`rounded-full px-3 py-1 font-medium ${meses === n ? 'bg-blue-50 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Últimos {n} meses
                  </button>
                ))}
              </div>
            </div>
            <div className="flex h-52 gap-3">
              <div className="flex flex-col justify-between pb-6 text-xs text-slate-400">
                {[5, 4, 3, 2, 1, 0].map((i) => <span key={i}>{Math.round((escala / 5) * i)}</span>)}
              </div>
              <div className="relative flex flex-1 items-end gap-2 border-b border-slate-200 pb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200" style={{ bottom: `calc(1.5rem + (100% - 1.5rem) * ${i / 5})` }} />
                ))}
                {serie.map((s, i) => (
                  <div key={i} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end">
                    <span className={`mb-1 text-xs ${s.atual ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{s.total}</span>
                    <div
                      className={`w-full max-w-12 rounded-t-md ${s.atual ? 'bg-brand' : 'bg-blue-100'}`}
                      style={{ height: `calc((100% - 2.5rem) * ${s.total / escala})`, minHeight: s.total > 0 ? 4 : 0 }}
                    />
                    <span className="absolute -bottom-6 text-xs text-slate-500">{s.rotulo}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900"><CalendarDays className="h-4 w-4 text-brand" /> Resumo do mês</h2>
            <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-4">
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90">
                  <circle cx="40" cy="40" r={raio} fill="none" stroke="var(--color-slate-200)" strokeWidth="7" />
                  <circle cx="40" cy="40" r={raio} fill="none" stroke="var(--color-green-700)" strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
                  <text x="40" y="40" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-slate-900 text-[15px] font-semibold" style={{ transformOrigin: '40px 40px' }}>{pct}%</text>
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-800">Meta mensal</p>
                  <p className="text-lg font-semibold text-slate-900">{dados.mesAtual.length} / {metaMensal}</p>
                  <p className="text-xs text-slate-500">publicações realizadas</p>
                </div>
              </div>
              <Resumo icone={<Send className="h-4 w-4" />} rotulo="Aulas registradas" valor={dados.mesAtual.length} />
              <Resumo icone={<ImageIcon className="h-4 w-4" />} rotulo="Fotos adicionadas" valor={dados.fotosMes} />
              <Resumo icone={<Video className="h-4 w-4" />} rotulo="Vídeos adicionados" valor={dados.videosMes} />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-surface p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><List className="h-4 w-4 text-brand" /> Publicações recentes</h2>
            <button onClick={onVerTodas} className="text-sm font-medium text-brand hover:underline">Ver todas →</button>
          </div>
          {recentes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhuma publicação ainda. Suas aulas publicadas aparecem aqui.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {recentes.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onAbrir(p.id)} className="flex w-full items-center gap-3 py-3 text-left hover:opacity-90">
                    <Miniatura post={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{p.entrada.uc.trim() || 'Sem UC'}</p>
                      <p className="text-xs text-slate-500">Data da aula: {formatarDataPt(p.entrada.dataISO) || '—'}</p>
                      <p className="truncate text-xs text-slate-500">
                        {titulo(p)} ·{' '}
                        <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3 w-3" /> {p.midias.filter((m) => m.tipo === 'imagem').length}</span>{' '}
                        <span className="inline-flex items-center gap-0.5"><Video className="h-3 w-3" /> {p.midias.filter((m) => m.tipo === 'video').length}</span>
                      </p>
                    </div>
                    <StatusChip status={p.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Resumo({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: number }) {
  return (
    <div className="border-slate-200 sm:border-l sm:pl-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-brand">{icone}</div>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-xl font-semibold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500">este mês</p>
    </div>
  )
}
