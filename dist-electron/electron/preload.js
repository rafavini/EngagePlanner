"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
async function chamar(canal, ...args) {
    const r = (await electron_1.ipcRenderer.invoke(canal, ...args));
    if (!r.ok)
        throw new Error(r.erro);
    return r.data;
}
const api = {
    lerEstado: () => chamar('estado:ler'),
    salvarConfig: (p) => chamar('config:salvar', p),
    salvarChaveGemini: (c) => chamar('gemini:salvarChave', c),
    testarGemini: () => chamar('gemini:testar'),
    gerarComGemini: (id) => chamar('gemini:gerar', id),
    criarPost: () => chamar('post:criar'),
    atualizarPost: (id, patch) => chamar('post:atualizar', id, patch),
    removerPost: (id) => chamar('post:remover', id),
    duplicarPost: (id) => chamar('post:duplicar', id),
    escolherMidias: (id) => chamar('midia:escolher', id),
    adicionarMidias: (id, c) => chamar('midia:adicionar', id, c),
    removerMidia: (id, m) => chamar('midia:remover', id, m),
    caminhoDoArquivo: (file) => electron_1.webUtils.getPathForFile(file),
    entrarNoEngage: () => chamar('engage:login'),
    verificarEngage: () => chamar('engage:verificar'),
    trocarContaEngage: () => chamar('engage:trocarConta'),
    publicar: (ids) => chamar('publicar:iniciar', ids),
    cancelarFila: () => chamar('publicar:cancelar'),
    aoProgresso: (cb) => {
        const h = (_, e) => cb(e);
        electron_1.ipcRenderer.on('publicar:progresso', h);
        return () => electron_1.ipcRenderer.removeListener('publicar:progresso', h);
    },
    aoFimDaFila: (cb) => {
        const h = () => cb();
        electron_1.ipcRenderer.on('publicar:fim', h);
        return () => electron_1.ipcRenderer.removeListener('publicar:fim', h);
    },
    copiar: (t) => chamar('sistema:copiar', t),
    abrirSite: (u) => chamar('sistema:abrirSite', u),
    abrirPastaLogs: () => chamar('sistema:abrirLogs'),
};
electron_1.contextBridge.exposeInMainWorld('api', api);
