# backend/create_first_admin.py
import os
from getpass import getpass
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Carrega a variável DATABASE_URL do arquivo .env
load_dotenv()

# Importa os módulos da nossa aplicação
# (Isso assume que você roda o script da pasta 'backend/')
from app.models import Base
from app.schemas import UserCreate
from app.crud import create_user, get_user_by_cpf

# --- Configuração do Banco ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Erro: DATABASE_URL não definida no .env")
    exit()

# Ajuste para o caminho do SQLite se estiver rodando local
if DATABASE_URL.startswith("sqlite"):
    DATABASE_URL = "sqlite:///./local.db" 
    print(f"Usando banco de dados local: {DATABASE_URL}")

try:
    local_engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)
    
    # Cria as tabelas (importante para a primeira execução)
    Base.metadata.create_all(bind=local_engine)
    print("Tabelas verificadas/criadas.")
except Exception as e:
    print(f"Erro ao conectar ao banco: {e}")
    print("Verifique se o banco está acessível e a DATABASE_URL está correta no .env")
    exit()


def main():
    print("--- Iniciando script de criação do primeiro admin ---")
    db = SessionLocal()
    
    try:
        admin_nome = os.getenv("FIRST_ADMIN_NOME") or input("Nome completo do admin: ").strip()
        admin_cpf = os.getenv("FIRST_ADMIN_CPF") or input("CPF do admin (somente números): ").strip()
        admin_email = os.getenv("FIRST_ADMIN_EMAIL") or input("Email do admin: ").strip()
        admin_senha = os.getenv("FIRST_ADMIN_SENHA") or getpass("Senha do admin: ")

        if not admin_nome:
            raise ValueError("Nome do admin é obrigatório.")
        if not admin_cpf or len(admin_cpf) != 11 or not admin_cpf.isdigit():
            raise ValueError("CPF inválido. Informe 11 dígitos numéricos.")
        if not admin_email:
            raise ValueError("Email do admin é obrigatório.")
        if not admin_senha or len(admin_senha) < 8:
            raise ValueError("Senha do admin deve ter pelo menos 8 caracteres.")

        # 1. Verifica se o admin já existe
        admin = get_user_by_cpf(db, cpf=admin_cpf)
        
        if admin:
            print(f"Usuário com CPF {admin_cpf} já existe.")
            if admin.role != "admin":
                print("Atualizando usuário existente para 'admin'...")
                admin.role = "admin"
                db.commit()
                print("Usuário atualizado para 'admin'.")
            else:
                print("Usuário já é 'admin'. Nenhuma ação necessária.")
            return

        # 2. Se não existe, cria o novo admin
        print(f"Criando novo usuário admin com CPF: {admin_cpf}...")
        admin_schema = UserCreate(
            nome_completo=admin_nome,
            cpf=admin_cpf,
            email=admin_email,
            password=admin_senha,
            role="admin"  # <-- Define o papel
        )
        
        create_user(db=db, user=admin_schema)
        
        print("\n--- [ SUCESSO ] ---")
        print("Usuário admin criado com sucesso!")
        print(f"CPF (Username): {admin_cpf}")
        print("--------------------")
        
    except Exception as e:
        print(f"\n[ERRO] Erro ao criar admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()