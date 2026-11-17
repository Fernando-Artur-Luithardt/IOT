// Nó "function" do Node-RED: prepara uma mensagem MQTT para gravar no Supabase.
// Ligue a saída do nó "mqtt in" (assinando unidavi/iot/t28/SUAS_MATRICULAS/#) a este nó,
// e a saída deste nó a um nó "http request" (método e URL vêm da mensagem).
//
// Variáveis de ambiente do Node-RED (ficam fora do fluxo exportado):
//   SUPABASE_URL  ex.: https://xxxxxxxx.supabase.co
//   SUPABASE_KEY  chave anon (JWT) ou publishable do seu projeto

const URL_BASE = env.get("SUPABASE_URL");
const CHAVE = env.get("SUPABASE_KEY");
if (!URL_BASE || !CHAVE) { node.error("Defina SUPABASE_URL e SUPABASE_KEY"); return null; }

const partes = String(msg.topic || "").split("/");   // unidavi / iot / t28 / equipe / especie / categoria / nome
if (partes.length < 6) return null;
const equipe = partes[3], especie = partes[4], categoria = partes[5], nome = partes[6];

function lePayload() {
    if (typeof msg.payload === "object" && msg.payload !== null && !Buffer.isBuffer(msg.payload)) return msg.payload;
    try { return JSON.parse(String(msg.payload)); } catch (e) { return null; }
}

let tabela, linha;
if (categoria === "sensor" && partes.length === 7) {
    const p = lePayload();
    if (!p) return null;
    const valor = Number(p.valor);
    if (p.valor === null || typeof p.valor === "boolean" || !isFinite(valor)) return null;   // valor inválido: ignora
    tabela = "leituras";
    linha = { equipe, especie, sensor: nome, valor, unidade: String(p.unidade === undefined ? "" : p.unidade) };

} else if (categoria === "atuador" && partes.length === 7) {
    const p = lePayload();
    if (!p || (p.estado !== "ligado" && p.estado !== "desligado")) return null;
    const ligado = p.estado === "ligado";
    const chave = "ult_atuador_" + equipe + "_" + especie + "_" + nome;
    if (flow.get(chave) === ligado) return null;       // só grava quando o estado muda
    flow.set(chave, ligado);
    tabela = "estados_atuadores";
    linha = { equipe, especie, atuador: nome, ligado };

} else if (categoria === "status" && partes.length === 6) {
    const status = String(msg.payload).trim();
    if (status !== "online" && status !== "offline") return null;
    const chave = "ult_status_" + equipe + "_" + especie;
    if (flow.get(chave) === status) return null;       // só grava quando muda
    flow.set(chave, status);
    tabela = "status_placa";
    linha = { equipe, especie, status };

} else {
    return null;                                       // qualquer outro tópico é ignorado
}

msg.method = "POST";
msg.url = URL_BASE + "/rest/v1/" + tabela;
msg.headers = {
    "apikey": CHAVE,
    "Authorization": "Bearer " + CHAVE,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"                         // obrigatório: a chave pública não lê o que insere
};
msg.payload = linha;
return msg;
