"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPost = exports.getPosts = exports.getSettings = exports.pastaMidias = void 0;
exports.salvarSettings = salvarSettings;
exports.criarPost = criarPost;
exports.atualizarPost = atualizarPost;
exports.definirStatus = definirStatus;
exports.removerPost = removerPost;
exports.duplicarPost = duplicarPost;
exports.classificar = classificar;
exports.adicionarMidias = adicionarMidias;
exports.removerMidia = removerMidia;
exports.caminhoAbsolutoMidia = caminhoAbsolutoMidia;
exports.temChaveGemini = temChaveGemini;
exports.salvarChaveGemini = salvarChaveGemini;
exports.lerChaveGemini = lerChaveGemini;
const electron_1 = require("electron");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const types_1 = require("../shared/types");
const format_1 = require("../shared/format");
const base = () => electron_1.app.getPath('userData');
const arquivoDados = () => node_path_1.default.join(base(), 'dados.json');
const pastaMidias = () => {
    const d = node_path_1.default.join(base(), 'midias');
    node_fs_1.default.mkdirSync(d, { recursive: true });
    return d;
};
exports.pastaMidias = pastaMidias;
let dados = null;
function carregar() {
    if (dados)
        return dados;
    let lido = {};
    try {
        lido = JSON.parse(node_fs_1.default.readFileSync(arquivoDados(), 'utf8'));
    }
    catch {
        /* primeira execução ou arquivo ilegível */
    }
    dados = {
        settings: { ...types_1.SETTINGS_PADRAO, ...(lido.settings ?? {}) },
        posts: lido.posts ?? [],
        geminiChaveCript: lido.geminiChaveCript,
    };
    // Postagem que ficou "publicando" quando o app fechou: NÃO republicar sozinho.
    for (const p of dados.posts) {
        if (p.status === 'publicando') {
            p.status = 'falhou';
            p.erro = 'O app foi fechado durante a publicação. Confira no Engage se a postagem já saiu antes de tentar de novo.';
        }
    }
    salvar();
    return dados;
}
function salvar() {
    if (!dados)
        return;
    const tmp = arquivoDados() + '.tmp';
    node_fs_1.default.writeFileSync(tmp, JSON.stringify(dados, null, 2));
    node_fs_1.default.renameSync(tmp, arquivoDados());
}
const getSettings = () => carregar().settings;
exports.getSettings = getSettings;
const getPosts = () => carregar().posts;
exports.getPosts = getPosts;
const getPost = (id) => carregar().posts.find((p) => p.id === id);
exports.getPost = getPost;
function salvarSettings(parcial) {
    const d = carregar();
    d.settings = { ...d.settings, ...parcial };
    salvar();
    return d.settings;
}
/** Data de hoje no fuso do computador (não em UTC, que vira "amanhã" à noite). */
function dataLocalISO() {
    const d = new Date();
    const dois = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
function criarPost() {
    const d = carregar();
    const agora = new Date().toISOString();
    const post = {
        id: node_crypto_1.default.randomUUID(),
        criadoEm: agora,
        atualizadoEm: agora,
        status: 'rascunho',
        entrada: { dataISO: dataLocalISO(), turma: '', uc: '', relato: '' },
        campos: (0, format_1.camposVazios)(),
        midias: [],
    };
    d.posts.unshift(post);
    salvar();
    return post;
}
function atualizarPost(id, patch) {
    const p = (0, exports.getPost)(id);
    if (!p)
        throw new Error('Postagem não encontrada.');
    if (p.status === 'publicando')
        throw new Error('Esta postagem está sendo publicada agora.');
    Object.assign(p, patch);
    p.atualizadoEm = new Date().toISOString();
    salvar();
    return p;
}
/** Uso interno da publicação (permite mudar o status durante o envio) */
function definirStatus(id, status, erro) {
    const p = (0, exports.getPost)(id);
    if (!p)
        throw new Error('Postagem não encontrada.');
    p.status = status;
    p.erro = erro;
    if (status === 'publicada')
        p.publicadoEm = new Date().toISOString();
    p.atualizadoEm = new Date().toISOString();
    salvar();
    return p;
}
function removerPost(id) {
    const d = carregar();
    const p = (0, exports.getPost)(id);
    if (p?.status === 'publicando')
        throw new Error('Esta postagem está sendo publicada agora.');
    d.posts = d.posts.filter((x) => x.id !== id);
    node_fs_1.default.rmSync(node_path_1.default.join((0, exports.pastaMidias)(), id), { recursive: true, force: true });
    salvar();
}
function duplicarPost(id) {
    const d = carregar();
    const orig = (0, exports.getPost)(id);
    if (!orig)
        throw new Error('Postagem não encontrada.');
    const novo = criarPost();
    novo.entrada = { ...orig.entrada };
    novo.campos = { ...orig.campos };
    // mídias não são copiadas: cada postagem tem suas próprias fotos
    d.posts = [novo, ...d.posts.filter((p) => p.id !== novo.id)];
    salvar();
    return novo;
}
// ---------- mídias ----------
function classificar(arquivo) {
    const ext = node_path_1.default.extname(arquivo).toLowerCase();
    if (types_1.LIMITES.extensoesImagem.includes(ext))
        return { tipo: 'imagem' };
    if (types_1.LIMITES.extensoesVideo.includes(ext))
        return { tipo: 'video' };
    return { erro: `Formato não aceito: ${ext || 'sem extensão'}. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.` };
}
function adicionarMidias(postId, caminhos) {
    const p = (0, exports.getPost)(postId);
    if (!p)
        throw new Error('Postagem não encontrada.');
    const avisos = [];
    const destDir = node_path_1.default.join((0, exports.pastaMidias)(), postId);
    node_fs_1.default.mkdirSync(destDir, { recursive: true });
    for (const origem of caminhos) {
        try {
            const c = classificar(origem);
            if ('erro' in c && c.erro) {
                avisos.push(`${node_path_1.default.basename(origem)}: ${c.erro}`);
                continue;
            }
            const stat = node_fs_1.default.statSync(origem);
            if (!stat.isFile())
                continue;
            const tipo = c.tipo;
            const maxMB = tipo === 'imagem' ? types_1.LIMITES.imagemMaxMB : types_1.LIMITES.videoMaxMB;
            if (stat.size > maxMB * 1024 * 1024) {
                avisos.push(`${node_path_1.default.basename(origem)}: maior que ${maxMB} MB.`);
                continue;
            }
            const id = node_crypto_1.default.randomUUID();
            const nomeSeguro = id.slice(0, 8) + '-' + node_path_1.default.basename(origem).replace(/[^\w.\-]+/g, '_');
            node_fs_1.default.copyFileSync(origem, node_path_1.default.join(destDir, nomeSeguro));
            p.midias.push({ id, nome: node_path_1.default.basename(origem), rel: `${postId}/${nomeSeguro}`, tipo, tamanho: stat.size });
        }
        catch (e) {
            avisos.push(`${node_path_1.default.basename(origem)}: ${e.message}`);
        }
    }
    p.atualizadoEm = new Date().toISOString();
    salvar();
    return { post: p, avisos };
}
function removerMidia(postId, midiaId) {
    const p = (0, exports.getPost)(postId);
    if (!p)
        throw new Error('Postagem não encontrada.');
    const m = p.midias.find((x) => x.id === midiaId);
    if (m)
        node_fs_1.default.rmSync(node_path_1.default.join((0, exports.pastaMidias)(), m.rel), { force: true });
    p.midias = p.midias.filter((x) => x.id !== midiaId);
    salvar();
    return p;
}
function caminhoAbsolutoMidia(m) {
    const abs = node_path_1.default.resolve((0, exports.pastaMidias)(), m.rel);
    if (!abs.startsWith(node_path_1.default.resolve((0, exports.pastaMidias)()) + node_path_1.default.sep))
        throw new Error('Caminho de mídia inválido.');
    return abs;
}
// ---------- chave do Gemini (criptografada pelo sistema operacional) ----------
function temChaveGemini() {
    return !!carregar().geminiChaveCript;
}
function salvarChaveGemini(chave) {
    const d = carregar();
    const limpa = chave.trim();
    if (!limpa) {
        d.geminiChaveCript = undefined;
    }
    else {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error('Este computador não permite guardar a chave com segurança. Use o modo "Copiar e colar".');
        }
        d.geminiChaveCript = electron_1.safeStorage.encryptString(limpa).toString('base64');
    }
    salvar();
}
function lerChaveGemini() {
    const c = carregar().geminiChaveCript;
    if (!c)
        return null;
    try {
        return electron_1.safeStorage.decryptString(Buffer.from(c, 'base64'));
    }
    catch {
        return null;
    }
}
