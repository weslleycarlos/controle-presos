-- Script para adicionar o novo valor 'remessa_tribunal' ao Enum de tipos de evento no banco de dados Neon PostgreSQL.

-- No PostgreSQL, os Enums são tipos customizados e precisam ser alterados afim de enxergar novos valores.

ALTER TYPE tipoeventoenum ADD VALUE IF NOT EXISTS 'remessa_tribunal';

-- Caso o nome do tipo enum seja diferente no seu banco, você pode descobrir rodando:
-- SELECT typname FROM pg_type WHERE typtype = 'e';
