# Sistema de Controle de Presos - AI Agent Guide

## Project Overview
Full-stack prison management system for tracking prisoners, legal processes, hearings, and automated deadline alerts. Built in Portuguese (PT-BR) with manual data entry, future PJe integration planned.

**Stack:** FastAPI (Python 3.10+) + React (Vite) + PostgreSQL/SQLite + Material-UI v7

## Architecture & Data Flow

### Backend (`backend/app/`)
- **FastAPI** app with JWT authentication (OAuth2 Bearer tokens via `python-jose`)
- **Database:** PostgreSQL (prod via Supabase) or SQLite (dev), configured via `DATABASE_URL` env var in `.env`
- **Models hierarchy:** `User` → `Preso` → `Processo` → `Evento` (cascading deletes, `joinedload` for eager loading)
- **Timezone handling:** Hybrid approach in [models.py](backend/app/models.py) - uses `DateTime(timezone=True)` for PostgreSQL, plain `DateTime` for SQLite
- **Auth flow:** `/api/token` endpoint accepts CPF as username, returns JWT. Protected routes use `get_current_user` dependency. Admin routes require `get_current_admin_user` dependency
- **CRUD pattern:** [crud.py](backend/app/crud.py) contains all database operations, uses `joinedload()` for efficient relationship loading (see `get_preso()`)
- **Schemas:** Pydantic models in [schemas.py](backend/app/schemas.py) follow naming: `*Base` → `*Create` → `*` (response) → `*Detalhe` (with relationships)

### Frontend (`frontend/src/`)
- **React Router v7** with `createBrowserRouter`, protected routes via `<RotaProtegida>` wrapper checking `AuthContext.token`
- **Context architecture:** `AuthContext` manages user/token state + API calls; `TemaContext` handles light/dark theme (persists to backend + localStorage)
- **API integration:** Axios with `axios.defaults.headers.common['Authorization']` set globally on login. API base URL from `VITE_API_URL` env var or defaults to `http://127.0.0.1:8000`
- **Pages in `paginas/`:** Follow `Pagina*.jsx` naming (e.g., `PaginaDashboard.jsx`, `PaginaCadastro.jsx`)
- **Components in `src/componentes/`:** Reusable UI like `Layout.jsx` (app shell with navigation)
- **Utils in `src/util/`:** Validation/formatting helpers (e.g., `cpfValidator.js`, `formatarData.js`)

## Key Patterns & Conventions

### Backend
1. **Environment-aware database:** Check `engine.dialect.name` in [models.py](backend/app/models.py) to handle SQLite vs PostgreSQL differences
2. **Password security:** Use `passlib` with bcrypt ([security.py](backend/app/security.py)). Secret key via `SECRET_KEY` env var, defaults to dev key with console warning
3. **Token expiry:** 8 hours (`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8` in [security.py](backend/app/security.py))
4. **CORS:** Hardcoded origins in [main.py](backend/app/main.py) - includes Railway prod frontend and `localhost:5173`
5. **Complete registration:** `/api/cadastro-completo` endpoint creates Preso + multiple Processos in one transaction (see [crud.py](backend/app/crud.py) `create_preso_completo()`)
6. **Search with filters:** `search_presos()` uses `.join()` + `.filter()` chaining, case-insensitive search with `func.lower()` and `.ilike()`

### Frontend
1. **Authentication flow:** 
   - Login saves token → `AuthContext.login()` → Sets `axios.defaults.headers` → Auto-fetches user from `/api/users/me`
   - Logout clears localStorage + `axios.defaults.headers` → Forces `window.location.href = '/login'` (full reload)
2. **Role-based routing:** `<RotaAdmin>` checks `usuario.role === 'admin'`, redirects to dashboard if not admin
3. **Theme persistence:** `ProvedorTema` reads from localStorage on mount, syncs to backend via `PUT /api/users/me` on toggle
4. **Loading states:** `AuthContext.isLoading` prevents routing until user fetched. App.jsx shows `CircularProgress` during load
5. **Page structure:** MUI `Container` → `Paper` cards → `Grid` layouts. Consistent use of `Box` for spacing

## Development Workflows

### Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Create .env with DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload  # Runs on :8000
```
**First admin:** Run `python create_first_admin.py` to seed admin user

### Frontend Setup
```bash
cd frontend
npm install
npm run dev  # Runs on :5173
```

### Database Switching
- **SQLite (default):** `DATABASE_URL="sqlite:///./local.db"` in `backend/.env`
- **PostgreSQL:** `DATABASE_URL="postgresql://user:pass@host:port/db"` (Supabase format)
- Tables auto-create via `models.Base.metadata.create_all(bind=engine)` in [main.py](backend/app/main.py)

### Docker Build
- Backend uses `python:3.11-slim` base
- Installs `libpq-dev` and `build-essential` for PostgreSQL support
- Listens on `$PORT` env var (Railway compatibility)

## Critical Integration Points

1. **API URL:** Frontend reads `import.meta.env.VITE_API_URL`. Must match backend host
2. **CORS origins:** Update [main.py](backend/app/main.py) `origins` list when deploying to new domains
3. **JWT secret:** Change `SECRET_KEY` env var in production (never commit to repo)
4. **APScheduler:** Background scheduler for alerts (imported but not fully implemented - see TODO)
5. **Date handling:** Frontend uses `date-fns` for formatting. Backend returns ISO strings. Always use `datetime.datetime` with timezone awareness for PostgreSQL

## Common Pitfalls

- **Token refresh:** No auto-refresh implemented. Tokens expire after 8h (hard logout)
- **SQLite transactions:** Use `connect_args={"check_same_thread": False}` (already in [database.py](backend/app/database.py))
- **Cascading deletes:** Deleting `Preso` auto-deletes `Processo` → `Evento` (set in relationships)
- **CPF validation:** Frontend has `cpfValidator.js` but backend doesn't enforce format
- **Admin creation:** No self-registration UI. Use `create_first_admin.py` or direct DB insert

## API Endpoint Patterns

- **Auth:** `POST /api/token` (login), `POST /api/users/` (admin only)
- **User profile:** `GET /api/users/me`, `PUT /api/users/me` (update), `PUT /api/users/me/password` (change password)
- **Presos:** `POST /api/cadastro-completo` (create with processes), `GET /api/presos/` (search), `GET /api/presos/{id}` (detail)
- **Processos:** CRUD under `/api/processos/`
- **Eventos:** CRUD under `/api/eventos/`, `GET /api/eventos/alertas` (pending alerts)
- All protected endpoints require `Authorization: Bearer {token}` header

## Portuguese Language Notes
- UI text, error messages, and database content are in PT-BR
- Variable names mix Portuguese (`preso`, `processo`, `usuario`) and English (`user`, `token`)
- Comments in code are mostly Portuguese
- Keep consistency when adding features: follow existing Portuguese naming for models/fields
