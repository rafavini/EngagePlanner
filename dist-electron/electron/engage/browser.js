"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErroNavegador = void 0;
exports.pastaPerfil = pastaPerfil;
exports.obterContexto = obterContexto;
exports.fecharContexto = fecharContexto;
exports.apagarPerfil = apagarPerfil;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const playwright_core_1 = require("playwright-core");
const log_1 = require("../log");
let contexto = null;
class ErroNavegador extends Error {
}
exports.ErroNavegador = ErroNavegador;
/** Anota no registro as chamadas do Engage que falham (só endereço, sem parâmetros), para diagnóstico. */
function registrarDiagnostico(ctx) {
    let n = 0;
    const curto = (url) => {
        try {
            const u = new URL(url);
            return `${u.host}${u.pathname.slice(0, 80)}`;
        }
        catch {
            return 'url-invalida';
        }
    };
    const relevante = (url) => /engage\.cloud\.microsoft|yammer|office\.com|microsoft\.com/i.test(url);
    ctx.on('response', (r) => {
        if (n < 150 && r.status() >= 400 && relevante(r.url())) {
            n++;
            (0, log_1.log)('erro', `HTTP ${r.status()} ${curto(r.url())}`);
        }
    });
    ctx.on('requestfailed', (r) => {
        if (n < 150 && relevante(r.url())) {
            n++;
            (0, log_1.log)('erro', `Falha de rede ${curto(r.url())}: ${r.failure()?.errorText ?? '?'}`);
        }
    });
}
function pastaPerfil() {
    // Perfil próprio do app: guarda o login da conta da escola entre uma execução e outra.
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'perfil-engage');
}
/** Abre (ou reaproveita) o navegador com perfil persistente. Só uma janela por vez. */
async function obterContexto(preferido) {
    if (contexto) {
        try {
            // se o usuário fechou a janela, isso lança
            contexto.pages();
            if (contexto.browser()?.isConnected() !== false)
                return contexto;
        }
        catch {
            contexto = null;
        }
    }
    const canais = preferido === 'auto' ? ['msedge', 'chrome'] : [preferido];
    let ultimoErro;
    for (const canal of canais) {
        try {
            const ctx = await playwright_core_1.chromium.launchPersistentContext(pastaPerfil(), {
                channel: canal,
                headless: false,
                viewport: null,
                // Por padrão o Playwright liga --no-sandbox (o navegador mostra um aviso de segurança).
                // Aqui o navegador é o do próprio professor, então mantemos o sandbox ligado.
                chromiumSandbox: true,
                args: ['--start-maximized'],
            });
            registrarDiagnostico(ctx);
            ctx.on('close', () => {
                if (contexto === ctx)
                    contexto = null;
            });
            contexto = ctx;
            (0, log_1.log)('info', `Navegador aberto (${canal}).`);
            return ctx;
        }
        catch (e) {
            ultimoErro = e;
            const msg = e.message;
            (0, log_1.log)('erro', `Falha ao abrir ${canal}: ${msg.slice(0, 300)}`);
            if (/already in use|ProcessSingleton|user data directory/i.test(msg)) {
                throw new ErroNavegador('A janela do Engage já está aberta em outro lugar. Feche a janela do navegador do app e tente de novo.');
            }
        }
    }
    const nomes = preferido === 'auto' ? 'Microsoft Edge nem o Google Chrome' : preferido === 'msedge' ? 'Microsoft Edge' : 'Google Chrome';
    throw new ErroNavegador(`Não encontrei o ${nomes} neste computador. Instale um deles ou escolha outro navegador em Configurações.` +
        (ultimoErro ? '' : ''));
}
async function fecharContexto() {
    const c = contexto;
    contexto = null;
    if (c)
        await c.close().catch(() => { });
}
/** Apaga o login guardado (cookies, contas) para poder entrar de novo com outra conta. */
async function apagarPerfil() {
    await fecharContexto();
    node_fs_1.default.rmSync(pastaPerfil(), { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
    (0, log_1.log)('info', 'Perfil do navegador do app apagado (troca de conta).');
}
