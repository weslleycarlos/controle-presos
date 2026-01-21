# 🔧 Registro de Correções - Sistema de Controle de Presos

**Data de Criação:** 21/01/2026

## Status das Correções

### 🔴 BUGS CRÍTICOS (Prioridade ALTA)

- [x] **#1** - Inconsistência Pydantic v1 vs v2 em crud.py
  - **Status:** ✅ CORRIGIDO
  - **Arquivo:** `backend/app/crud.py` (linhas 93, 102)
  - **Mudança:** `.dict()` → `.model_dump()`
  - **Data:** 21/01/2026

- [x] **#2** - Imports duplicados em main.py
  - **Status:** ✅ CORRIGIDO
  - **Arquivo:** `backend/app/main.py` (linhas 11-13)
  - **Mudança:** Removidos imports duplicados
  - **Data:** 21/01/2026

- [x] **#3** - Falta import Box e CircularProgress em App.jsx
  - **Status:** ✅ CORRIGIDO
  - **Arquivo:** `frontend/src/App.jsx`
  - **Mudança:** Adicionados imports MUI faltantes
  - **Data:** 21/01/2026

### 🟠 VIOLAÇÕES DE CONVENÇÕES (Prioridade MÉDIA)

- [x] **#4** - Endpoint com path errado em main.py
  - **Status:** ✅ CORRIGIDO
  - **Arquivo:** `backend/app/main.py` (linha 327)
  - **Mudança:** `POST /api/users/me/change-password` → `PUT /api/users/me/password`
  - **Data:** 21/01/2026

- [x] **#5** - Falta proteção em endpoint GET /api/presos/{preso_id}
  - **Status:** ✅ CORRIGIDO
  - **Arquivo:** `backend/app/main.py` (linha 166)
  - **Mudança:** Adicionado `current_user: models.User = Depends(get_current_user)`
  - **Data:** 21/01/2026

- [x] **#6** - Falta proteção em endpoint POST /api/presos/{preso_id}/processos/
  - **Status:** ✅ CORRIGIDO
  - **Arquivo:** `backend/app/main.py` (linha 176)
  - **Mudança:** Adicionado `current_user: models.User = Depends(get_current_user)`
  - **Data:** 21/01/2026

### 🟡 MÁS PRÁTICAS (Prioridade BAIXA)

- [ ] **#7** - Senha hardcoded em create_first_admin.py
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/create_first_admin.py` (linha 48)
  - **Mudança:** Usar variáveis de ambiente ou input()

- [ ] **#8** - API_URL repetido em múltiplos arquivos frontend
  - **Status:** ⏳ PENDENTE
  - **Arquivos:** `PaginaLogin.jsx`, `PaginaDashboard.jsx`, `Layout.jsx`
  - **Mudança:** Criar `src/config.js` centralizado

- [ ] **#9** - Falta proteção em endpoint GET /api/alertas/proximos
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/app/main.py` (linha 211)
  - **Mudança:** Adicionar `current_user: models.User = Depends(get_current_user)`

- [ ] **#10** - Schema naming inconsistente (EventoAlerta)
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/app/schemas.py`
  - **Mudança:** Seguir padrão `*Detalhe` para schemas com relacionamentos

- [ ] **#11** - Tratamento de timezone inconsistente
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/app/main.py` (linha 211)
  - **Mudança:** `datetime.now()` → `datetime.now(timezone.utc)`

### 🔵 MELHORIAS (Prioridade INFO)

- [ ] **#12** - Missing error handling em AuthContext.jsx
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `frontend/src/AuthContext.jsx` (linha 28)
  - **Mudança:** Adicionar validação/defaults para dados do usuário

- [ ] **#13** - Scheduler sem tratamento de falha
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/app/main.py` (linha 249)
  - **Mudança:** Adicionar try/except e logging

- [ ] **#14** - Falta índice em coluna data_prisao
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/app/models.py` (linha 60)
  - **Mudança:** Adicionar `index=True` para otimizar buscas

- [ ] **#15** - Falta documentação de enums
  - **Status:** ⏳ PENDENTE
  - **Arquivo:** `backend/app/models.py` (linhas 28-37)
  - **Mudança:** Adicionar comentários explicativos em PT-BR

---

## 📊 Estatísticas

- **Total de Issues:** 15
- **Corrigidos:** 6 (40%)
- **Pendentes:** 9 (60%)
- **Última Atualização:** 21/01/2026

## 🎯 Próximos Passos Recomendados

1. ✅ ~~Corrigir bugs críticos (#1-3)~~ - **CONCLUÍDO**
2. ✅ ~~Corrigir violações de convenções (#4-6)~~ - **CONCLUÍDO**
3. Refatorar más práticas (#7-11) no próximo sprint
4. Implementar melhorias (#12-15) no backlog

## ⚠️ IMPORTANTE - BREAKING CHANGES

As seguintes mudanças podem impactar o frontend:

### Endpoint de mudança de senha alterado
- **Antes:** `POST /api/users/me/change-password`
- **Agora:** `PUT /api/users/me/password`

**Ação necessária:** Atualizar chamadas da API no frontend (verificar `PaginaPerfil.jsx` ou similar)
