const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete',
  'dezoito', 'dezenove',
];
const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa',
];
const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

function inteirosPorExtenso(n) {
  if (n === 0) return '';
  if (n < 20) return UNIDADES[n];

  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }

  if (n < 1000) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    // 100 exato é "cem"; 101–199 usam "cento"
    const centStr = n === 100 ? 'cem' : CENTENAS[c];
    return r === 0 ? centStr : `${centStr} e ${inteirosPorExtenso(r)}`;
  }

  if (n < 1_000_000) {
    const mil = Math.floor(n / 1000);
    const r   = n % 1000;
    const milStr = mil === 1 ? 'mil' : `${inteirosPorExtenso(mil)} mil`;
    if (r === 0) return milStr;
    // "e" quando o restante é < 100 ou múltiplo redondo de 100 (ex: 1200 = "mil e duzentos")
    const sep = r < 100 || r % 100 === 0 ? ' e ' : ' ';
    return `${milStr}${sep}${inteirosPorExtenso(r)}`;
  }

  if (n < 1_000_000_000) {
    const mi = Math.floor(n / 1_000_000);
    const r  = n % 1_000_000;
    const miStr = mi === 1 ? 'um milhão' : `${inteirosPorExtenso(mi)} milhões`;
    if (r === 0) return miStr;
    const sep = r < 100 || r % 100 === 0 ? ' e ' : ' ';
    return `${miStr}${sep}${inteirosPorExtenso(r)}`;
  }

  throw Object.assign(
    new Error(`Valor muito alto para conversão por extenso: ${n}`),
    { code: 'VALIDATION' }
  );
}

/**
 * Converte um valor monetário numérico (BRL) para texto por extenso em pt-BR.
 *
 * valorPorExtenso(0)          → "zero reais"
 * valorPorExtenso(1)          → "um real"
 * valorPorExtenso(25.50)      → "vinte e cinco reais e cinquenta centavos"
 * valorPorExtenso(1000000.99) → "um milhão de reais e noventa e nove centavos"
 *
 * Lança erro com code="VALIDATION" se o valor for negativo, NaN ou Infinity.
 */
function valorPorExtenso(valor) {
  if (typeof valor !== 'number' || isNaN(valor) || !isFinite(valor) || valor < 0) {
    throw Object.assign(
      new Error(`Valor inválido para conversão por extenso: ${valor}`),
      { code: 'VALIDATION' }
    );
  }

  const rounded   = Math.round(valor * 100);
  const reais     = Math.floor(rounded / 100);
  const centavos  = rounded % 100;

  if (reais === 0 && centavos === 0) return 'zero reais';

  const parts = [];

  if (reais > 0) {
    const inteiroStr = inteirosPorExtenso(reais);
    const moeda      = reais === 1 ? 'real' : 'reais';
    // Milhão(ões) exato(s) exigem "de" antes da moeda em pt-BR formal
    const lastWord   = inteiroStr.split(' ').pop();
    const conector   = (lastWord === 'milhão' || lastWord === 'milhões') ? ' de ' : ' ';
    parts.push(`${inteiroStr}${conector}${moeda}`);
  }

  if (centavos > 0) {
    const centStr = inteirosPorExtenso(centavos);
    const moeda   = centavos === 1 ? 'centavo' : 'centavos';
    parts.push(`${centStr} ${moeda}`);
  }

  return parts.join(' e ');
}

module.exports = { valorPorExtenso };
