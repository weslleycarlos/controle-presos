// O FastAPI retorna `detail` como string em HTTPException, mas como lista de
// objetos {type, loc, msg, input, ctx} em erros de validação (422). Renderizar
// esse valor diretamente como filho do React quebra a aplicação (erro #31).
export function extractErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((item) => item?.msg).filter(Boolean);
    return msgs.length > 0 ? msgs.join('; ') : fallback;
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return fallback;
}
