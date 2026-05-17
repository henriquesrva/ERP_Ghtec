function numeroPorExtensoBasico(valor) {
  const mapa = {
    0: "zero",
    1: "um",
    2: "dois",
    3: "três",
    4: "quatro",
    5: "cinco",
    6: "seis",
    7: "sete",
    8: "oito",
    9: "nove",
    10: "dez"
  };

  if (Number.isInteger(valor) && mapa[valor] !== undefined) {
    return `${mapa[valor]} reais`;
  }

  return "valor por extenso";
}

module.exports = { numeroPorExtensoBasico };