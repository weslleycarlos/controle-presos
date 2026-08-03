-- =====================================================================
-- Blindagem do banco PostgreSQL (Supabase / Neon)
-- =====================================================================
--
-- LEIA ANTES DE RODAR
--
-- Como esta aplicação funciona hoje: o navegador NUNCA fala com o banco.
-- Todo acesso passa pelo backend FastAPI, que se conecta com um único
-- usuário de banco (a DATABASE_URL). Nesse desenho, a autorização real
-- é feita na API (get_current_user / get_current_admin_user), e não no
-- banco.
--
-- Consequência prática: RLS ("Row Level Security") NÃO substitui a
-- autorização da API. Se alguém obtiver a DATABASE_URL, terá os
-- privilégios daquele usuário de banco independentemente de RLS, porque
-- é o mesmo usuário que a aplicação usa para tudo.
--
-- Onde RLS ajuda de verdade aqui: como rede de segurança. No Supabase, as
-- tabelas do schema `public` ficam automaticamente expostas pela API
-- PostgREST usando a chave `anon`. Se essa chave vazar (ela vive no
-- frontend em projetos que usam Supabase direto) e as tabelas estiverem
-- sem RLS, QUALQUER PESSOA lê a base inteira. Habilitar RLS sem criar
-- nenhuma policy permissiva fecha essa porta por completo, sem afetar em
-- nada o backend — ver a observação sobre BYPASSRLS no passo 2.
--
-- Rode este script com um usuário administrador do banco (owner),
-- NÃO com o usuário da aplicação.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Habilita RLS em todas as tabelas da aplicação.
--
-- Sem nenhuma policy criada, o padrão do PostgreSQL é negar tudo para
-- usuários comuns. É exatamente o que queremos: nenhum acesso direto,
-- só via backend.
-- ---------------------------------------------------------------------
ALTER TABLE public.users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presos                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria              ENABLE ROW LEVEL SECURITY;

-- FORCE faz a regra valer inclusive para o dono da tabela.
-- Deixe COMENTADO se o usuário da aplicação for o owner das tabelas,
-- senão a própria aplicação passa a ser bloqueada.
-- ALTER TABLE public.users          FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.presos         FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.processos      FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.eventos        FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.logs_auditoria FORCE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- 2. Garante que o backend continue funcionando.
--
-- Troque 'app_user' pelo usuário da sua DATABASE_URL.
--
-- O dono (owner) da tabela ignora RLS por padrão, desde que FORCE não
-- esteja ligado. Se o usuário da aplicação NÃO for o owner, dê a ele o
-- atributo BYPASSRLS — assim o backend segue enxergando tudo enquanto
-- qualquer outro papel (como o `anon` do Supabase) fica trancado.
-- ---------------------------------------------------------------------
-- ALTER ROLE app_user BYPASSRLS;


-- ---------------------------------------------------------------------
-- 3. Revoga o acesso público ao schema.
--
-- Impede que papéis genéricos (PUBLIC, anon, authenticated) enxerguem ou
-- manipulem qualquer objeto, mesmo em tabelas criadas no futuro.
-- ---------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Específico do Supabase: bloqueia os papéis usados pela API PostgREST.
-- Se o projeto não é Supabase, estes comandos falham e podem ser ignorados.
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- Tabelas criadas daqui pra frente já nascem fechadas para PUBLIC.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;


-- ---------------------------------------------------------------------
-- 4. Concede ao backend somente o que ele precisa.
--
-- Troque 'app_user' pelo usuário da sua DATABASE_URL.
-- A aplicação não executa DDL em tempo de execução além do
-- create_all/migrations do startup, então DML + uso de sequences basta.
-- ---------------------------------------------------------------------
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;


-- ---------------------------------------------------------------------
-- 5. Protege a trilha de auditoria contra adulteração.
--
-- Log que pode ser editado ou apagado não serve como prova. O ideal é
-- que a aplicação só consiga inserir e ler — nunca alterar nem excluir.
-- Rode isto DEPOIS do passo 4, para sobrepor o GRANT amplo acima.
-- ---------------------------------------------------------------------
-- REVOKE UPDATE, DELETE ON public.logs_auditoria FROM app_user;


-- ---------------------------------------------------------------------
-- 6. Verificação — confirme o resultado depois de aplicar.
-- ---------------------------------------------------------------------
-- Deve listar rowsecurity = true para todas as tabelas:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Deve vir vazio (nenhuma policy permissiva criada por engano):
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
