const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");
const FILE_PATH = path.join(STORAGE_DIR, "gastos.json");

function garantirStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function carregarGastos() {
  garantirStorage();

  if (!fs.existsSync(FILE_PATH)) {
    return [];
  }

  try {
    const conteudo = fs.readFileSync(FILE_PATH, "utf-8");
    if (!conteudo.trim()) return [];

    const dados = JSON.parse(conteudo);

    // Normaliza IDs para gastos antigos que não tinham id
    let mudou = false;
    let nextId = 1;

    dados.forEach((g) => {
      if (typeof g.id === "number" && g.id >= nextId) {
        nextId = g.id + 1;
      }
    });

    dados.forEach((g) => {
      if (g.id == null) {
        g.id = nextId++;
        mudou = true;
      }
    });

    if (mudou) {
      fs.writeFileSync(FILE_PATH, JSON.stringify(dados, null, 2), "utf-8");
    }

    return dados;
  } catch (e) {
    console.error("Erro ao ler gastos.json:", e);
    return [];
  }
}

function salvarGastos(gastos) {
  garantirStorage();
  fs.writeFileSync(FILE_PATH, JSON.stringify(gastos, null, 2), "utf-8");
}

function gerarProximoId(gastos) {
  let maxId = 0;
  gastos.forEach((g) => {
    if (typeof g.id === "number" && g.id > maxId) {
      maxId = g.id;
    }
  });
  return maxId + 1;
}

// Registrar gasto: agora sempre gera ID
function registrarGasto(gasto) {
  const gastos = carregarGastos();
  const id = gerarProximoId(gastos);

  const novoGasto = {
    id,
    ...gasto,
  };

  gastos.push(novoGasto);
  salvarGastos(gastos);
  console.log("Gasto registrado:", novoGasto);

  return novoGasto;
}

function listarPorData() {
  return carregarGastos();
}

function listarPorUsuario(userId) {
  return carregarGastos().filter((g) => g.userId === userId);
}

function removerGasto(userId, id) {
  const gastos = carregarGastos();
  const index = gastos.findIndex((g) => g.userId === userId && g.id === id);

  if (index === -1) {
    return false;
  }

  gastos.splice(index, 1);
  salvarGastos(gastos);
  return true;
}

function atualizarGasto(userId, id, updates) {
  const gastos = carregarGastos();
  const gasto = gastos.find((g) => g.userId === userId && g.id === id);

  if (!gasto) {
    return null;
  }

  if (updates.categoria !== undefined) {
    gasto.categoria = updates.categoria;
  }

  if (updates.valor !== undefined) {
    gasto.valor = updates.valor;
  }

  if (updates.descricao !== undefined) {
    gasto.descricao = updates.descricao;
  }

  salvarGastos(gastos);
  return gasto;
}

function resetUsuario(userId) {
  const gastos = carregarGastos();
  const filtrados = gastos.filter((g) => g.userId !== userId);
  const removidos = gastos.length - filtrados.length;

  if (removidos > 0) {
    salvarGastos(filtrados);
  }

  return removidos;
}

module.exports = {
  registrarGasto,
  listarPorData,
  listarPorUsuario,
  removerGasto,
  atualizarGasto,
  resetUsuario,
};
