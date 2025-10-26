# Sistema de Controle de Presos Integrado

## Descrição

Sistema web para acompanhamento de presos, status processual e alertas automáticos sobre prazos e audiências. Inicialmente focado em cadastro manual, com planos futuros de integração com o PJe (Processo Judicial Eletrônico).

## Tecnologias Utilizadas

* **Backend:** Python 3, FastAPI, SQLAlchemy, PostgreSQL (via Supabase), APScheduler (para alertas).
* **Frontend:** React (com Vite), Material-UI (MUI), Axios, React Router.
* **Banco de Dados:** PostgreSQL (produção via Supabase), SQLite (desenvolvimento local).
* **Autenticação:** JWT (Tokens).

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
    * Para usar **SQLite** (padrão local), adicione a linha:
      ```
      DATABASE_URL="sqlite:///./local.db"
      ```
    * Para usar **PostgreSQL/Supabase**, adicione a URL de conexão fornecida:
      ```
      DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/NOME_BANCO"
      ```
5.  **Configure a Chave Secreta JWT:**
    * Edite o arquivo `backend/app/security.py`.
    * Substitua `"SUA_CHAVE_SECRETA_MUITO_FORTE_AQUI"` por uma chave secreta segura. (Para deploy, use variáveis de ambiente).
6.  **Rode o servidor:**
    ```bash
    uvicorn app.main:app --reload
    ```
    O backend estará rodando em `http://127.0.0.1:8000`. A documentação da API estará em `http://127.0.0.1:8000/docs`.

### Frontend

1.  **Navegue até a pasta do frontend:**
    ```bash
    cd ../frontend
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **Rode o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```
    O frontend estará rodando em `http://localhost:5173` (ou outra porta indicada no terminal).

## Deploy

* **Backend:** Pode ser hospedado em serviços como Heroku, Render, Fly.io, ou servidores VPS. Lembre-se de configurar as variáveis de ambiente `DATABASE_URL` e `SECRET_KEY`.
* **Frontend:** Rode `npm run build` para gerar a pasta `dist/`. O conteúdo desta pasta pode ser hospedado em serviços de hospedagem estática como Vercel, Netlify, GitHub Pages, ou junto com o backend.

## Contribuição

(Instruções sobre como contribuir, se aplicável).

## Licença

(Tipo de licença, ex: MIT).