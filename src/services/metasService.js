const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");
const FILE_PATH = path.join(STORAGE_DIR, "metas.json");

function garantirStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function carregarMetas() {
  garantirStorage();

  if (!fs.existsSync(FILE_PATH)) {
    return {};
  }

  try {
    const conteudo = fs.readFileSync(FILE_PATH, "utf-8");
    if (!conteudo.trim()) return {};
    return JSON.parse(conteudo);
  } catch (e) {
    console.error("Erro ao ler metas.json:", e);
    return {};
  }
}

function salvarMetas(metas) {
  garantirStorage();
  fs.writeFileSync(FILE_PATH, JSON.stringify(metas, null, 2), "utf-8");
}

function definirMetaMensal(userId, valor) {
  const metas = carregarMetas();
  if (!metas[userId]) metas[userId] = {};
  metas[userId].mensal = valor;
  salvarMetas(metas);
}

function obterMetaMensal(userId) {
  const metas = carregarMetas();
  if (!metas[userId]) return null;
  return metas[userId].mensal ?? null;
}

module.exports = {
  definirMetaMensal,
  obterMetaMensal,
};
