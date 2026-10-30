"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pastaLogs = pastaLogs;
exports.pastaCapturas = pastaCapturas;
exports.log = log;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function pastaLogs() {
    const dir = node_path_1.default.join(electron_1.app.getPath('userData'), 'logs');
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
function pastaCapturas() {
    const dir = node_path_1.default.join(pastaLogs(), 'capturas');
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
/** Remove possíveis chaves/tokens antes de gravar */
function sanitizar(msg) {
    return msg
        .replace(/AIza[0-9A-Za-z_\-]{20,}/g, 'AIza***')
        .replace(/(key|token|authorization)=([^&\s]+)/gi, '$1=***');
}
function log(nivel, msg) {
    const linha = `${new Date().toISOString()} [${nivel}] ${sanitizar(msg)}\n`;
    try {
        node_fs_1.default.appendFileSync(node_path_1.default.join(pastaLogs(), 'app.log'), linha);
    }
    catch {
        /* sem log não é motivo para quebrar o app */
    }
    if (!electron_1.app.isPackaged)
        console.log(linha.trimEnd());
}
