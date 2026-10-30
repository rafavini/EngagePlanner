import { Image as ImageIcon, Plus, Send, Square } from 'lucide-react'
import { formatarDataPt } from '../../shared/format'
import type { Post } from '../../shared/types'
import { Botao, StatusChip } from './ui'

export function titulo(p: Post): string {
  const partes = [p.entrada.turma.trim() || 'Sem turma', p.entrada.uc.trim() || 'Sem UC']
  return partes.join(' · ')
}

export function PostList({
  posts,
  selecionado,
  ocupado,
  onSelecionar,
  onNovo,
  onPublicarProntas,
  onParar,
}: {
  posts: Post[]
  selecionado: string | null
  ocupado: boolean
  onSelecionar: (id: string) => void
  onNovo: () => void
  onPublicarProntas: () => void
  onParar: () => void
}) {
  const prontas = posts.filter((p) => p.status === 'pronta').length

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-slate-200 p-4">
        <Botao variante="primary" className="w-full" icone={<Plus className="h-4 w-4" />} onClick={onNovo} disabled={ocupado}>
          Nova postagem
        </Botao>
        {ocupado ? (
          <Botao className="w-full" icone={<Square className="h-4 w-4" />} onClick={onParar}>
            Parar depois desta
          </Botao>
        ) : (
          <Botao className="w-full" icone={<Send className="h-4 w-4" />} disabled={prontas === 0} onClick={onPublicarProntas}>
            Publicar prontas ({prontas})
          </Botao>
        )}
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {posts.length === 0 && <li className="p-4 text-sm text-slate-500">Nenhuma postagem ainda. Clique em “Nova postagem” para começar.</li>}
        {posts.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelecionar(p.id)}
              className={`w-full rounded-xl p-3 text-left transition-colors ${selecionado === p.id ? 'bg-blue-50 ring-1 ring-brand/30' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{titulo(p)}</span>
                <StatusChip status={p.status} />
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>{formatarDataPt(p.entrada.dataISO) || 'Sem data'}</span>
                {p.midias.length > 0 && (
                  <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" />{p.midias.length}</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
