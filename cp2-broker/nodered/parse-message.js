const matriculas = env.get('MATRICULAS');
if (!matriculas || matriculas === 'PREENCHER') return null;
const prefix = `unidavi/iot/t27/${matriculas}/`;
if (typeof msg.topic !== 'string' || !msg.topic.startsWith(prefix)) return null;
const parts = msg.topic.slice(prefix.length).split('/');
const species = ['aroeira-vermelha', 'inga'].indexOf(parts[0]);
if (species < 0) return null;
const outputs = Array(12).fill(null);
let slot;
let text;
try {
    if (parts.length === 2 && parts[1] === 'status') {
        text = String(msg.payload);
        if (!['online', 'offline'].includes(text)) return null;
        slot = 5;
    } else if (parts.length === 3) {
        const data = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (!data || typeof data !== 'object') return null;
        if (parts[1] === 'sensor') {
            slot = ['umidade-solo', 'luminosidade', 'temperatura'].indexOf(parts[2]);
            if (slot < 0 || typeof data.valor !== 'number' || !Number.isFinite(data.valor)) return null;
            const unit = slot === 2 ? '°C' : '%';
            if (data.unidade !== unit) return null;
            if (slot < 2 && (data.valor < 0 || data.valor > 100)) return null;
            text = `${data.valor} ${unit}`;
        } else if (parts[1] === 'atuador') {
            const names = species === 0 ? ['irrigacao', 'sombreamento'] : ['irrigacao', 'ventilacao'];
            const index = names.indexOf(parts[2]);
            if (index < 0 || !['ligado', 'desligado'].includes(data.estado)) return null;
            slot = 3 + index;
            text = data.estado;
        } else return null;
    } else return null;
} catch (error) {
    node.warn('Mensagem MQTT inválida: ' + error.message);
    return null;
}
outputs[species * 6 + slot] = {...msg, payload: text};
return outputs;
