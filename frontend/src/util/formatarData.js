export const formatarData = (dataISO, incluirHoras = false) => {
  if (!dataISO) return 'N/A';
  
  try {
    const data = new Date(dataISO);
    
    // Define as opções base de formatação
    const opcoes = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };

    // Adiciona horas e minutos se 'incluirHoras' for verdadeiro
    if (incluirHoras) {
      opcoes.hour = '2-digit';
      opcoes.minute = '2-digit';
    }
    
    return data.toLocaleString('pt-BR', opcoes);
  } catch (e) {
    // Se falhar, tenta formatar manualmente (para o caso de ser só 'YYYY-MM-DD')
    try {
      const [ano, mes, dia] = dataISO.split('T')[0].split('-');
      return `${dia}/${mes}/${ano}`;
    } catch (e2) {
      return dataISO; // Retorna o original se tudo falhar
    }
  }
};