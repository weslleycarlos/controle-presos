// Função padrão de validação de CPF (Algoritmo Mod 11)
export function validarCPF(cpf) {
  if (typeof cpf !== 'string') return false;
  cpf = cpf.replace(/[^\d]+/g, ''); // Remove caracteres não numéricos
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false; // Verifica tamanho e se todos são iguais

  cpf = cpf.split('').map(el => +el);

  const rest = (count) => (cpf.slice(0, count).reduce((soma, el, index) => soma + el * (count + 1 - index), 0) * 10) % 11 % 10;

  return rest(9) === cpf[9] && rest(10) === cpf[10];
}