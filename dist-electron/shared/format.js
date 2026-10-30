"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLACEHOLDER = exports.ORDEM_CAMPOS = exports.ROTULOS = void 0;
exports.formatarDataPt = formatarDataPt;
exports.camposVazios = camposVazios;
exports.montarPrompt = montarPrompt;
exports.interpretarResposta = interpretarResposta;
exports.trechosDoPost = trechosDoPost;
exports.textoPlanoDoPost = textoPlanoDoPost;
exports.pendentesDoPost = pendentesDoPost;
exports.ROTULOS = {
    dataAula: 'Data da aula',
    ferramentas: 'Ferramentas utilizadas',
    turma: 'Turma',
    uc: 'UC',
    descricao: 'Descrição da situação de aprendizagem',
};
exports.ORDEM_CAMPOS = ['dataAula', 'ferramentas', 'turma', 'uc', 'descricao'];
exports.PLACEHOLDER = '[PREENCHER]';
const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
/** '2026-07-14' -> '14 de julho de 2026' */
function formatarDataPt(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m)
        return '';
    const mes = MESES[Number(m[2]) - 1];
    if (!mes)
        return '';
    return `${Number(m[3])} de ${mes} de ${m[1]}`;
}
function camposVazios() {
    return { dataAula: '', ferramentas: '', turma: '', uc: '', descricao: '' };
}
/** Monta o pedido que o professor cola na IA (ChatGPT, Claude, Copilot, Gemini...) */
function montarPrompt(entrada) {
    const data = formatarDataPt(entrada.dataISO) || exports.PLACEHOLDER;
    const turma = entrada.turma.trim() || exports.PLACEHOLDER;
    const uc = entrada.uc.trim() || exports.PLACEHOLDER;
    const relato = entrada.relato.trim() || '(o professor não escreveu nada)';
    return `Você é um assistente que ajuda professores de uma escola do SENAC a registrar aulas no Viva Engage.

Com base no relato do professor, escreva o registro da aula EXATAMENTE neste formato (5 campos, nesta ordem, um por linha, com estes rótulos):

${exports.ROTULOS.dataAula}: ...
${exports.ROTULOS.ferramentas}: ...
${exports.ROTULOS.turma}: ...
${exports.ROTULOS.uc}: ...
${exports.ROTULOS.descricao}: ...

Dados já definidos pelo professor (copie exatamente, sem alterar):
- ${exports.ROTULOS.dataAula}: ${data}
- ${exports.ROTULOS.turma}: ${turma}
- ${exports.ROTULOS.uc}: ${uc}

Regras:
- ${exports.ROTULOS.ferramentas}: liste apenas as ferramentas ou tecnologias que o relato menciona, separadas por " e " ou vírgula.
- ${exports.ROTULOS.descricao}: um ou dois parágrafos, em terceira pessoa, tom profissional e objetivo. Diga o contexto da UC, o que os alunos fizeram, quais ferramentas foram usadas e qual foi o objetivo da atividade.
- NÃO invente informações que não estejam no relato. Se faltar algum dado, escreva ${exports.PLACEHOLDER} no lugar.
- NÃO cite nomes de alunos.
- Responda somente com os 5 campos: sem título, sem introdução, sem emojis, sem hashtags, sem markdown (sem asteriscos).

Relato do professor:
"""
${relato}
"""`;
}
const FONTES_ROTULO = {
    dataAula: 'data\\s+da\\s+aula',
    ferramentas: 'ferramentas(?:\\s+utilizadas)?',
    turma: 'turma',
    uc: '(?:uc|unidade\\s+curricular)',
    descricao: 'descri[cç][aã]o(?:\\s+da\\s+situa[cç][aã]o\\s+de\\s+aprendizagem)?',
};
function regexRotulo(campo) {
    // início de linha, tolera markdown (**, #, -, •) e dois-pontos dentro ou fora do negrito
    return new RegExp(`(?:^|\\n)[ \\t>*_#\\-•]*\\*{0,2}${FONTES_ROTULO[campo]}\\*{0,2}[ \\t]*:[ \\t]*\\*{0,2}`, 'i');
}
function limpar(valor, multilinha) {
    let v = valor.replace(/\*\*/g, '').replace(/^[ \t]+|[ \t]+$/gm, '').trim();
    if (!multilinha)
        v = v.replace(/\s*\n\s*/g, ' ');
    else
        v = v.replace(/\n{3,}/g, '\n\n');
    return v;
}
/** Extrai os 5 campos de uma resposta colada da IA (tolerante a markdown e variações) */
function interpretarResposta(texto) {
    const t = texto.replace(/\r\n/g, '\n');
    const achados = [];
    for (const campo of exports.ORDEM_CAMPOS) {
        const m = regexRotulo(campo).exec(t);
        if (m)
            achados.push({ campo, ini: m.index, fim: m.index + m[0].length });
    }
    achados.sort((a, b) => a.ini - b.ini);
    const campos = camposVazios();
    achados.forEach((a, i) => {
        const prox = achados[i + 1];
        const bruto = t.slice(a.fim, prox ? prox.ini : t.length);
        campos[a.campo] = limpar(bruto, a.campo === 'descricao');
    });
    const pendentes = exports.ORDEM_CAMPOS.filter((c) => !campos[c] || campos[c].includes(exports.PLACEHOLDER));
    return { campos, pendentes };
}
/** Texto final como vai para o Engage, em trechos (rótulos em negrito) */
function trechosDoPost(campos) {
    const out = [];
    exports.ORDEM_CAMPOS.forEach((c, i) => {
        const sep = c === 'descricao' ? '\n' : ' ';
        out.push({ texto: `${exports.ROTULOS[c]}:`, negrito: true });
        out.push({ texto: `${sep}${campos[c]}${i < exports.ORDEM_CAMPOS.length - 1 ? '\n' : ''}`, negrito: false });
    });
    return out;
}
function textoPlanoDoPost(campos) {
    return trechosDoPost(campos).map((t) => t.texto).join('');
}
function pendentesDoPost(campos) {
    return exports.ORDEM_CAMPOS.filter((c) => !campos[c].trim() || campos[c].includes(exports.PLACEHOLDER));
}
