# Sistema de Controle de Presos

Sistema web para acompanhamento de pessoas presas, processos, eventos e alertas processuais, com autenticação por sessão/cookie e base para integração externa com PJe/DataJud.

## Stack

- Backend: FastAPI, SQLAlchemy, APScheduler, PostgreSQL/SQLite
- Frontend: React (Vite), Material UI v7, React Router v7, Axios
- Segurança: JWT assinado, cookie HttpOnly + proteção CSRF

Para instruções específicas de desenvolvimento assistido por IA, veja [.github/copilot-instructions.md](.github/copilot-instructions.md).

## Estrutura

- Backend: [backend](backend)
- Frontend: [frontend](frontend)
- Roteiro de evolução/correções: [CORRECOES.md](CORRECOES.md)

## Configuração Local

### Pré-requisitos

- Python 3.10+
- Node.js 20.19+ (ou 22.12+)
- npm 10+

### 1) Backend

```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate
pip install -r requirements.txt
```

Copie o arquivo de exemplo de ambiente:

```bash
# no diretório backend
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
```

Variáveis principais do backend:

- `APP_ENV`: `development` ou `production`
- `DATABASE_URL`: conexão do banco
- `SECRET_KEY`: chave JWT (mínimo recomendado: 32 caracteres)
- `CORS_ALLOWED_ORIGINS`: origens extras permitidas no CORS, separadas por vírgula
- `DATAJUD_API_URL` / `DATAJUD_API_TOKEN`: integração DataJud (opcional)
- `PJE_API_URL` / `PJE_API_TOKEN`: integração PJe (opcional)
- `CPF_API_URL` / `CPF_API_TOKEN`: integração para consulta de dados pessoais por CPF (opcional)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` / `SMTP_USE_TLS`: envio de alertas por e-mail (opcional)
- `AUTO_BOOTSTRAP_ADMIN`: se `true`, cria/promove o primeiro admin no startup usando `FIRST_ADMIN_*` (somente se ainda não existir admin)

Crie o primeiro admin:

```bash
python create_first_admin.py
```

Em deploy (ex.: Vercel), você pode evitar execução manual ativando `AUTO_BOOTSTRAP_ADMIN=true` e preenchendo `FIRST_ADMIN_*`. Após a criação inicial, recomenda-se desativar (`false`) e remover `FIRST_ADMIN_SENHA` das variáveis de ambiente.

Suba o backend:

```bash
uvicorn app.main:app --reload
```

Documentação da API: `http://127.0.0.1:8000/docs`

### 2) Frontend

```bash
cd frontend
npm install
```

Copie o arquivo de exemplo de ambiente:

```bash
# no diretório frontend
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # Linux/macOS
```

Variável principal do frontend:

- `VITE_API_URL`: URL base do backend (padrão local: `http://127.0.0.1:8000`)

Suba o frontend:

```bash
npm run dev
```

## Autenticação e Segurança

- Login em `POST /api/token` cria cookie HttpOnly de sessão.
- Frontend usa `withCredentials: true` e header CSRF (`X-CSRF-Token`) automaticamente.
- Em produção, `SECRET_KEY` fraca/ausente bloqueia inicialização do backend.

## Integração PJe/DataJud (status atual)

Endpoint MVP disponível:

- `POST /api/integracoes/processos/consultar`
- `POST /api/integracoes/cpf/consultar`

Entrada:

```json
{
  "numero_processo": "00000000000000000000",
  "tribunal": "TJXX",
  "fontes": ["datajud", "pje"]
}
```

Observação: para funcionar de fato, configure URLs/tokens das integrações no `.env` do backend.

## Endpoints principais

### Autenticação e usuário

- `POST /api/token`
- `POST /api/logout`
- `GET /api/csrf-token`
- `GET /api/users/me`
- `PUT /api/users/me`
- `PUT /api/users/me/password`
- `GET /api/users/me/notificacoes`
- `PUT /api/users/me/notificacoes`

### Presos e processos

- `POST /api/cadastro-completo`
- `POST /api/presos/`
- `GET /api/presos/search/`
- `GET /api/presos/{id}`
- `PUT /api/presos/{id}`
- `DELETE /api/presos/{id}`

### Eventos e alertas

- `POST /api/processos/{id}/eventos/`
- `GET /api/alertas/ativos`
- `GET /api/alertas/proximos`
- `PATCH /api/eventos/{id}/status`

### Integrações

- `POST /api/integracoes/processos/consultar`
- `POST /api/integracoes/cpf/consultar`

### Jobs

- `POST /api/jobs/check-alertas` (protegido por `CRON_SECRET`)

## Deploy (resumo)

- Backend: configurar `APP_ENV=production`, `DATABASE_URL`, `SECRET_KEY` e variáveis de integração (se usadas).
- Frontend: configurar `VITE_API_URL` com a URL pública do backend.

### Deploy backend na Vercel

- Configure o projeto com Root Directory em `backend`.
- O projeto já inclui `backend/vercel.json` e entrypoint serverless em `backend/api/index.py`.
- Em ambiente Vercel, o scheduler (`APScheduler`) é desativado automaticamente; use um serviço externo de cron/webhook para disparar rotinas periódicas.
- Configure `CRON_SECRET` no ambiente.
- Para cron com header: use `POST /api/jobs/check-alertas` com `Authorization: Bearer <CRON_SECRET>` (ou `X-Cron-Secret`).
- Para Vercel Cron sem header customizado: use `/api/jobs/check-alertas?secret=<CRON_SECRET>`.
- No `backend/vercel.json`, substitua `ALTERE_PARA_UM_SECRETO_FORTE` pelo mesmo valor definido em `CRON_SECRET` antes do deploy.

## Próximos passos

Consulte o roadmap técnico em [CORRECOES.md](CORRECOES.md).