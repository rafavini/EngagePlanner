import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { PostStatus } from '../../shared/types'

type Variante = 'primary' | 'secondary' | 'ghost' | 'danger'

const ESTILOS: Record<Variante, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-slate-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:text-slate-300',
}

export function Botao({
  variante = 'secondary',
  carregando,
  icone,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${ESTILOS[variante]} ${className}`}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      {children}
    </button>
  )
}

const CORES_STATUS: Record<PostStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  pronta: 'bg-blue-100 text-blue-700',
  publicando: 'bg-amber-100 text-amber-700 animate-pulse',
  publicada: 'bg-green-100 text-green-700',
  falhou: 'bg-red-100 text-red-700',
}
const NOMES_STATUS: Record<PostStatus, string> = {
  rascunho: 'Rascunho',
  pronta: 'Pronta',
  publicando: 'Publicando…',
  publicada: 'Publicada',
  falhou: 'Não publicou',
}

export function StatusChip({ status }: { status: PostStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CORES_STATUS[status]}`}>{NOMES_STATUS[status]}</span>
}

export function Passo({ n, titulo, dica, children }: { n: number; titulo: string; dica?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{n}</span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          {dica && <p className="mt-0.5 text-sm text-slate-500">{dica}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export function Campo({ rotulo, alerta, children }: { rotulo: string; alerta?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm font-medium ${alerta ? 'text-amber-700' : 'text-slate-700'}`}>{rotulo}</span>
      {children}
    </label>
  )
}

export const classeEntrada =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50'

export function Interruptor({ ligado, onChange, titulo, descricao }: { ligado: boolean; onChange: (v: boolean) => void; titulo: string; descricao?: string }) {
  return (
    <button type="button" onClick={() => onChange(!ligado)} className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${ligado ? 'bg-brand' : 'bg-slate-300'}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${ligado ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-800">{titulo}</span>
        {descricao && <span className="block text-sm text-slate-500">{descricao}</span>}
      </span>
    </button>
  )
}
