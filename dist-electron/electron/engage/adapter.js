"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VivaEngageAdapter = exports.ErroAdaptador = exports.ErroSessao = exports.VERSAO_ADAPTADOR = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const format_1 = require("../../shared/format");
const log_1 = require("../log");
const browser_1 = require("./browser");
const selectors_1 = require("./selectors");
/** Muda a cada correção importante: aparece no registro para sabermos qual versão rodou. */
exports.VERSAO_ADAPTADOR = '2026-10-29-v4-notificacoes';
class ErroSessao extends Error {
}
exports.ErroSessao = ErroSessao;
class ErroAdaptador extends Error {
}
exports.ErroAdaptador = ErroAdaptador;
async function paginaAtiva(s) {
    const ctx = await (0, browser_1.obterContexto)(s.navegador);
    const existente = ctx.pages().find((p) => !p.isClosed());
    const page = existente ?? (await ctx.newPage());
    await page.bringToFront().catch(() => { });
    return page;
}
function emTelaDeLogin(url) {
    try {
        return selectors_1.HOSTS_DE_LOGIN.includes(new URL(url).host);
    }
    catch {
        return false;
    }
}
async function irParaComunidade(page, s) {
    if (!/^https:\/\//i.test(s.comunidadeUrl)) {
        throw new ErroAdaptador('Cole o link da comunidade nas Configurações (precisa começar com https://).');
    }
    await page.goto(s.comunidadeUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // O Engage mantém conexões abertas, então "networkidle" pode nunca chegar: é só uma ajuda.
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => { });
    // dá tempo de um eventual redirecionamento para o login acontecer
    await page.waitForTimeout(1500);
}
async function capturar(page, nome) {
    try {
        const arq = node_path_1.default.join((0, log_1.pastaCapturas)(), `${nome}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
        await page.screenshot({ path: arq, fullPage: false });
        return arq;
    }
    catch {
        return null;
    }
}
/** Salva a estrutura acessível da tela: ajuda a descobrir os nomes certos dos botões. */
async function salvarEstrutura(alvo, nome) {
    try {
        const raiz = 'locator' in alvo ? alvo.locator('body') : alvo;
        const txt = await raiz.ariaSnapshot({ timeout: 8000 });
        node_fs_1.default.writeFileSync(node_path_1.default.join((0, log_1.pastaCapturas)(), `${nome}-estrutura.txt`), txt);
    }
    catch {
        /* melhor esforço */
    }
}
async function digitarTexto(page, post, s) {
    const editor = await (0, selectors_1.primeiroVisivel)(page, selectors_1.SELETORES.editor, 10_000);
    if (!editor)
        throw new ErroAdaptador('Não achei a caixa de texto da postagem.');
    await editor.click();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    const trechos = s.rotulosEmNegrito
        ? (0, format_1.trechosDoPost)(post.campos)
        : [{ texto: (0, format_1.textoPlanoDoPost)(post.campos), negrito: false }];
    for (const t of trechos) {
        if (t.negrito)
            await page.keyboard.press(`${mod}+B`);
        const linhas = t.texto.split('\n');
        for (let i = 0; i < linhas.length; i++) {
            if (i > 0)
                await page.keyboard.press('Shift+Enter');
            if (linhas[i])
                await page.keyboard.insertText(linhas[i]);
        }
        if (t.negrito)
            await page.keyboard.press(`${mod}+B`);
    }
    // confere que o texto realmente entrou
    const trecho = post.campos.descricao.slice(0, 25);
    const dentro = await editor.innerText().catch(() => '');
    if (trecho && !dentro.includes(trecho)) {
        throw new ErroAdaptador('O texto não apareceu na caixa de postagem como esperado.');
    }
}
/**
 * Acha a janela de "nova postagem". Tudo o que for anexar acontece SÓ dentro dela:
 * a página do Engage tem outros campos de arquivo (por exemplo, o da foto de capa
 * da comunidade) e usar um deles mudaria a capa em vez de anexar à postagem.
 */
async function acharJanelaDePostagem(page) {
    const dialogo = page.getByRole('dialog').filter({ has: page.getByRole('textbox') });
    if ((await dialogo.count()) > 0)
        return dialogo.last();
    const alternativa = page
        .locator('div')
        .filter({ has: page.locator('[contenteditable="true"]') })
        .filter({ has: page.getByRole('button', { name: /^(publicar|postar|enviar|post|publish)$/i }) })
        .last();
    if ((await alternativa.count()) > 0)
        return alternativa;
    throw new ErroAdaptador('Não consegui identificar a janela de nova postagem. Por segurança, não anexei nada (para não mexer em outro lugar da página).');
}
async function anexarArquivos(page, janela, arquivos) {
    if (arquivos.length === 0)
        return;
    // 1) O caminho "de gente": clica no botão de anexar DENTRO da janela e escolhe os arquivos.
    const botao = await (0, selectors_1.primeiroVisivel)(page, selectors_1.SELETORES.anexar, 4000, janela);
    if (botao) {
        const nome = (await botao.getAttribute('aria-label').catch(() => null)) ?? (await botao.innerText().catch(() => '')) ?? '';
        (0, log_1.log)('info', `anexar: cliquei no botão "${nome.slice(0, 40)}"`);
        const esperaDireta = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null);
        await botao.click();
        let chooser = await esperaDireta;
        if (!chooser) {
            // o botão abriu um menu (que fica fora da janela): escolhe a opção "do computador"
            const item = await (0, selectors_1.primeiroVisivel)(page, selectors_1.SELETORES.anexarMenuItem, 3000);
            if (item) {
                (0, log_1.log)('info', 'anexar: escolhi a opção "do computador" no menu');
                const espera = page.waitForEvent('filechooser', { timeout: 10_000 });
                await item.click();
                chooser = await espera;
            }
        }
        if (chooser) {
            await chooser.setFiles(arquivos);
            (0, log_1.log)('info', 'anexar: arquivos enviados pela escolha de arquivos');
            return;
        }
    }
    // 2) Alternativa: um campo de arquivo que esteja DENTRO da janela de postagem.
    const input = janela.locator('input[type="file"]');
    if ((await input.count()) > 0) {
        await input.first().setInputFiles(arquivos);
        (0, log_1.log)('info', 'anexar: arquivos enviados pelo campo de arquivo da janela');
        return;
    }
    throw new ErroAdaptador('Não consegui anexar: não achei o botão de anexar dentro da janela de postagem (veja a pasta de capturas).');
}
/** Espera as miniaturas das mídias aparecerem na janela de postagem (o Engage pode demorar). */
async function esperarMiniaturas(page, janela, antes, esperadas, timeoutMs) {
    const fim = Date.now() + timeoutMs;
    let atual = antes;
    while (Date.now() < fim) {
        atual = await janela.locator('img, video').count().catch(() => antes);
        if (atual >= antes + esperadas)
            return atual;
        await page.waitForTimeout(700);
    }
    return atual;
}
async function esperarEnvioDasMidias(page, janela, timeoutMs) {
    const fim = Date.now() + timeoutMs;
    let seguidasSemProgresso = 0;
    while (Date.now() < fim) {
        const ocupados = await janela.getByRole('progressbar').count().catch(() => 0);
        seguidasSemProgresso = ocupados === 0 ? seguidasSemProgresso + 1 : 0;
        if (seguidasSemProgresso >= 4)
            return;
        await page.waitForTimeout(500);
    }
    throw new ErroAdaptador('O envio das fotos/vídeos demorou demais.');
}
class VivaEngageAdapter {
    nome = 'Viva Engage';
    async abrirParaLogin(s) {
        const page = await paginaAtiva(s);
        await irParaComunidade(page, s);
    }
    async verificarSessao(s) {
        const page = await paginaAtiva(s);
        await irParaComunidade(page, s);
        if (emTelaDeLogin(page.url())) {
            return { logado: false, mensagem: 'Você ainda não entrou. Faça o login na janela que abriu.' };
        }
        const abrir = await (0, selectors_1.primeiroVisivel)(page, [...selectors_1.SELETORES.abrirEditor], 8000);
        return abrir
            ? { logado: true, mensagem: 'Tudo certo: a comunidade abriu e o botão de nova postagem foi encontrado.' }
            : {
                logado: true,
                mensagem: 'Você está logado, mas não encontrei o botão de nova postagem. Pode ser que seu perfil não possa postar ali, ou que o nome do botão precise de ajuste (veja a pasta de capturas).',
            };
    }
    async publicar(post, s, op) {
        const page = await paginaAtiva(s);
        const rotuloLog = `post ${post.id.slice(0, 8)}`;
        try {
            (0, log_1.log)('info', `${rotuloLog}: abrindo comunidade (adaptador ${exports.VERSAO_ADAPTADOR})`);
            await irParaComunidade(page, s);
            if (emTelaDeLogin(page.url())) {
                throw new ErroSessao('Sua sessão expirou. Vá em Configurações e clique em "Entrar no Engage".');
            }
            (0, log_1.log)('info', `${rotuloLog}: abrindo editor`);
            const abrir = await (0, selectors_1.primeiroVisivel)(page, selectors_1.SELETORES.abrirEditor, 15_000);
            if (!abrir)
                throw new ErroAdaptador('Não achei o botão para começar uma nova postagem.');
            await abrir.click();
            (0, log_1.log)('info', `${rotuloLog}: digitando texto`);
            await digitarTexto(page, post, s);
            if (op.arquivos.length > 0) {
                (0, log_1.log)('info', `${rotuloLog}: anexando ${op.arquivos.length} arquivo(s)`);
                const janela = await acharJanelaDePostagem(page);
                const dentro = await janela.locator('input[type="file"]').count();
                const naPagina = await page.locator('input[type="file"]').count();
                (0, log_1.log)('info', `${rotuloLog}: campos de arquivo — na janela: ${dentro}, na página toda: ${naPagina}`);
                await salvarEstrutura(janela, `janela-${post.id.slice(0, 8)}`);
                const antes = await janela.locator('img, video').count();
                await anexarArquivos(page, janela, op.arquivos);
                const temVideo = post.midias.some((m) => m.tipo === 'video');
                await esperarEnvioDasMidias(page, janela, temVideo ? 10 * 60_000 : 2 * 60_000);
                // confere que as mídias apareceram na postagem (e não em outro lugar)
                const depois = await esperarMiniaturas(page, janela, antes, op.arquivos.length, temVideo ? 120_000 : 30_000);
                if (depois <= antes) {
                    const aviso = 'Anexei os arquivos, mas não vi as miniaturas aparecerem na janela de postagem.';
                    if (!s.pararAntesDePublicar)
                        throw new ErroAdaptador(aviso + ' Por segurança, não publiquei.');
                    (0, log_1.log)('erro', `${rotuloLog}: ${aviso} (seguindo: o professor confere na tela)`);
                }
                else if (depois < antes + op.arquivos.length) {
                    (0, log_1.log)('info', `${rotuloLog}: apareceram ${depois - antes} de ${op.arquivos.length} miniaturas (pode ser só o jeito da tela)`);
                }
            }
            await capturar(page, `pronta-${post.id.slice(0, 8)}`);
            if (s.pararAntesDePublicar) {
                const r = await op.confirmarPublicacaoManual();
                if (r === 'nao-publicada')
                    throw new ErroAdaptador('Você escolheu não publicar esta postagem.');
                return;
            }
            (0, log_1.log)('info', `${rotuloLog}: publicando`);
            const publicar = await (0, selectors_1.primeiroVisivel)(page, selectors_1.SELETORES.publicar, 8000);
            if (!publicar)
                throw new ErroAdaptador('Não achei o botão final de publicar.');
            await publicar.click();
            // confirma: o texto novo precisa aparecer no feed
            const marca = post.campos.descricao.slice(0, 40);
            const apareceu = await page
                .getByText(marca, { exact: false })
                .first()
                .waitFor({ state: 'visible', timeout: 30_000 })
                .then(() => true)
                .catch(() => false);
            if (!apareceu) {
                throw new ErroAdaptador('Cliquei em publicar, mas não consegui confirmar que a postagem apareceu. Confira no Engage ANTES de tentar de novo, para não duplicar.');
            }
            (0, log_1.log)('info', `${rotuloLog}: publicada`);
        }
        catch (e) {
            const nome = `falha-${post.id.slice(0, 8)}`;
            await capturar(page, nome);
            await salvarEstrutura(page, nome);
            (0, log_1.log)('erro', `${rotuloLog}: ${e.message}`);
            throw e;
        }
    }
}
exports.VivaEngageAdapter = VivaEngageAdapter;
