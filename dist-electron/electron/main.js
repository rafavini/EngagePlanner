"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const format_1 = require("../shared/format");
const ai_1 = require("./ai");
const adapter_1 = require("./engage/adapter");
const browser_1 = require("./engage/browser");
const log_1 = require("./log");
const store = __importStar(require("./store"));
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'app-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
const SITES_PERMITIDOS = [
    'https://chatgpt.com',
    'https://claude.ai',
    'https://copilot.microsoft.com',
    'https://m365.cloud.microsoft',
    'https://gemini.google.com',
    'https://aistudio.google.com',
];
let janela = null;
let rodando = false;
const engage = new adapter_1.VivaEngageAdapter();
/** Aviso do sistema (canto da tela): aparece mesmo com a janela do Engage na frente. */
function notificar(titulo, corpo) {
    try {
        if (!electron_1.Notification.isSupported())
            return;
        const n = new electron_1.Notification({ title: titulo, body: corpo.slice(0, 240) });
        n.on('click', () => {
            if (janela) {
                if (janela.isMinimized())
                    janela.restore();
                janela.show();
                janela.focus();
            }
        });
        n.show();
    }
    catch (e) {
        (0, log_1.log)('erro', `notificação: ${e.message}`);
    }
}
function criarJanela() {
    janela = new electron_1.BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 980,
        minHeight: 640,
        title: 'Postagens Engage',
        autoHideMenuBar: true,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    // O app só carrega o próprio conteúdo; links externos são bloqueados.
    janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    janela.webContents.on('will-navigate', (e, url) => {
        if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://'))
            e.preventDefault();
    });
    if (process.env.ELECTRON_DEV) {
        void janela.loadURL('http://localhost:5173');
    }
    else {
        void janela.loadFile(node_path_1.default.join(__dirname, '../../dist/index.html'));
    }
    janela.on('closed', () => {
        janela = null;
    });
}
function h(canal, fn) {
    electron_1.ipcMain.handle(canal, async (_e, ...args) => {
        try {
            return { ok: true, data: await fn(...args) };
        }
        catch (e) {
            const msg = e.message || 'Algo deu errado.';
            (0, log_1.log)('erro', `${canal}: ${msg}`);
            return { ok: false, erro: msg };
        }
    });
}
function emitir(e) {
    janela?.webContents.send('publicar:progresso', e);
}
h('estado:ler', () => ({
    settings: store.getSettings(),
    posts: store.getPosts(),
    temChaveGemini: store.temChaveGemini(),
}));
h('config:salvar', (parcial) => store.salvarSettings(parcial));
h('gemini:salvarChave', (chave) => {
    store.salvarChaveGemini(chave);
    return store.temChaveGemini();
});
h('gemini:testar', async () => {
    const ia = new ai_1.Gemini(store.getSettings().geminiModelo);
    await ia.gerar('Responda apenas com a palavra: ok');
    return 'Conexão funcionando.';
});
h('gemini:gerar', async (postId) => {
    const post = store.getPost(postId);
    if (!post)
        throw new Error('Postagem não encontrada.');
    if (!post.entrada.relato.trim())
        throw new Error('Escreva o que aconteceu na aula antes de gerar o texto.');
    const ia = new ai_1.Gemini(store.getSettings().geminiModelo);
    // Só o relato em texto vai para a IA: fotos e vídeos nunca saem do computador.
    return ia.gerar((0, format_1.montarPrompt)(post.entrada));
});
h('post:criar', () => store.criarPost());
h('post:atualizar', (id, patch) => store.atualizarPost(id, patch));
h('post:remover', (id) => store.removerPost(id));
h('post:duplicar', (id) => store.duplicarPost(id));
h('midia:escolher', async (postId) => {
    const r = await electron_1.dialog.showOpenDialog(janela, {
        title: 'Escolha as fotos e vídeos',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Fotos e vídeos', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'] }],
    });
    if (r.canceled)
        return { post: store.getPost(postId), avisos: [] };
    return store.adicionarMidias(postId, r.filePaths);
});
h('midia:adicionar', (postId, caminhos) => store.adicionarMidias(postId, caminhos));
h('midia:remover', (postId, midiaId) => store.removerMidia(postId, midiaId));
h('engage:login', async () => {
    await engage.abrirParaLogin(store.getSettings());
});
h('engage:trocarConta', async () => {
    if (rodando)
        throw new Error('Espere a publicação terminar antes de trocar de conta.');
    await (0, browser_1.apagarPerfil)();
});
h('engage:verificar', () => engage.verificarSessao(store.getSettings()));
// ---------- fila de publicação ----------
let cancelar = false;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function confirmarManual(post) {
    notificar('Postagem pronta para conferir', 'Confira na janela do Engage e clique em Publicar. Depois volte ao app e confirme.');
    const r = await electron_1.dialog.showMessageBox({
        type: 'question',
        title: 'Confira no Engage',
        message: 'A postagem está pronta na janela do Engage.',
        detail: `Confira o texto e as mídias (${post.campos.turma || 'sem turma'}). ` +
            'Se estiver tudo certo, clique em "Publicar" na janela do Engage e só depois volte aqui e escolha "Já publiquei".',
        buttons: ['Já publiquei', 'Não publiquei'],
        defaultId: 0,
        cancelId: 1,
    });
    return r.response === 0 ? 'publicada' : 'nao-publicada';
}
async function rodarFila(ids) {
    if (rodando)
        throw new Error('Já existe uma publicação em andamento.');
    rodando = true;
    cancelar = false;
    let feitas = 0;
    let falhas = 0;
    try {
        const fila = ids.map((id) => store.getPost(id)).filter((p) => !!p && p.status !== 'publicada');
        for (let i = 0; i < fila.length; i++) {
            if (cancelar)
                break;
            const post = store.getPost(fila[i].id);
            const settings = store.getSettings();
            const faltando = (0, format_1.pendentesDoPost)(post.campos);
            if (faltando.length > 0) {
                const msg = `Faltam campos: ${faltando.map((c) => format_1.ROTULOS[c]).join(', ')}.`;
                store.definirStatus(post.id, 'falhou', msg);
                emitir({ postId: post.id, status: 'falhou', mensagem: msg });
                falhas++;
                notificar('Não foi possível publicar', `${post.entrada.turma || 'Postagem'}: ${msg}`);
                continue;
            }
            store.definirStatus(post.id, 'publicando');
            emitir({ postId: post.id, status: 'publicando', mensagem: 'Abrindo o Engage…' });
            try {
                await engage.publicar(post, settings, {
                    arquivos: post.midias.map((m) => store.caminhoAbsolutoMidia(m)),
                    confirmarPublicacaoManual: () => confirmarManual(post),
                });
                store.definirStatus(post.id, 'publicada');
                emitir({ postId: post.id, status: 'publicada' });
                feitas++;
            }
            catch (e) {
                const msg = e.message;
                store.definirStatus(post.id, 'falhou', msg);
                emitir({ postId: post.id, status: 'falhou', mensagem: msg });
                falhas++;
                notificar('Não foi possível publicar', `${post.entrada.turma || 'Postagem'}: ${msg}`);
                if (e instanceof adapter_1.ErroSessao)
                    break; // sem sessão, não adianta tentar as próximas
            }
            if (i < fila.length - 1 && !cancelar)
                await dormir(settings.pausaEntrePostagens * 1000);
        }
        if (feitas + falhas > 0) {
            if (falhas === 0)
                notificar('Publicação concluída', feitas === 1 ? 'A postagem foi publicada.' : `${feitas} postagens publicadas.`);
            else
                notificar('Publicação terminou com problemas', `${feitas} publicada(s), ${falhas} com erro. Abra o app para ver o que aconteceu.`);
        }
    }
    finally {
        rodando = false;
        janela?.webContents.send('publicar:fim');
    }
}
h('publicar:iniciar', (ids) => {
    if (rodando)
        throw new Error('Já existe uma publicação em andamento.');
    // roda em segundo plano; o progresso volta por eventos
    void rodarFila(ids).catch((e) => (0, log_1.log)('erro', `fila: ${e.message}`));
});
h('publicar:cancelar', () => {
    cancelar = true;
});
h('sistema:copiar', (t) => electron_1.clipboard.writeText(t));
h('sistema:abrirSite', async (url) => {
    if (!SITES_PERMITIDOS.some((s) => url === s || url.startsWith(s + '/')))
        throw new Error('Endereço não permitido.');
    await electron_1.shell.openExternal(url);
});
h('sistema:abrirLogs', async () => {
    await electron_1.shell.openPath((0, log_1.pastaLogs)());
});
// ---------- ciclo de vida ----------
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (janela) {
            if (janela.isMinimized())
                janela.restore();
            janela.focus();
        }
    });
    void electron_1.app.whenReady().then(() => {
        electron_1.app.setAppUserModelId('br.senac.postagens-engage');
        // app-media://m/<postId>/<arquivo>  ->  arquivo dentro da pasta de mídias (e só dela)
        electron_1.protocol.handle('app-media', (req) => {
            const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
            const abs = node_path_1.default.resolve(store.pastaMidias(), rel);
            if (!abs.startsWith(node_path_1.default.resolve(store.pastaMidias()) + node_path_1.default.sep)) {
                return new Response('negado', { status: 403 });
            }
            return electron_1.net.fetch((0, node_url_1.pathToFileURL)(abs).toString(), { headers: req.headers });
        });
        (0, log_1.log)('info', `App iniciado (adaptador ${adapter_1.VERSAO_ADAPTADOR})`);
        criarJanela();
    });
    electron_1.app.on('window-all-closed', () => {
        void (0, browser_1.fecharContexto)().finally(() => electron_1.app.quit());
    });
}
