"""
Migrações leves e idempotentes.

O projeto cria o schema com `Base.metadata.create_all()`, que cria tabelas novas
mas nunca adiciona colunas a tabelas que já existem. Este módulo cobre essa
lacuna para as poucas colunas introduzidas depois do schema inicial, sem exigir
um ciclo completo de Alembic.

Cada passo verifica o estado atual antes de agir, então rodar várias vezes é
seguro.
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# (tabela, coluna, definição SQL) — a definição precisa ser aceita tanto pelo
# SQLite quanto pelo PostgreSQL.
COLUNAS_ADICIONADAS = [
    ("users", "token_version", "INTEGER NOT NULL DEFAULT 1"),
]


def run_lightweight_migrations(engine: Engine) -> None:
    """Aplica as migrações pendentes, registrando falhas sem derrubar o app."""
    try:
        inspector = inspect(engine)
        tabelas_existentes = set(inspector.get_table_names())
    except Exception:
        logger.exception("Não foi possível inspecionar o banco para migrações.")
        return

    for tabela, coluna, definicao in COLUNAS_ADICIONADAS:
        if tabela not in tabelas_existentes:
            # A tabela ainda será criada pelo create_all, já com a coluna.
            continue

        try:
            colunas = {c["name"] for c in inspector.get_columns(tabela)}
        except Exception:
            logger.exception("Falha ao inspecionar colunas de %s.", tabela)
            continue

        if coluna in colunas:
            continue

        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {definicao}"))
            logger.info("Migração aplicada: %s.%s adicionada.", tabela, coluna)
        except Exception:
            logger.exception("Falha ao adicionar coluna %s.%s.", tabela, coluna)
