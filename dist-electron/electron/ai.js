"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gemini = void 0;
const store_1 = require("./store");
const log_1 = require("./log");
class Gemini {
    modelo;
    nome = 'Google Gemini';
    constructor(modelo) {
        this.modelo = modelo;
    }
    async gerar(prompt) {
        const chave = (0, store_1.lerChaveGemini)();
        if (!chave)
            throw new Error('Cadastre a chave do Gemini em Configurações.');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 60_000);
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
            });
            if (!resp.ok) {
                const corpo = await resp.text().catch(() => '');
                (0, log_1.log)('erro', `Gemini HTTP ${resp.status}: ${corpo.slice(0, 300)}`);
                if (resp.status === 400 || resp.status === 403)
                    throw new Error('A chave do Gemini foi recusada. Confira se ela está correta.');
                if (resp.status === 404)
                    throw new Error(`O modelo "${this.modelo}" não existe. Troque o nome do modelo em Configurações.`);
                if (resp.status === 429)
                    throw new Error('Limite gratuito do Gemini atingido. Espere um pouco ou use o modo "Copiar e colar".');
                throw new Error(`O Gemini respondeu com erro ${resp.status}.`);
            }
            const json = (await resp.json());
            const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
            if (!texto.trim())
                throw new Error('O Gemini não devolveu texto. Tente de novo.');
            return texto;
        }
        catch (e) {
            if (e.name === 'AbortError')
                throw new Error('O Gemini demorou demais para responder.');
            throw e;
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.Gemini = Gemini;
