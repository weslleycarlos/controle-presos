# 🔧 Correções e Evolução — Sistema de Controle de Presos

**Última atualização:** 13/02/2026  
**Status:** base estabilizada para produção inicial (Vercel + Neon), com backlog priorizado para robustez e governança.

---

## 1) Resumo executivo

### ✅ O que já foi implementado

#### Segurança e autenticação
- `SECRET_KEY` obrigatória em produção e validação de força.
- Role padrão de usuário ajustada para `user`.
- Endpoints sensíveis protegidos com autenticação/autorização.
- CSRF com double-submit cookie + header `X-CSRF-Token`.
- Cookie de sessão ajustado para produção cross-domain (`SameSite=None`, `Secure`).
- Fallback de autenticação por `Bearer` no frontend para cenários com bloqueio de cookie cross-site.
- Fallback bearer agora usa `sessionStorage` (em vez de `localStorage`).
- Expiração de token reduzida para 2h.

#### Usuários/admin
- Script `create_first_admin.py` sem credenciais hardcoded e com validações.
- Bootstrap automático opcional de primeiro admin em startup (`AUTO_BOOTSTRAP_ADMIN=true` + `FIRST_ADMIN_*`), idempotente.

#### Alertas
- Atualização de alertas agora ocorre também no fluxo online (não depende só do job diário).
- Envio opcional de alertas por e-mail com preferência por usuário e SMTP configurável.
- Endpoint de job para execução por cron HTTP: `POST /api/jobs/check-alertas`.

#### Integrações
- Consulta por processo (PJe/DataJud) implementada: `POST /api/integracoes/processos/consultar`.
- Consulta por CPF implementada: `POST /api/integracoes/cpf/consultar`.
- Pré-preenchimento automático no cadastro (CPF/processo).

#### Frontend/UX
- Centralização de cliente HTTP (`api.js`) e interceptors.
- Paginação server-side em telas administrativas/alertas.
- Acessibilidade básica (aria-labels) e refactors de componentes.
- Exportação de relatório CSV na tela de detalhes.

#### Deploy/operação
- Backend preparado para Vercel (`backend/vercel.json`, `backend/api/index.py`).
- Frontend preparado para SPA routing na Vercel (`frontend/vercel.json` rewrite).
- CORS com suporte a múltiplas origens via env (`CORS_ALLOWED_ORIGINS`).
- Redirect da raiz do backend `/` para `/docs`.
- `.env.example` e READMEs atualizados com variáveis reais do projeto.

---

## 2) Pendências prioritárias (próximos passos)

## 🔴 Alta prioridade (curto prazo)

- [ ] **A1 — Testes automatizados mínimos (backend + frontend)**
  - Cobrir login, `/api/users/me`, cadastro completo, eventos/alertas e permissões.

- [ ] **A2 — Migrações Alembic formais**
  - Reduzir dependência de `create_all` no startup e padronizar evolução de schema.

- [ ] **A3 — Endurecimento do fallback bearer**
  - Opcionalmente condicionar fallback apenas em produção e monitorar uso.
  - Avaliar estratégia de refresh/renovação de sessão.

- [ ] **A4 — Segredos operacionais**
  - Rotação de `SECRET_KEY`, `CRON_SECRET`, `FIRST_ADMIN_SENHA` (quando usado).
  - Remover `FIRST_ADMIN_SENHA` após bootstrap inicial.

## 🟠 Média prioridade

- [ ] **M1 — Scheduler e jobs com governança completa**
  - Padronizar execução via cron HTTP em produção com monitoramento/alertas.

- [ ] **M2 — Observabilidade estruturada**
  - Logging estruturado (request-id, user-id, endpoint, status, duração).

- [ ] **M3 — Auditoria funcional**
  - Trilhas para mudanças críticas (status de evento, reset de senha, exclusões).

- [ ] **M4 — Limpeza de dependências e revisão de pacote**
  - Remover libs não utilizadas no backend e travar versões essenciais.

- [ ] **M5 — Índices e tuning de consultas**
  - Revisar índices por filtros mais frequentes (`status_processual`, `data_prisao`, `data_evento`).

## 🟡 Baixa prioridade / evolução

- [ ] **B1 — RBAC explícito por endpoint** (matriz formal de permissões).
- [ ] **B2 — Integração externa avançada** (sync incremental, diff, histórico).
- [ ] **B3 — Melhorias de UX contínuas** (feedbacks, consistência visual, acessibilidade avançada).
- [ ] **B4 — Runbook operacional** (incidentes, restauração, falhas de integração).

---

## 3) Riscos e decisões atuais

- **Risco controlado:** fallback bearer em browser melhora disponibilidade, mas amplia superfície se houver XSS.
  - **Mitigação já aplicada:** `sessionStorage`, token curto (2h), CSRF e headers de segurança.
  - **Mitigação futura recomendada:** reforço de CSP no frontend e testes de segurança.

- **Deploy Vercel:** scheduler em memória foi desativado em produção serverless.
  - **Decisão:** executar rotina via endpoint de job + cron HTTP.

---

## 4) Melhorias futuras recomendadas

1. **CSP mais restritiva no frontend**
   - Definir política de script/style/font/connect para reduzir risco XSS.

2. **Refresh token/renovação de sessão**
   - Evitar relogin frequente mantendo segurança.

3. **Feature flags de integração (PJe/DataJud/CPF)**
   - Ligar/desligar por ambiente sem redeploy.

4. **Painel operacional interno**
   - Saúde de integrações, status de job, falhas e métricas.

5. **Cobertura de testes e CI obrigatória**
   - Bloquear merge/deploy com testes/lint quebrados.

---

## 5) Próxima ação sugerida

Executar um **pacote de robustez** em 2 PRs curtos:

1. **PR1 (qualidade):** testes backend críticos + smoke frontend + CI básica.
2. **PR2 (operação):** Alembic + observabilidade + runbook de produção.
