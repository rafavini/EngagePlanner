import { describe, expect, it } from 'vitest'
import {
  formatarDataPt, interpretarResposta, montarPrompt, pendentesDoPost, textoPlanoDoPost, trechosDoPost,
} from './format'

const entrada = { dataISO: '2026-07-14', turma: '2026.1.4', uc: 'Unidade de Extensão I', relato: 'Alunos apresentaram artigos no Teams com PowerPoint.' }

describe('formatarDataPt', () => {
  it('formata por extenso', () => {
    expect(formatarDataPt('2026-07-14')).toBe('14 de julho de 2026')
    expect(formatarDataPt('2026-03-01')).toBe('1 de março de 2026')
  })
  it('retorna vazio para data inválida', () => {
    expect(formatarDataPt('')).toBe('')
    expect(formatarDataPt('2026-13-01')).toBe('')
  })
})

describe('montarPrompt', () => {
  it('inclui dados, relato e regras', () => {
    const p = montarPrompt(entrada)
    expect(p).toContain('Data da aula: 14 de julho de 2026')
    expect(p).toContain('Turma: 2026.1.4')
    expect(p).toContain('Unidade de Extensão I')
    expect(p).toContain('Alunos apresentaram artigos')
    expect(p).toContain('NÃO cite nomes de alunos')
  })
  it('usa [PREENCHER] quando falta dado', () => {
    const p = montarPrompt({ ...entrada, turma: '', dataISO: '' })
    expect(p).toContain('Turma: [PREENCHER]')
    expect(p).toContain('Data da aula: [PREENCHER]')
  })
})

describe('interpretarResposta', () => {
  it('lê resposta com negrito em markdown', () => {
    const r = interpretarResposta(`**Data da aula:** 14 de julho de 2026
**Ferramentas utilizadas:** Microsoft PowerPoint e Microsoft Teams
**Turma:** 2026.1.4
**UC:** Unidade de Extensão I
**Descrição da situação de aprendizagem:**
No contexto da Unidade de Extensão I, foi realizada a apresentação.

A atividade teve como objetivo X.`)
    expect(r.campos.dataAula).toBe('14 de julho de 2026')
    expect(r.campos.ferramentas).toBe('Microsoft PowerPoint e Microsoft Teams')
    expect(r.campos.turma).toBe('2026.1.4')
    expect(r.campos.uc).toBe('Unidade de Extensão I')
    expect(r.campos.descricao).toContain('No contexto da Unidade')
    expect(r.campos.descricao).toContain('\n\nA atividade teve')
    expect(r.pendentes).toEqual([])
  })

  it('lê texto puro, com intro e sem acentos', () => {
    const r = interpretarResposta(`Claro! Aqui está:

Data da aula: 1 de março de 2026
Ferramentas: Excel
Turma: 3A
Unidade curricular: Planilhas
Descricao da situacao de aprendizagem: Os alunos usaram o Excel.`)
    expect(r.campos.ferramentas).toBe('Excel')
    expect(r.campos.uc).toBe('Planilhas')
    expect(r.campos.descricao).toBe('Os alunos usaram o Excel.')
    expect(r.pendentes).toEqual([])
  })

  it('marca pendentes: ausentes e [PREENCHER]', () => {
    const r = interpretarResposta(`Data da aula: [PREENCHER]
Ferramentas utilizadas: Teams
Turma: 2026.1.4
Descrição da situação de aprendizagem: Texto.`)
    expect(r.pendentes).toEqual(['dataAula', 'uc'])
  })

  it('aceita campos fora de ordem', () => {
    const r = interpretarResposta(`Turma: A1
UC: Redes
Data da aula: 2 de abril de 2026
Ferramentas utilizadas: Packet Tracer
Descrição da situação de aprendizagem: Texto.`)
    expect(r.campos.turma).toBe('A1')
    expect(r.campos.dataAula).toBe('2 de abril de 2026')
    expect(r.campos.uc).toBe('Redes')
  })

  it('resposta sem nada reconhecível vira tudo pendente', () => {
    const r = interpretarResposta('não sei')
    expect(r.pendentes).toHaveLength(5)
  })
})

describe('texto final', () => {
  const campos = { dataAula: '14 de julho de 2026', ferramentas: 'Teams', turma: 'A', uc: 'B', descricao: 'Texto.' }
  it('gera texto plano no padrão da escola', () => {
    expect(textoPlanoDoPost(campos)).toBe(
      'Data da aula: 14 de julho de 2026\nFerramentas utilizadas: Teams\nTurma: A\nUC: B\nDescrição da situação de aprendizagem:\nTexto.',
    )
  })
  it('rótulos são negrito', () => {
    const t = trechosDoPost(campos)
    expect(t[0]).toEqual({ texto: 'Data da aula:', negrito: true })
    expect(t[1].negrito).toBe(false)
  })
  it('detecta pendentes', () => {
    expect(pendentesDoPost({ ...campos, uc: '' })).toEqual(['uc'])
  })
})
