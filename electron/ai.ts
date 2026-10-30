import { lerChaveGemini } from './store'
import { log } from './log'

/** Camada de provedores: para adicionar outro serviço, implemente esta interface. */
export interface ProvedorIA {
  nome: string
  gerar(prompt: string): Promise<string>
}

export class Gemini implements ProvedorIA {
  nome = 'Google Gemini'
  constructor(private modelo: string) {}

  async gerar(prompt: string): Promise<string> {
    const chave = lerChaveGemini()
    if (!chave) throw new Error('Cadastre a chave do Gemini em Configurações.')

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 60_000)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        // chave no cabeçalho (não na URL) para não aparecer em logs
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
        signal: ctrl.signal,
      })
      if (!resp.ok) {
        const corpo = await resp.text().catch(() => '')
        log('erro', `Gemini HTTP ${resp.status}: ${corpo.slice(0, 300)}`)
        if (resp.status === 400 || resp.status === 403) throw new Error('A chave do Gemini foi recusada. Confira se ela está correta.')
        if (resp.status === 404) throw new Error(`O modelo "${this.modelo}" não existe. Troque o nome do modelo em Configurações.`)
        if (resp.status === 429) throw new Error('Limite gratuito do Gemini atingido. Espere um pouco ou use o modo "Copiar e colar".')
        throw new Error(`O Gemini respondeu com erro ${resp.status}.`)
      }
      const json = (await resp.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!texto.trim()) throw new Error('O Gemini não devolveu texto. Tente de novo.')
      return texto
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('O Gemini demorou demais para responder.')
      throw e
    } finally {
      clearTimeout(timer)
    }
  }
}
