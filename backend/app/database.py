import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Carrega as variáveis de ambiente do arquivo .env
#    Isso vai procurar por um arquivo .env na pasta 'backend/' e carregá-lo.
load_dotenv()

# 2. Pega a URL do banco do ambiente.
#    os.getenv('DATABASE_URL') vai ler a variável.
#    Se ela NÃO EXISTIR, ele usa o valor padrão (nosso SQLite)
DEFAULT_SQLITE_URL = "sqlite:///./local.db"
raw_database_url = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
SQLALCHEMY_DATABASE_URL = raw_database_url.strip()

if (
    (SQLALCHEMY_DATABASE_URL.startswith('"') and SQLALCHEMY_DATABASE_URL.endswith('"'))
    or (SQLALCHEMY_DATABASE_URL.startswith("'") and SQLALCHEMY_DATABASE_URL.endswith("'"))
):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL[1:-1].strip()

# 3. Lógica específica para SQLite vs. PostgreSQL
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # SQLite precisa deste argumento para funcionar com FastAPI
    connect_args = {"check_same_thread": False}
    print("--- INICIANDO COM BANCO DE DADOS SQLITE (LOCAL) ---")
else:
    # Assumimos que é PostgreSQL (Supabase)
    print("--- INICIANDO COM BANCO DE DADOS POSTGRESQL (PRODUÇÃO) ---")


try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args=connect_args
    )
except ArgumentError as exc:
    raise RuntimeError(
        "DATABASE_URL inválida no .env. Exemplos válidos: "
        "sqlite:///./local.db | "
        "postgresql://usuario:senha@host:5432/banco?sslmode=require"
    ) from exc

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Função para obter uma sessão do banco (continua igual)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()