const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");
const FILE_PATH = path.join(STORAGE_DIR, "gastos.json");

// Garante que a pasta storage existe
function garantirStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

// Carrega os gastos do arquivo
function carregarGastos() {
  garantirStorage();

  if (!fs.existsSync(FILE_PATH)) {
    return [];
  }

  try {
    const conteudo = fs.readFileSync(FILE_PATH, "utf-8");
    if (!conteudo.trim()) return [];
    return JSON.parse(conteudo);
  } catch (e) {
    console.error("Erro ao ler gastos.json:", e);
    return [];
  }
}

// Salva os gastos no arquivo
function salvarGastos(gastos) {
  garantirStorage();
  fs.writeFileSync(FILE_PATH, JSON.stringify(gastos, null, 2), "utf-8");
}

// Registrar gasto: recebe um objeto
function registrarGasto(gasto) {
  const gastos = carregarGastos();
  gastos.push(gasto);
  salvarGastos(gastos);
  console.log("Gasto registrado:", gasto);
}

// Listar todos os gastos
function listarPorData() {
  return carregarGastos();
}

module.exports = {
  registrarGasto,
  listarPorData,
};
