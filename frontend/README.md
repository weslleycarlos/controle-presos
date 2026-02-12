# Frontend - Sistema de Controle de Presos

Frontend SPA em React + Vite para gestão de presos, processos e alertas.

## Requisitos

- Node.js 20.19+ (ou 22.12+)
- npm 10+

## Ambiente

Copie o arquivo de exemplo:

```bash
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # Linux/macOS
```

Variável suportada:

- `VITE_API_URL`: URL base do backend FastAPI
- Importante: mantenha o mesmo host no frontend e backend (`localhost` com `localhost` ou `127.0.0.1` com `127.0.0.1`) para a sessão por cookie funcionar sem `401`.

## Execução

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Observações de autenticação

- A sessão é baseada em cookie HttpOnly definido pelo backend.
- O cliente HTTP usa `withCredentials: true`.
- Requisições mutáveis enviam automaticamente `X-CSRF-Token` via interceptor.
