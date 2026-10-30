import type { Post, PostFields } from './types'

export const ROTULOS: Record<keyof PostFields, string> = {
  dataAula: 'Data da aula',
  ferramentas: 'Ferramentas utilizadas',
  turma: 'Turma',
  uc: 'UC',
  descricao: 'Descrição da situação de aprendizagem',
}

export const ORDEM_CAMPOS: (keyof PostFields)[] = ['dataAula', 'ferramentas', 'turma', 'uc', 'descricao']

export const PLACEHOLDER = '[PREENCHER]'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** '2026-07-14' -> '14 de julho de 2026' */
export function formatarDataPt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return ''
  const mes = MESES[Number(m[2]) - 1]
  if (!mes) return ''
  return `${Number(m[3])} de ${mes} de ${m[1]}`
}

export function camposVazios(): PostFields {
  return { dataAula: '', ferramentas: '', turma: '', uc: '', descricao: '' }
}

/** Monta o pedido que o professor cola na IA (ChatGPT, Claude, Copilot, Gemini...) */
export function montarPrompt(entrada: Post['entrada']): string {
  const data = formatarDataPt(entrada.dataISO) || PLACEHOLDER
  const turma = entrada.turma.trim() || PLACEHOLDER
  const uc = entrada.uc.trim() || PLACEHOLDER
  const relato = entrada.relato.trim() || '(o professor não escreveu nada)'

  return `Você é um assistente que ajuda professores de uma escola do SENAC a registrar aulas no Viva Engage.

Com base no relato do professor, escreva o registro da aula EXATAMENTE neste formato (5 campos, nesta ordem, um por linha, com estes rótulos):

${ROTULOS.dataAula}: ...
${ROTULOS.ferramentas}: ...
${ROTULOS.turma}: ...
${ROTULOS.uc}: ...
${ROTULOS.descricao}: ...

Dados já definidos pelo professor (copie exatamente, sem alterar):
- ${ROTULOS.dataAula}: ${data}
- ${ROTULOS.turma}: ${turma}
- ${ROTULOS.uc}: ${uc}

Regras:
- ${ROTULOS.ferramentas}: liste apenas as ferramentas ou tecnologias que o relato menciona, separadas por " e " ou vírgula.
- ${ROTULOS.descricao}: um ou dois parágrafos, em terceira pessoa, tom profissional e objetivo. Diga o contexto da UC, o que os alunos fizeram, quais ferramentas foram usadas e qual foi o objetivo da atividade.
- NÃO invente informações que não estejam no relato. Se faltar algum dado, escreva ${PLACEHOLDER} no lugar.
- NÃO cite nomes de alunos.
- Responda somente com os 5 campos: sem título, sem introdução, sem emojis, sem hashtags, sem markdown (sem asteriscos).

Relato do professor:
"""
${relato}
"""`
}

const FONTES_ROTULO: Record<keyof PostFields, string> = {
  dataAula: 'data\\s+da\\s+aula',
  ferramentas: 'ferramentas(?:\\s+utilizadas)?',
  turma: 'turma',
  uc: '(?:uc|unidade\\s+curricular)',
  descricao: 'descri[cç][aã]o(?:\\s+da\\s+situa[cç][aã]o\\s+de\\s+aprendizagem)?',
}

function regexRotulo(campo: keyof PostFields): RegExp {
  // início de linha, tolera markdown (**, #, -, •) e dois-pontos dentro ou fora do negrito
  return new RegExp(
    `(?:^|\\n)[ \\t>*_#\\-•]*\\*{0,2}${FONTES_ROTULO[campo]}\\*{0,2}[ \\t]*:[ \\t]*\\*{0,2}`,
    'i',
  )
}

function limpar(valor: string, multilinha: boolean): string {
  let v = valor.replace(/\*\*/g, '').replace(/^[ \t]+|[ \t]+$/gm, '').trim()
  if (!multilinha) v = v.replace(/\s*\n\s*/g, ' ')
  else v = v.replace(/\n{3,}/g, '\n\n')
  return v
}

export interface ResultadoParse {
  campos: PostFields
  /** campos que não vieram, vieram vazios ou com [PREENCHER] */
  pendentes: (keyof PostFields)[]
}

/** Extrai os 5 campos de uma resposta colada da IA (tolerante a markdown e variações) */
export function interpretarResposta(texto: string): ResultadoParse {
  const t = texto.replace(/\r\n/g, '\n')
  const achados: { campo: keyof PostFields; ini: number; fim: number }[] = []

  for (const campo of ORDEM_CAMPOS) {
    const m = regexRotulo(campo).exec(t)
    if (m) achados.push({ campo, ini: m.index, fim: m.index + m[0].length })
  }
  achados.sort((a, b) => a.ini - b.ini)

  const campos = camposVazios()
  achados.forEach((a, i) => {
    const prox = achados[i + 1]
    const bruto = t.slice(a.fim, prox ? prox.ini : t.length)
    campos[a.campo] = limpar(bruto, a.campo === 'descricao')
  })

  const pendentes = ORDEM_CAMPOS.filter((c) => !campos[c] || campos[c].includes(PLACEHOLDER))
  return { campos, pendentes }
}

export interface Trecho {
  texto: string
  negrito: boolean
}

/** Texto final como vai para o Engage, em trechos (rótulos em negrito) */
export function trechosDoPost(campos: PostFields): Trecho[] {
  const out: Trecho[] = []
  ORDEM_CAMPOS.forEach((c, i) => {
    const sep = c === 'descricao' ? '\n' : ' '
    out.push({ texto: `${ROTULOS[c]}:`, negrito: true })
    out.push({ texto: `${sep}${campos[c]}${i < ORDEM_CAMPOS.length - 1 ? '\n' : ''}`, negrito: false })
  })
  return out
}

export function textoPlanoDoPost(campos: PostFields): string {
  return trechosDoPost(campos).map((t) => t.texto).join('')
}

export function pendentesDoPost(campos: PostFields): (keyof PostFields)[] {
  return ORDEM_CAMPOS.filter((c) => !campos[c].trim() || campos[c].includes(PLACEHOLDER))
}
