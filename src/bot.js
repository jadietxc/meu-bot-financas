const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_TOKEN } = require("../config/env");
const {
  registrarGasto,
  listarPorData,
  listarPorUsuario,
  removerGasto,
  atualizarGasto,
  resetUsuario,
} = require("./services/gastosService");
const {
  definirMetaMensal,
  obterMetaMensal,
} = require("./services/metasService");

// Inicializa o bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Mensagem de ajuda
const helpMessage = `
Aqui estão os comandos disponíveis:

/start   - Vamos Começar!
/gasto   - Registrar um gasto.
/listar  - Listar seus últimos gastos com ID.
/del <id> - Remover um gasto pelo ID.
/edit <id> <campo> <novo valor> (campos: valor, categoria, descricao)
/reset  - Apagar TODOS os seus gastos (com confirmação).

/hoje    - Resumo de hoje.
/semana  - Resumo da semana.
/mes     - Resumo do mês.
/ano     - Resumo do ano.
/meta    - Definir ou ver a meta mensal.
/grafico <periodo> - Gráfico de pizza (hoje, semana, mes, ano).
/exportar - Exportar seus gastos em CSV.
/help    - Ver todos os comandos.
`;

// Parse do /gasto
function parseMensagemGasto(texto) {
  const partes = texto.trim().split(/\s+/);

  if (partes.length < 2) {
    return {
      erro:
        "Uso correto: /gasto <categoria> <valor> <descricao opcional>\nExemplo: /gasto lanche 15.90 hamburguer",
    };
  }

  const categoria = partes[0];
  const valorBruto = partes[1].replace(",", ".");
  const descricao = partes.slice(2).join(" ");

  const valorNumero = parseFloat(valorBruto);

  if (isNaN(valorNumero)) {
    return {
      erro:
        "Valor inválido. Use número com ponto ou vírgula.\nExemplos:\n/gasto lanche 15.90 hamburguer\n/gasto faculdade 166 mensalidade",
    };
  }

  return {
    categoria,
    valor: valorNumero,
    descricao,
  };
}

// Helpers de período
function obterGastosPeriodo(userId, periodo) {
  const todos = listarPorData();
  const agora = new Date();

  if (periodo === "hoje") {
    return todos.filter(
      (g) =>
        g.userId === userId &&
        new Date(g.data).toDateString() === agora.toDateString()
    );
  }

  if (periodo === "semana") {
    const hoje = agora;
    const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda...
    const inicioSemana = new Date(hoje);
    const fimSemana = new Date(hoje);

    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    inicioSemana.setDate(hoje.getDate() + diffParaSegunda);
    inicioSemana.setHours(0, 0, 0, 0);

    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);

    return todos.filter((g) => {
      if (g.userId !== userId) return false;
      const d = new Date(g.data);
      return d >= inicioSemana && d <= fimSemana;
    });
  }

  if (periodo === "mes") {
    const mesAtual = agora.getMonth();
    const ano = agora.getFullYear();

    return todos.filter((g) => {
      if (g.userId !== userId) return false;
      const d = new Date(g.data);
      return d.getMonth() === mesAtual && d.getFullYear() === ano;
    });
  }

  if (periodo === "ano") {
    const anoAtual = agora.getFullYear();

    return todos.filter((g) => {
      if (g.userId !== userId) return false;
      const d = new Date(g.data);
      return d.getFullYear() === anoAtual;
    });
  }

  return [];
}

// Agrupamento por categoria
function agruparPorCategoria(gastos) {
  const categorias = {};
  gastos.forEach((g) => {
    if (!categorias[g.categoria]) categorias[g.categoria] = 0;
    categorias[g.categoria] += g.valor;
  });

  const labels = Object.keys(categorias);
  const valores = labels.map((cat) => categorias[cat]);

  return { labels, valores };
}

// Gráfico de pizza
function gerarUrlGraficoPizza(labels, valores, titulo) {
  const config = {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: valores,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: titulo,
        },
        legend: {
          position: "right",
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?c=${encoded}`;
}

// Helpers CSV
function escapeCsv(valor) {
  if (valor === null || valor === undefined) return "";
  const str = String(valor).replace(/"/g, '""');
  if (/[",;\n]/.test(str)) {
    return `"${str}"`;
  }
  return str;
}

function gerarCsvGastos(gastos) {
  const linhas = [];
  linhas.push("id,data,categoria,valor,descricao");

  gastos.forEach((g) => {
    const dataIso = new Date(g.data).toISOString();
    const valorNumero = Number(g.valor) || 0;

    const linha = [
      escapeCsv(g.id ?? ""),
      escapeCsv(dataIso),
      escapeCsv(g.categoria),
      escapeCsv(valorNumero.toFixed(2)),
      escapeCsv(g.descricao || ""),
    ].join(",");
    linhas.push(linha);
  });

  return linhas.join("\n");
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const welcomeText = `
Olá, estou aqui pra lhe ajudar a organizar suas finanças e controlar seus gastos.

Use:
/gasto   para registrar um gasto,
/listar  para ver seus gastos com ID,
/del <id> para remover um gasto,
/edit <id> <campo> <novo valor> para editar,
/reset  para apagar todos os seus gastos,

/hoje    para ver o total de hoje,
/semana  para ver o resumo da semana,
/mes     para ver o resumo do mês,
/ano     para ver o resumo do ano,
/meta    para definir sua meta mensal,
/grafico <periodo> para ver um gráfico,
/exportar para baixar seus gastos em CSV.
/help    para ver todos os comandos.
`;

  bot.sendMessage(chatId, welcomeText);
});

// /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, helpMessage);
});

// /meta [valor]
bot.onText(/\/meta(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1];

  if (!args) {
    const metaAtual = obterMetaMensal(userId);
    if (!metaAtual) {
      bot.sendMessage(
        chatId,
        "Você ainda não definiu uma meta mensal.\nUse: /meta <valor>\nExemplo: /meta 500"
      );
    } else {
      bot.sendMessage(
        chatId,
        `Sua meta mensal atual é de R$${metaAtual.toFixed(2)}.`
      );
    }
    return;
  }

  const valorTexto = args.trim().replace(",", ".");
  const valor = parseFloat(valorTexto);

  if (isNaN(valor) || valor <= 0) {
    bot.sendMessage(
      chatId,
      "Valor de meta inválido. Use um número maior que 0.\nExemplo: /meta 750"
    );
    return;
  }

  definirMetaMensal(userId, valor);

  bot.sendMessage(
    chatId,
    `Meta mensal definida com sucesso: R$${valor.toFixed(2)}.`
  );
});

// /gasto <categoria> <valor> <descricao opcional>
bot.onText(/\/gasto(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1];

  if (!args) {
    bot.sendMessage(
      chatId,
      "Uso correto: /gasto <categoria> <valor> <descricao opcional>\nExemplo: /gasto lanche 15.90 hamburguer"
    );
    return;
  }

  const resultado = parseMensagemGasto(args);

  if (resultado.erro) {
    bot.sendMessage(chatId, resultado.erro);
    return;
  }

  const { categoria, valor, descricao } = resultado;

  const novoGasto = registrarGasto({
    userId,
    categoria,
    valor,
    descricao,
    data: new Date(),
  });

  let resposta = `Gasto registrado [ID ${novoGasto.id}]: R$${valor.toFixed(
    2
  )} em ${categoria}`;
  if (descricao) {
    resposta += ` (${descricao})`;
  }

  await bot.sendMessage(chatId, resposta);

  const metaMensal = obterMetaMensal(userId);
  if (metaMensal) {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    const gastosMes = listarPorData().filter((g) => {
      if (g.userId !== userId) return false;
      const d = new Date(g.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    const totalMes = gastosMes.reduce((acc, g) => acc + g.valor, 0);

    if (totalMes > metaMensal) {
      await bot.sendMessage(
        chatId,
        `⚠ Você ultrapassou sua meta mensal de R$${metaMensal.toFixed(
          2
        )}.\nTotal gasto neste mês: R$${totalMes.toFixed(2)}.`
      );
    }
  }
});

// /listar - últimos gastos com ID
bot.onText(/\/listar/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const gastos = listarPorUsuario(userId);

  if (gastos.length === 0) {
    bot.sendMessage(chatId, "Você ainda não tem gastos registrados.");
    return;
  }

  const ordenados = [...gastos].sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  );

  const recentes = ordenados.slice(0, 20);

  let texto = "🧾 Seus últimos gastos:\n\n";

  recentes.forEach((g) => {
    const d = new Date(g.data);
    const dataFmt = d.toLocaleDateString("pt-BR");
    texto += `[${g.id}] ${dataFmt} - ${g.categoria} - R$${g.valor.toFixed(
      2
    )}`;
    if (g.descricao) {
      texto += ` (${g.descricao})`;
    }
    texto += "\n";
  });

  texto +=
    "\nUse /del <id> para remover um gasto ou /edit <id> <campo> <novo valor>.";

  bot.sendMessage(chatId, texto);
});

// /del <id> - remover gasto
bot.onText(/\/del(?:\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const idStr = match[1];

  if (!idStr) {
    bot.sendMessage(
      chatId,
      "Uso correto: /del <id>\nExemplo: /del 12\nUse /listar para ver os IDs."
    );
    return;
  }

  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    bot.sendMessage(chatId, "ID inválido. Use um número. Ex: /del 5");
    return;
  }

  const ok = removerGasto(userId, id);

  if (!ok) {
    bot.sendMessage(
      chatId,
      `Não encontrei nenhum gasto seu com ID ${id}. Use /listar para conferir.`
    );
    return;
  }

  bot.sendMessage(chatId, `Gasto com ID ${id} removido com sucesso.`);
});

// /edit <id> <campo> <novo valor>
bot.onText(/\/edit(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1];

  if (!args) {
    bot.sendMessage(
      chatId,
      "Uso correto: /edit <id> <campo> <novo valor>\nCampos: valor, categoria, descricao\nExemplos:\n/edit 10 valor 150.90\n/edit 10 categoria mercado\n/edit 10 descricao compra corrigida"
    );
    return;
  }

  const partes = args.trim().split(/\s+/);

  if (partes.length < 3) {
    bot.sendMessage(
      chatId,
      "Formato incorreto. Use: /edit <id> <campo> <novo valor>"
    );
    return;
  }

  const id = parseInt(partes[0], 10);
  const campo = partes[1].toLowerCase();
  const novoValorBruto = partes.slice(2).join(" ");

  if (Number.isNaN(id)) {
    bot.sendMessage(chatId, "ID inválido. Exemplo: /edit 5 valor 120.50");
    return;
  }

  const updates = {};

  if (campo === "valor") {
    const num = parseFloat(novoValorBruto.replace(",", "."));
    if (isNaN(num) || num <= 0) {
      bot.sendMessage(
        chatId,
        "Valor inválido. Use número maior que zero. Ex: /edit 5 valor 99.90"
      );
      return;
    }
    updates.valor = num;
  } else if (campo === "categoria") {
    updates.categoria = novoValorBruto;
  } else if (campo === "descricao") {
    updates.descricao = novoValorBruto;
  } else {
    bot.sendMessage(
      chatId,
      "Campo inválido. Use: valor, categoria ou descricao.\nEx: /edit 3 descricao comprei errado"
    );
    return;
  }

  const atualizado = atualizarGasto(userId, id, updates);

  if (!atualizado) {
    bot.sendMessage(
      chatId,
      `Não encontrei nenhum gasto seu com ID ${id}. Use /listar para conferir.`
    );
    return;
  }

  bot.sendMessage(
    chatId,
    `Gasto ${id} atualizado:\nCategoria: ${atualizado.categoria}\nValor: R$${atualizado.valor.toFixed(
      2
    )}\nDescrição: ${atualizado.descricao || "(sem descrição)"}`
  );
});

// /reset - pede confirmação
bot.onText(/\/reset$/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "⚠ Isso vai apagar TODOS os seus gastos neste bot.\nSe tiver certeza, envie: /reset_confirmar"
  );
});

// /reset_confirmar - apaga tudo do usuário
bot.onText(/\/reset_confirmar/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const removidos = resetUsuario(userId);

  if (!removidos) {
    bot.sendMessage(chatId, "Você não tinha gastos para apagar.");
  } else {
    bot.sendMessage(
      chatId,
      `Pronto. Apaguei ${removidos} gastos seus. Começando do zero.`
    );
  }
});

// /hoje
bot.onText(/\/hoje/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const gastos = obterGastosPeriodo(userId, "hoje");

  if (gastos.length === 0) {
    bot.sendMessage(chatId, "Nenhum gasto registrado hoje.");
    return;
  }

  const total = gastos.reduce((acc, g) => acc + g.valor, 0);
  let resumo = `📅 Resumo de hoje:\nTotal: R$${total.toFixed(
    2
  )}\n\nDetalhes:\n`;

  gastos.forEach((g) => {
    resumo += `• [${g.id}] ${g.categoria} - R$${g.valor.toFixed(2)}${
      g.descricao ? " (" + g.descricao + ")" : ""
    }\n`;
  });

  bot.sendMessage(chatId, resumo);
});

// /semana
bot.onText(/\/semana/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const gastos = obterGastosPeriodo(userId, "semana");

  if (gastos.length === 0) {
    bot.sendMessage(chatId, "Nenhum gasto registrado nesta semana.");
    return;
  }

  const total = gastos.reduce((acc, g) => acc + g.valor, 0);

  const categorias = {};
  gastos.forEach((g) => {
    if (!categorias[g.categoria]) categorias[g.categoria] = 0;
    categorias[g.categoria] += g.valor;
  });

  let resumo = `📆 Resumo da semana:\nTotal: R$${total.toFixed(
    2
  )}\n\nPor categoria:\n`;

  Object.keys(categorias).forEach((cat) => {
    resumo += `• ${cat}: R$${categorias[cat].toFixed(2)}\n`;
  });

  bot.sendMessage(chatId, resumo);
});

// /mes
bot.onText(/\/mes/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const gastos = obterGastosPeriodo(userId, "mes");

  if (gastos.length === 0) {
    bot.sendMessage(chatId, "Nenhum gasto registrado este mês.");
    return;
  }

  const total = gastos.reduce((acc, g) => acc + g.valor, 0);

  const categorias = {};
  gastos.forEach((g) => {
    if (!categorias[g.categoria]) categorias[g.categoria] = 0;
    categorias[g.categoria] += g.valor;
  });

  let resumo = `📆 Resumo do mês:\nTotal: R$${total.toFixed(
    2
  )}\n\nPor categoria:\n`;

  Object.keys(categorias).forEach((cat) => {
    resumo += `• ${cat}: R$${categorias[cat].toFixed(2)}\n`;
  });

  bot.sendMessage(chatId, resumo);
});

// /ano
bot.onText(/\/ano/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const gastos = obterGastosPeriodo(userId, "ano");

  if (gastos.length === 0) {
    bot.sendMessage(chatId, "Nenhum gasto registrado neste ano.");
    return;
  }

  const total = gastos.reduce((acc, g) => acc + g.valor, 0);

  const categorias = {};
  gastos.forEach((g) => {
    if (!categorias[g.categoria]) categorias[g.categoria] = 0;
    categorias[g.categoria] += g.valor;
  });

  let resumo = `📆 Resumo do ano:\nTotal: R$${total.toFixed(
    2
  )}\n\nPor categoria:\n`;

  Object.keys(categorias).forEach((cat) => {
    resumo += `• ${cat}: R$${categorias[cat].toFixed(2)}\n`;
  });

  bot.sendMessage(chatId, resumo);
});

// /grafico <periodo>
bot.onText(/\/grafico(?:\s+(\w+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const arg = (match[1] || "").toLowerCase();

  if (!arg || !["hoje", "semana", "mes", "ano"].includes(arg)) {
    bot.sendMessage(
      chatId,
      "Uso correto: /grafico <periodo>\nPeríodos válidos: hoje, semana, mes, ano.\nExemplo: /grafico mes"
    );
    return;
  }

  const gastos = obterGastosPeriodo(userId, arg);

  if (gastos.length === 0) {
    bot.sendMessage(chatId, `Nenhum gasto registrado neste ${arg}.`);
    return;
  }

  const { labels, valores } = agruparPorCategoria(gastos);

  if (labels.length === 0) {
    bot.sendMessage(chatId, "Não há dados suficientes para gerar o gráfico.");
    return;
  }

  let titulo = "Gastos por categoria";
  if (arg === "hoje") titulo += " - Hoje";
  if (arg === "semana") titulo += " - Semana atual";
  if (arg === "mes") titulo += " - Mês atual";
  if (arg === "ano") titulo += " - Ano atual";

  const url = gerarUrlGraficoPizza(labels, valores, titulo);

  await bot.sendPhoto(chatId, url, {
    caption: `Gráfico de pizza (${arg}).`,
  });
});

// /exportar
bot.onText(/\/exportar/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const todos = listarPorUsuario(userId);

  if (todos.length === 0) {
    bot.sendMessage(
      chatId,
      "Você ainda não tem gastos registrados para exportar."
    );
    return;
  }

  const csv = gerarCsvGastos(todos);
  const buffer = Buffer.from(csv, "utf-8");

  await bot.sendDocument(chatId, buffer, {
    caption: "Aqui estão seus gastos em CSV.",
    filename: "gastos.csv",
    contentType: "text/csv",
  });
});
