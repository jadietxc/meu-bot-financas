const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "..", "storage", "salarios.json");

function carregarSalarios() {
  if (!fs.existsSync(FILE_PATH)) return {};
  
  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(data) || {};
  } catch {
    return {};
  }
}

function salvarSalarios(dados) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(dados, null, 2), "utf-8");
}

function definirSalario(userId, valor) {
  const salarios = carregarSalarios();
  salarios[userId] = valor;
  salvarSalarios(salarios);
}

function obterSalario(userId) {
  const salarios = carregarSalarios();
  return salarios[userId] || null;
}

module.exports = {
  definirSalario,
  obterSalario
};
