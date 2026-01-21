# Sistema de Controle de Presos Integrado

## Descrição

Sistema web para acompanhamento de presos, status processual e alertas automáticos sobre prazos e audiências. Inicialmente focado em cadastro manual, com planos futuros de integração com o PJe (Processo Judicial Eletrônico).

## Tecnologias Utilizadas

* **Backend:** Python 3.10+, FastAPI, SQLAlchemy, PostgreSQL (via Supabase), SQLite (dev), APScheduler (para alertas)
* **Frontend:** React 19, Vite, Material-UI v7, Axios, React Router v7
* **Banco de Dados:** PostgreSQL (produção via Supabase), SQLite (desenvolvimento local)
* **Autenticação:** JWT (Tokens) com OAuth2 Bearer, bcrypt para senhas

## Arquitetura

### Backend
- API RESTful com FastAPI
- Autenticação JWT com controle de acesso baseado em roles (admin/user)
- Suporte híbrido para PostgreSQL (produção) e SQLite (desenvolvimento)
- Relacionamentos em cascata: User → Preso → Processo → Evento
- Background scheduler para alertas automáticos

### Frontend
- Aplicação SPA com React Router v7
- Context API para gerenciamento de estado (Auth + Tema)
- Tema claro/escuro persistido no backend
- Componentes Material-UI responsivos

**Para desenvolvedores AI/LLM:** Consulte [.github/copilot-instructions.md](.github/copilot-instructions.md) para guia completo de desenvolvimento.

## Configuração do Ambiente Local

### Pré-requisitos

* Node.js (versão LTS recomendada) e npm
* Python 3.10+ e pip
* PostgreSQL (opcional, se não for usar Supabase/SQLite local) ou Docker

### Backend

1.  **Clone o repositório:**
    ```bash
    git clone [URL_DO_SEU_REPOSITORIO]
    cd sistema-presos/backend
    ```
2.  **Crie e ative um ambiente virtual:**
    ```bash
    python -m venv venv
    # Windows
    .\venv\Scripts\activate
    # macOS/Linux
    source venv/bin/activate
    ```
3.  **Instale as dependências:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure o Banco de Dados:**
    * Crie um arquivo `.env` na pasta `backend/`.
    * Para usar **SQLite** (padrão local), adicione:
      ```env
      DATABASE_URL="sqlite:///./local.db"
      SECRET_KEY="sua-chave-secreta-aqui-minimo-32-caracteres"
      ```
    * Para usar **PostgreSQL/Supabase**, use:
      ```env
      DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/NOME_BANCO"
      SECRET_KEY="sua-chave-secreta-aqui-minimo-32-caracteres"
      ```
    * ⚠️ **IMPORTANTE:** Nunca commite o arquivo `.env` no Git!

5.  **Crie o primeiro usuário admin:**
    ```bash
    python create_first_admin.py
    ```
    Siga as instruções para definir CPF e senha do administrador.

6.  **Rode o servidor:**
    ```bash
    uvicorn app.main:app --reload
    ```
    O backend estará rodando em `http://127.0.0.1:8000`.
    
    Documentação interativa da API: `http://127.0.0.1:8000/docs`

### Frontend

1.  **Navegue até a pasta do frontend:**
    ```bash
    cd ../frontend
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **(Opcional) Configure a URL da API:**
    * Crie um arquivo `.env.local` na pasta `frontend/`:
      ```env
      VITE_API_URL=http://127.0.0.1:8000
      ```
    * Se não configurar, o padrão será `http://127.0.0.1:8000`

4.  **Rode o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```
    O frontend estará rodando em `http://localhost:5173` (ou outra porta indicada no terminal).

## Deploy

* **Backend:** Pode ser hospedado em serviços como Railway, Render, Fly.io, ou servidores VPS. 
  - Configure as variáveis de ambiente: `DATABASE_URL`, `SECRET_KEY`, `PORT`
  - O backend usa a variável `$PORT` para Railway/Render
* **Frontend:** 
  - Rode `npm run build` para gerar a pasta `dist/`
  - Hospede em Vercel, Netlify, GitHub Pages, ou servindo junto com o backend
  - Configure a variável `VITE_API_URL` para apontar para o backend em produção

## Endpoints Principais da API

### Autenticação
- `POST /api/token` - Login (retorna JWT)
- `POST /api/users/` - Criar usuário (apenas admin)
- `GET /api/users/me` - Dados do usuário logado
- `PUT /api/users/me` - Atualizar perfil
- `PUT /api/users/me/password` - Alterar senha

### Presos e Processos
- `POST /api/cadastro-completo` - Cadastro completo (preso + processos)
- `GET /api/presos/search/` - Buscar presos (com filtros)
- `GET /api/presos/{id}` - Detalhes do preso
- `PUT /api/presos/{id}` - Atualizar preso
- `DELETE /api/presos/{id}` - Deletar preso

### Eventos e Alertas
- `POST /api/processos/{id}/eventos/` - Criar evento
- `GET /api/alertas/ativos` - Listar alertas ativos
- `PATCH /api/eventos/{id}/status` - Atualizar status do evento

Todos os endpoints (exceto `/api/token`) requerem autenticação via `Authorization: Bearer {token}`.

Documentação completa: `http://localhost:8000/docs`

## Correções e Melhorias

Veja [CORRECOES.md](CORRECOES.md) para o histórico completo de correções aplicadas ao projeto.

### Últimas Atualizações (21/01/2026)
- ✅ Padronizado uso do Pydantic v2 (`.model_dump()`)
- ✅ Removidos imports duplicados no backend
- ✅ Corrigidos imports faltantes no frontend
- ✅ Endpoint de senha alterado para `PUT /api/users/me/password`
- ✅ Adicionada autenticação em endpoints críticos

## Contribuição

(Instruções sobre como contribuir, se aplicável).

## Licença

(Tipo de licença, ex: MIT).