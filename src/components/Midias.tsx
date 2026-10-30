import { ImagePlus, Film, X } from 'lucide-react'
import { useState } from 'react'
import type { Post } from '../../shared/types'
import { Botao } from './ui'

const fmt = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function Midias({
  post,
  desabilitado,
  onPost,
  avisar,
}: {
  post: Post
  desabilitado: boolean
  onPost: (p: Post) => void
  avisar: (msg: string, tipo?: 'ok' | 'erro') => void
}) {
  const [arrastando, setArrastando] = useState(false)

  function resultado(r: { post: Post; avisos: string[] }) {
    onPost(r.post)
    r.avisos.forEach((a) => avisar(a, 'erro'))
  }

  async function soltar(files: FileList) {
    const caminhos = Array.from(files).map((f) => window.api.caminhoDoArquivo(f)).filter(Boolean)
    if (caminhos.length === 0) return
    try {
      resultado(await window.api.adicionarMidias(post.id, caminhos))
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!desabilitado) setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          if (!desabilitado) void soltar(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          arrastando ? 'border-brand bg-blue-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <ImagePlus className="h-7 w-7 text-slate-400" />
        <p className="text-sm text-slate-600">Arraste as fotos e vídeos para cá</p>
        <Botao
          disabled={desabilitado}
          onClick={async () => {
            try {
              resultado(await window.api.escolherMidias(post.id))
            } catch (e) {
              avisar((e as Error).message, 'erro')
            }
          }}
        >
          Escolher no computador
        </Botao>
        <p className="text-xs text-slate-400">JPG, PNG, WEBP, MP4, MOV ou WEBM</p>
      </div>

      {post.midias.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {post.midias.map((m) => (
            <li key={m.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              {m.tipo === 'imagem' ? (
                <img src={`app-media://m/${encodeURI(m.rel)}`} alt={m.nome} className="h-28 w-full object-cover" />
              ) : (
                <div className="relative">
                  <video src={`app-media://m/${encodeURI(m.rel)}#t=0.5`} preload="metadata" muted className="h-28 w-full object-cover" />
                  <Film className="absolute left-2 top-2 h-4 w-4 text-white drop-shadow" />
                </div>
              )}
              <div className="px-2 py-1">
                <p className="truncate text-xs text-slate-700" title={m.nome}>{m.nome}</p>
                <p className="text-xs text-slate-400">{fmt(m.tamanho)}</p>
              </div>
              {!desabilitado && (
                <button
                  title="Remover"
                  onClick={async () => {
                    try {
                      onPost(await window.api.removerMidia(post.id, m.id))
                    } catch (e) {
                      avisar((e as Error).message, 'erro')
                    }
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
