# 🔧 Roteiro de Correções e Evolução — Sistema de Controle de Presos

**Última atualização:** 12/02/2026  
**Objetivo:** corrigir riscos atuais, elevar qualidade técnica e integrar PJe/DataJud para reduzir digitação manual e melhorar usabilidade.

---

## 1) Ordem lógica de execução (macro)

### **Fase 0 — Contenção imediata (1-3 dias)**
Foco: remover riscos críticos de segurança e autorização.

1. Tornar `SECRET_KEY` obrigatória em produção (sem fallback hardcoded).
2. Remover credenciais hardcoded em `create_first_admin.py`.
3. Proteger endpoints sensíveis ainda abertos (`/api/presos/`, `/api/alertas/proximos`).
4. Alterar `role` padrão de usuário para `user` (model + schema + fluxo de criação).
5. Sanitizar mensagens de erro para não expor detalhes internos.

### **Fase 1 — Estabilidade e consistência (3-5 dias)**
Foco: reduzir bugs funcionais e inconsistências de dados.

1. Corrigir timezone (UTC-aware) de ponta a ponta.
2. Ajustar busca de presos para não depender de `INNER JOIN` obrigatório.
3. Corrigir defaults mutáveis em schemas (`Field(default_factory=list)`).
4. Revisar limites e validações de entrada (CPF, senha, `limit`, `skip`).
5. Padronizar tratamento de erro backend/frontend.

### **Fase 2 — UX e produtividade (4-7 dias)**
Foco: feedback claro, acessibilidade e fluxo operacional.

1. Padronizar `Snackbar` para erros/sucessos em toda a UI.
2. Adicionar loading/disabled em ações críticas (login, salvar, concluir alerta).
3. Melhorar acessibilidade (`aria-label` em `IconButton`, foco e navegação teclado).
4. Remover código morto e centralizar constantes/formatadores (`API_URL`, `tiposDeEvento`, `formatarData`).
5. Implementar paginação/ordenação em alertas e listas administrativas.

### **Fase 3 — Performance e operação (3-5 dias)**
Foco: escalabilidade e previsibilidade em produção.

1. Revisar scheduler para evitar execução duplicada em múltiplos workers.
2. Limitar queries pesadas e aplicar índices úteis (ex.: `data_prisao`, combinações frequentes de filtro).
3. Limpeza de dependências backend não utilizadas.
4. Formalizar migrações Alembic (evitar depender de `create_all` no startup).
5. Adicionar logging estruturado e trilha de auditoria básica.

### **Fase 4 — Integração PJe/DataJud (MVP + evolução contínua)**
Foco: automação assistida (sem quebrar operação manual atual).

1. Entrega MVP de consulta automática por número de processo.
2. Enriquecimento de dados com eventos relevantes e atualização assistida.
3. Monitoramento de falhas de integração + fallback manual.
4. Evolução para sincronização incremental e regras de alerta inteligentes.

---

## 2) Backlog consolidado (com prioridade)

## 🔴 Prioridade Alta

- [ ] **A1 — Chave JWT segura obrigatória**
  - **Problema:** fallback hardcoded permite configuração insegura.
  - **Ação:** recusar startup sem `SECRET_KEY` robusta em ambiente não-dev.

- [ ] **A2 — Remoção de segredos hardcoded no script de admin**
  - **Problema:** CPF/email/senha fixos no código e senha impressa em log.
  - **Ação:** usar env vars/input seguro; nunca imprimir senha.

- [ ] **A3 — Fechar endpoints sem autenticação**
  - **Problema:** criação de preso e consulta de alertas próximos expostos.
  - **Ação:** exigir token e aplicar regra de perfil (user/admin) conforme regra de negócio.

- [ ] **A4 — Role padrão incorreta (`admin`)**
  - **Problema:** risco de privilégio excessivo por default.
  - **Ação:** default `user`; role explícita só para fluxo admin.

- [ ] **A5 — Política de token no frontend**
  - **Problema:** token em `localStorage` aumenta risco XSS.
  - **Ação:** plano de migração para cookie HttpOnly + SameSite + CSRF.

- [ ] **A6 — Sanitização de exceções**
  - **Problema:** retorno de erro técnico ao usuário final.
  - **Ação:** mapear erros conhecidos e retornar mensagens amigáveis + log técnico interno.

## 🟠 Prioridade Média

- [ ] **M1 — Timezone consistente (backend + frontend + scheduler)**
- [ ] **M2 — Ajustar busca para incluir presos sem processo (ou bloquear criação incompleta)**
- [ ] **M3 — Validação forte de entrada em schemas Pydantic (CPF, senha, paginação)**
- [ ] **M4 — Scheduler resiliente (sem duplicidade em multi-worker)**
- [ ] **M5 — Limpeza de dependências não usadas em `requirements.txt`**
- [ ] **M6 — Trocar import legado `declarative_base` para `sqlalchemy.orm.declarative_base`**
- [ ] **M7 — Centralização de config frontend (`API_URL`, interceptors, erros globais)**
- [ ] **M8 — Refatorar `PaginaDetalhes` em componentes menores (manutenção/testabilidade)**

## 🟡 Prioridade Baixa

- [ ] **B1 — Acessibilidade: `aria-label` em ícones e revisão de foco**
- [ ] **B2 — Remover código morto/variáveis não usadas**
- [ ] **B3 — Uniformizar tema com tokens MUI (evitar hardcode de cores)**
- [ ] **B4 — Melhorar documentação de operação e segurança no README**

---

## 3) Integração PJe/DataJud — roteiro recomendado

## **3.1 Objetivo funcional da integração**

Reduzir cadastro manual e melhorar confiabilidade dos dados processuais:

1. Buscar metadados do processo pelo número PJe/DataJud.
2. Sugerir/preencher automaticamente campos no cadastro.
3. Importar eventos processuais relevantes para alertas.
4. Permitir “sincronização sob demanda” e “revisão antes de salvar”.

## **3.2 Estratégia técnica (sem acoplamento forte)**

Criar camada de integração desacoplada em backend:

- `app/integracoes/base.py` (interface/adaptador).
- `app/integracoes/pje_client.py`.
- `app/integracoes/datajud_client.py`.
- `app/services/sincronizacao_processo.py` (regra de negócio).

Assim, se uma API mudar, o impacto fica isolado no client correspondente.

## **3.3 Entregas por etapa**

### **Etapa I — MVP assistido (2-3 sprints)**

1. Endpoint backend: `POST /api/integracoes/processos/consultar`.
2. Entrada: número do processo + tribunal/órgão (quando necessário).
3. Saída: dados normalizados para pré-preenchimento do formulário.
4. UI: botão “Buscar no PJe/DataJud” em cadastro/edição de processo.
5. Usuário confirma/edita antes de persistir (não gravar automático no MVP).

### **Etapa II — Sincronização incremental**

1. Campo `fonte_dados`, `ultimo_sync_em`, `hash_payload` no modelo de processo.
2. Endpoint `POST /api/processos/{id}/sincronizar`.
3. Registrar diffs (“o que mudou desde a última sincronização”).
4. Atualizar alertas com base em novos eventos relevantes.

### **Etapa III — Automação com governança**

1. Scheduler para sync diário configurável por tribunal/perfil.
2. Fila de tarefas e retentativa com backoff.
3. Painel de integração: sucesso, falhas, latência, última execução.
4. Alertas operacionais para falhas repetidas na integração.

## **3.4 Modelo de dados adicional**

- `IntegracaoLog` (status, endpoint, payload resumido, erro, duração).
- `ProcessoSyncHistorico` (snapshot mínimo + diff).
- `origem_dado` por campo crítico (manual, PJe, DataJud, misto).

## **3.5 Segurança e compliance da integração**

1. Guardar credenciais/tokens de integração apenas em variáveis seguras.
2. Nunca persistir payload sensível completo sem necessidade.
3. Log com mascaramento de dados pessoais.
4. Respeitar limites/rate-limit de API externa.
5. Implementar timeout, circuit breaker e retry controlado.

## **3.6 UX orientada à usabilidade (objetivo do projeto)**

1. Pré-preenchimento com destaque “dados sugeridos pela integração”.
2. Comparador “Atual x Sugerido” antes de confirmar alterações.
3. Estado de sincronização visível (ok, pendente, falha).
4. Botão “Re-sincronizar” no detalhe do processo.
5. Mensagens claras quando API externa estiver indisponível + caminho manual alternativo.

---

## 4) Critérios de pronto por fase

### Fase 0 pronta quando:
- Nenhum endpoint crítico acessível sem autenticação.
- Sem segredos hardcoded no repositório.
- Role padrão segura (`user`).

### Fase 1 pronta quando:
- Datas e alertas consistentes em UTC.
- Busca de presos estável para todos os cenários.
- Validação de input coberta no backend.

### Fase 2 pronta quando:
- Fluxos principais com feedback de loading/erro/sucesso.
- Acessibilidade mínima implementada.
- Menor duplicação no frontend.

### Fase 3 pronta quando:
- Scheduler previsível em produção.
- Queries críticas otimizadas.
- Observabilidade mínima disponível.

### Fase 4 pronta quando:
- Consulta PJe/DataJud funcional com fallback manual.
- Sincronização rastreável, auditável e usável no dia a dia.

---

## 5) Itens adicionais (além dos achados iniciais)

1. **Testes automatizados mínimos**
   - Backend: autenticação, autorização, criação de preso/processo/evento, alertas.
   - Frontend: smoke tests para login, dashboard e alertas.

2. **Matriz de permissões (RBAC) explícita**
   - Definir por endpoint: admin, user, leitura vs escrita.

3. **Auditoria funcional**
   - Registrar alterações sensíveis (quem mudou status, quem resetou senha, quando).

4. **Runbook operacional**
   - Procedimento para falha de integração, expiração de token externo e restauração.

5. **Feature flags para integração externa**
   - Habilitar/desabilitar PJe/DataJud por ambiente sem redeploy.

---

## 6) Próximo passo recomendado

Iniciar imediatamente pela **Fase 0** com PR curto e focado em segurança/autorização.  
Depois, abrir o épico **Integração PJe/DataJud (Etapa I - MVP assistido)** em paralelo com a **Fase 2 (UX)** para entregar valor visível ao usuário final mais rápido.
