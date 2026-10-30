import { AlertTriangle, CheckCircle2, ClipboardCopy, Copy, Send, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  interpretarResposta, montarPrompt, ORDEM_CAMPOS, pendentesDoPost, PLACEHOLDER, ROTULOS, textoPlanoDoPost,
} from '../../shared/format'
import type { AppState, Post, PostFields } from '../../shared/types'
import { Midias } from './Midias'
import { Botao, Campo, classeEntrada, Passo, StatusChip } from './ui'

const SITES_IA = [
  { id: 'chatgpt', nome: 'ChatGPT', url: 'https://chatgpt.com' },
  { id: 'claude', nome: 'Claude', url: 'https://claude.ai' },
  { id: 'copilot', nome: 'Copilot', url: 'https://copilot.microsoft.com' },
  { id: 'gemini', nome: 'Gemini', url: 'https://gemini.google.com' },
]

function useSalvarDepois<T>(valor: T, salvar: (v: T) => void, ativo: boolean, ms = 600) {
  const primeira = useRef(true)
  const pendente = useRef<{ v: T } | null>(null)
  const salvarRef = useRef(salvar)
  salvarRef.current = salvar

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    if (!ativo) return
    pendente.current = { v: valor }
    const t = setTimeout(() => {
      pendente.current = null
      salvarRef.current(valor)
    }, ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  // ao sair da postagem (ou fechar a tela), grava o que ainda estava esperando
  useEffect(
    () => () => {
      if (pendente.current) {
        salvarRef.current(pendente.current.v)
        pendente.current = null
      }
    },
    [],
  )
}

export function PostEditor({
  post,
  estado,
  ocupado,
  onPost,
  onRemover,
  onDuplicar,
  onPublicar,
  avisar,
}: {
  post: Post
  estado: AppState
  ocupado: boolean
  onPost: (p: Post) => void
  onRemover: () => void
  onDuplicar: () => void
  onPublicar: () => void
  avisar: (msg: string, tipo?: 'ok' | 'erro') => void
}) {
  const [entrada, setEntrada] = useState(post.entrada)
  const [campos, setCampos] = useState<PostFields>(post.campos)
  const [resposta, setResposta] = useState('')
  const [site, setSite] = useState(() => {
    try {
      return localStorage.getItem('siteIA') ?? 'copilot'
    } catch {
      return 'copilot'
    }
  })
  const [gerando, setGerando] = useState(false)
  const travado = post.status === 'publicando' || post.status === 'publicada' || ocupado

  // trocou de postagem: recarrega os campos locais
  useEffect(() => {
    setEntrada(post.entrada)
    setCampos(post.campos)
    setResposta('')
  }, [post.id])

  const salvarEntrada = (v: Post['entrada']) => window.api.atualizarPost(post.id, { entrada: v }).then(onPost).catch((e) => avisar(e.message, 'erro'))
  const salvarCampos = (v: PostFields) => window.api.atualizarPost(post.id, { campos: v }).then(onPost).catch((e) => avisar(e.message, 'erro'))
  useSalvarDepois(entrada, salvarEntrada, !travado)
  useSalvarDepois(campos, salvarCampos, !travado)

  const pendentes = useMemo(() => pendentesDoPost(campos), [campos])
  const prompt = useMemo(() => montarPrompt(entrada), [entrada])
  const textoFinal = useMemo(() => textoPlanoDoPost(campos), [campos])
  const temTexto = ORDEM_CAMPOS.some((c) => campos[c].trim())

  function aplicarResposta(texto: string) {
    const r = interpretarResposta(texto)
    const algum = ORDEM_CAMPOS.some((c) => r.campos[c])
    if (!algum) {
      avisar('Não consegui reconhecer os campos nessa resposta. Confira se a IA seguiu o formato.', 'erro')
      return
    }
    setCampos(r.campos)
    if (r.pendentes.length > 0) avisar(`Revise: ${r.pendentes.map((c) => ROTULOS[c]).join(', ')}.`, 'erro')
    else avisar('Texto aplicado. Revise abaixo e marque como pronta.')
  }

  async function copiarEAbrir() {
    if (!entrada.relato.trim()) return avisar('Escreva primeiro o que aconteceu na aula.', 'erro')
    const s = SITES_IA.find((x) => x.id === site)!
    try {
      localStorage.setItem('siteIA', site)
    } catch {
      /* sem armazenamento: tudo bem */
    }
    try {
      await window.api.copiar(prompt)
      await window.api.abrirSite(s.url)
      avisar(`Pedido copiado! Cole no ${s.nome} (Ctrl+V), depois copie a resposta e traga aqui.`)
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  async function gerarAuto() {
    setGerando(true)
    try {
      aplicarResposta(await window.api.gerarComGemini(post.id))
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setGerando(false)
    }
  }

  async function alternarPronta() {
    try {
      // garante que o que está na tela foi salvo antes de mudar o status
      await window.api.atualizarPost(post.id, { entrada, campos })
      onPost(await window.api.atualizarPost(post.id, { status: post.status === 'pronta' ? 'rascunho' : 'pronta', erro: undefined }))
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  const set = <K extends keyof Post['entrada']>(k: K, v: Post['entrada'][K]) => setEntrada((o) => ({ ...o, [k]: v }))
  const setC = (k: keyof PostFields, v: string) => setCampos((o) => ({ ...o, [k]: v }))

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Postagem</h1>
          <StatusChip status={post.status} />
        </div>
        <div className="flex gap-1">
          <Botao variante="ghost" icone={<Copy className="h-4 w-4" />} onClick={onDuplicar} disabled={ocupado}>Duplicar</Botao>
          <Botao variante="danger" icone={<Trash2 className="h-4 w-4" />} onClick={onRemover} disabled={travado && post.status !== 'publicada'}>Excluir</Botao>
        </div>
      </div>

      {post.erro && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{post.erro}</p>
        </div>
      )}

      <Passo n={1} titulo="Conte o que aconteceu" dica="Escreva do seu jeito, como se estivesse contando para um colega.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo rotulo="Data da aula">
            <input type="date" className={classeEntrada} value={entrada.dataISO} disabled={travado} onChange={(e) => set('dataISO', e.target.value)} />
          </Campo>
          <Campo rotulo="Turma">
            <input className={classeEntrada} placeholder="Ex.: 2026.1.4" value={entrada.turma} disabled={travado} onChange={(e) => set('turma', e.target.value)} />
          </Campo>
          <Campo rotulo="UC">
            <input className={classeEntrada} placeholder="Ex.: Unidade de Extensão I" value={entrada.uc} disabled={travado} onChange={(e) => set('uc', e.target.value)} />
          </Campo>
        </div>
        <div className="mt-3">
          <Campo rotulo="O que aconteceu na aula?">
            <textarea
              rows={5}
              className={classeEntrada}
              disabled={travado}
              placeholder="Ex.: Os alunos apresentaram os artigos científicos que desenvolveram, usando PowerPoint e o Teams. O objetivo era treinar a comunicação dos resultados…"
              value={entrada.relato}
              onChange={(e) => set('relato', e.target.value)}
            />
          </Campo>
          <p className="mt-1 text-xs text-slate-500">Não escreva nomes de alunos. Só este texto vai para a IA; suas fotos e vídeos ficam no seu computador.</p>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-slate-700">Fotos e vídeos</p>
          <Midias post={post} desabilitado={travado} onPost={onPost} avisar={avisar} />
        </div>
      </Passo>

      <Passo n={2} titulo="Gere o texto com a IA" dica="Use a IA que você já tem. Ela escreve a partir do que você contou acima.">
        {estado.settings.modoIA === 'gemini' && estado.temChaveGemini ? (
          <div className="space-y-2">
            <Botao variante="primary" icone={<Sparkles className="h-4 w-4" />} carregando={gerando} disabled={travado} onClick={gerarAuto}>
              Gerar texto automaticamente
            </Botao>
            <p className="text-xs text-slate-500">Usa o Google Gemini com a chave que você cadastrou em Configurações.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${classeEntrada} !w-auto`} value={site} onChange={(e) => setSite(e.target.value)}>
                {SITES_IA.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <Botao variante="primary" icone={<ClipboardCopy className="h-4 w-4" />} onClick={copiarEAbrir} disabled={travado}>
                Copiar pedido e abrir a IA
              </Botao>
            </div>
            <Campo rotulo="Depois, cole aqui a resposta da IA">
              <textarea rows={5} className={classeEntrada} disabled={travado} placeholder="Cole a resposta aqui…" value={resposta} onChange={(e) => setResposta(e.target.value)} />
            </Campo>
            <Botao disabled={travado || !resposta.trim()} onClick={() => aplicarResposta(resposta)}>Usar esta resposta</Botao>
          </div>
        )}
        <details className="mt-4 text-sm text-slate-500">
          <summary className="cursor-pointer select-none">Ver o pedido que será enviado à IA</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{prompt}</pre>
        </details>
      </Passo>

      <Passo n={3} titulo="Revise e corrija" dica="Você pode editar qualquer campo. Campos em destaque precisam da sua atenção.">
        {pendentes.length > 0 && temTexto && (
          <p className="mb-3 flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Falta preencher: {pendentes.map((c) => ROTULOS[c]).join(', ')}. (Troque o {PLACEHOLDER} pelo dado certo.)
          </p>
        )}
        <div className="space-y-3">
          {ORDEM_CAMPOS.map((c) => {
            const alerta = pendentes.includes(c)
            return (
              <Campo key={c} rotulo={ROTULOS[c]} alerta={alerta && temTexto}>
                {c === 'descricao' ? (
                  <textarea rows={7} className={`${classeEntrada} ${alerta && temTexto ? '!border-amber-400 !bg-amber-50' : ''}`} disabled={travado} value={campos[c]} onChange={(e) => setC(c, e.target.value)} />
                ) : (
                  <input className={`${classeEntrada} ${alerta && temTexto ? '!border-amber-400 !bg-amber-50' : ''}`} disabled={travado} value={campos[c]} onChange={(e) => setC(c, e.target.value)} />
                )}
              </Campo>
            )
          })}
        </div>
        {temTexto && (
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-slate-700">Como vai aparecer no Engage</p>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{textoFinal}</pre>
          </div>
        )}
      </Passo>

      <div className="fixed bottom-0 left-72 right-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        {post.status === 'publicada' ? (
          <span className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Já publicada{post.publicadoEm ? ` em ${new Date(post.publicadoEm).toLocaleString('pt-BR')}` : ''}</span>
        ) : (
          <>
            <Botao disabled={travado || (post.status !== 'pronta' && pendentes.length > 0)} onClick={alternarPronta} icone={<CheckCircle2 className="h-4 w-4" />}>
              {post.status === 'pronta' ? 'Voltar para rascunho' : 'Marcar como pronta'}
            </Botao>
            <Botao variante="primary" icone={<Send className="h-4 w-4" />} disabled={travado || pendentes.length > 0} onClick={onPublicar}>
              Publicar só esta
            </Botao>
          </>
        )}
      </div>
    </div>
  )
}
