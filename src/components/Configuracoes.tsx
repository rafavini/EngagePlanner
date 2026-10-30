import { ExternalLink, FolderOpen, LogIn, PlugZap, Save } from 'lucide-react'
import { useState } from 'react'
import type { AppState, NavegadorPreferido, Settings } from '../../shared/types'
import { Botao, Campo, classeEntrada, Interruptor } from './ui'

function Bloco({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      {dica && <p className="mb-4 mt-0.5 text-sm text-slate-500">{dica}</p>}
      {!dica && <div className="h-3" />}
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function Configuracoes({
  estado,
  onEstado,
  avisar,
}: {
  estado: AppState
  onEstado: (e: AppState) => void
  avisar: (msg: string, tipo?: 'ok' | 'erro') => void
}) {
  const [url, setUrl] = useState(estado.settings.comunidadeUrl)
  const [modelo, setModelo] = useState(estado.settings.geminiModelo)
  const [chave, setChave] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [resultadoEngage, setResultadoEngage] = useState<{ logado: boolean; mensagem: string } | null>(null)

  async function salvar(parcial: Partial<Settings>) {
    try {
      const settings = await window.api.salvarConfig(parcial)
      onEstado({ ...estado, settings })
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  async function executar(nome: string, fn: () => Promise<void>) {
    setOcupado(nome)
    try {
      await fn()
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setOcupado(null)
    }
  }

  const urlValida = /^https:\/\/\S+$/i.test(url.trim())

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-16">
      <h1 className="text-xl font-semibold text-slate-900">Configurações</h1>

      <Bloco titulo="1. Comunidade do Engage" dica="Abra a comunidade no Viva Engage e copie o endereço que aparece na barra do navegador.">
        <Campo rotulo="Link da comunidade">
          <input className={classeEntrada} placeholder="https://engage.cloud.microsoft/main/groups/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Campo>
        {url && !urlValida && <p className="text-sm text-amber-700">O link precisa começar com https://</p>}
        <Botao icone={<Save className="h-4 w-4" />} disabled={!urlValida || url.trim() === estado.settings.comunidadeUrl} onClick={() => salvar({ comunidadeUrl: url.trim() })}>
          Salvar link
        </Botao>
      </Bloco>

      <Bloco titulo="2. Entrar no Engage" dica="O app abre uma janela do navegador só dele. Entre com a conta da escola uma vez; o login fica guardado para as próximas vezes. Sua senha nunca é salva pelo app.">
        <Campo rotulo="Navegador">
          <select className={classeEntrada} value={estado.settings.navegador} onChange={(e) => salvar({ navegador: e.target.value as NavegadorPreferido })}>
            <option value="auto">Automático (Edge ou Chrome)</option>
            <option value="msedge">Microsoft Edge</option>
            <option value="chrome">Google Chrome</option>
          </select>
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Botao variante="primary" icone={<LogIn className="h-4 w-4" />} disabled={!estado.settings.comunidadeUrl} carregando={ocupado === 'login'} onClick={() => executar('login', () => window.api.entrarNoEngage())}>
            Entrar no Engage
          </Botao>
          <Botao icone={<PlugZap className="h-4 w-4" />} disabled={!estado.settings.comunidadeUrl} carregando={ocupado === 'verificar'} onClick={() => executar('verificar', async () => setResultadoEngage(await window.api.verificarEngage()))}>
            Testar conexão
          </Botao>
          <Botao
            variante="danger"
            carregando={ocupado === 'trocar'}
            onClick={() =>
              confirm('Isso fecha a janela do Engage do app e apaga o login guardado nela. Depois você entra de novo com a conta certa. Continuar?') &&
              executar('trocar', async () => {
                await window.api.trocarContaEngage()
                setResultadoEngage(null)
                avisar('Login apagado. Clique em “Entrar no Engage” e escolha a conta da escola.')
              })
            }
          >
            Trocar de conta
          </Botao>
        </div>
        {resultadoEngage && (
          <p className={`rounded-lg p-3 text-sm ${resultadoEngage.logado ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{resultadoEngage.mensagem}</p>
        )}
      </Bloco>

      <Bloco titulo="3. Como publicar">
        <Interruptor
          ligado={estado.settings.pararAntesDePublicar}
          onChange={(v) => salvar({ pararAntesDePublicar: v })}
          titulo="Eu mesmo clico em “Publicar” no Engage (recomendado)"
          descricao="O app preenche tudo e espera você conferir e publicar. Desligue só depois de testar bastante."
        />
        <Interruptor
          ligado={estado.settings.rotulosEmNegrito}
          onChange={(v) => salvar({ rotulosEmNegrito: v })}
          titulo="Deixar os títulos em negrito"
          descricao="“Data da aula:”, “Turma:” etc. Se o negrito falhar no seu Engage, desligue."
        />
        <Campo rotulo="Pausa entre uma postagem e outra (segundos)">
          <input type="number" min={3} max={120} className={`${classeEntrada} !w-28`} value={estado.settings.pausaEntrePostagens} onChange={(e) => salvar({ pausaEntrePostagens: Math.max(3, Number(e.target.value) || 8) })} />
        </Campo>
      </Bloco>

      <Bloco titulo="4. Inteligência artificial" dica="Por padrão você copia o pedido, cola na IA que já usa (ChatGPT, Claude, Copilot…) e traz a resposta de volta. Se quiser, o app pode gerar sozinho com uma chave gratuita do Google Gemini.">
        <Interruptor
          ligado={estado.settings.modoIA === 'gemini'}
          onChange={(v) => salvar({ modoIA: v ? 'gemini' : 'copiar' })}
          titulo="Gerar automaticamente com o Gemini"
          descricao={estado.temChaveGemini ? 'Chave cadastrada.' : 'Precisa cadastrar uma chave abaixo.'}
        />
        <Campo rotulo="Chave do Gemini">
          <input type="password" className={classeEntrada} placeholder={estado.temChaveGemini ? '•••••••• (já cadastrada)' : 'Cole a chave aqui'} value={chave} onChange={(e) => setChave(e.target.value)} />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Botao
            icone={<Save className="h-4 w-4" />}
            disabled={!chave.trim()}
            onClick={() =>
              executar('chave', async () => {
                const tem = await window.api.salvarChaveGemini(chave)
                setChave('')
                onEstado({ ...estado, temChaveGemini: tem })
                avisar('Chave guardada com segurança neste computador.')
              })
            }
          >
            Salvar chave
          </Botao>
          <Botao carregando={ocupado === 'testar'} disabled={!estado.temChaveGemini} onClick={() => executar('testar', async () => avisar(await window.api.testarGemini()))}>
            Testar
          </Botao>
          {estado.temChaveGemini && (
            <Botao variante="danger" onClick={() => executar('apagar', async () => {
              await window.api.salvarChaveGemini('')
              await window.api.salvarConfig({ modoIA: 'copiar' })
              onEstado(await window.api.lerEstado())
            })}>
              Apagar chave
            </Botao>
          )}
          <Botao variante="ghost" icone={<ExternalLink className="h-4 w-4" />} onClick={() => window.api.abrirSite('https://aistudio.google.com/apikey').catch((e) => avisar(e.message, 'erro'))}>
            Como conseguir uma chave grátis
          </Botao>
        </div>
        <Campo rotulo="Modelo do Gemini">
          <div className="flex gap-2">
            <input className={classeEntrada} value={modelo} onChange={(e) => setModelo(e.target.value)} />
            <Botao disabled={!modelo.trim() || modelo.trim() === estado.settings.geminiModelo} onClick={() => salvar({ geminiModelo: modelo.trim() })}>Salvar</Botao>
          </div>
        </Campo>
        <p className="text-xs text-slate-500">No plano gratuito, o Google pode usar o conteúdo enviado para melhorar os serviços dele. Por isso o app envia só o seu relato, nunca fotos, vídeos ou nomes de alunos.</p>
      </Bloco>

      <Bloco titulo="Ajuda">
        <Botao icone={<FolderOpen className="h-4 w-4" />} onClick={() => window.api.abrirPastaLogs().catch((e) => avisar(e.message, 'erro'))}>
          Abrir pasta de registros e capturas de tela
        </Botao>
        <p className="text-xs text-slate-500">Se alguma publicação falhar, o app salva uma foto da tela do Engage e o registro do erro nessa pasta.</p>
      </Bloco>
    </div>
  )
}
