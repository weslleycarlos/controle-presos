# backend/create_first_admin.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Carrega a variável DATABASE_URL do arquivo .env
load_dotenv()

# Importa os módulos da nossa aplicação
# (Isso assume que você roda o script da pasta 'backend/')
from app.models import User, Base
from app.schemas import UserCreate
from app.crud import create_user, get_user_by_cpf
from app.database import engine

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
        # --- DEFINA OS DADOS DO SEU ADMIN AQUI ---
        ADMIN_NOME = "Admin do Sistema"
        ADMIN_CPF = "03859109162" # Importante: Use um CPF real ou um que você lembre
        ADMIN_EMAIL = "weslley.unemat@gmail.com"
        ADMIN_SENHA = "W3$ll3y@1992" # Importante: Mude isso!
        # --------------------------------------------

        # 1. Verifica se o admin já existe
        admin = get_user_by_cpf(db, cpf=ADMIN_CPF)
        
        if admin:
            print(f"Usuário com CPF {ADMIN_CPF} já existe.")
            if admin.role != "admin":
                print("Atualizando usuário existente para 'admin'...")
                admin.role = "admin"
                db.commit()
                print("Usuário atualizado para 'admin'.")
            else:
                print("Usuário já é 'admin'. Nenhuma ação necessária.")
            return

        # 2. Se não existe, cria o novo admin
        print(f"Criando novo usuário admin com CPF: {ADMIN_CPF}...")
        admin_schema = UserCreate(
            nome_completo=ADMIN_NOME,
            cpf=ADMIN_CPF,
            email=ADMIN_EMAIL,
            password=ADMIN_SENHA,
            role="admin"  # <-- Define o papel
        )
        
        create_user(db=db, user=admin_schema)
        
        print("\n--- [ SUCESSO ] ---")
        print("Usuário admin criado com sucesso!")
        print(f"CPF (Username): {ADMIN_CPF}")
        print(f"Senha: {ADMIN_SENHA}")
        print("--------------------")
        
    except Exception as e:
        print(f"\n[ERRO] Erro ao criar admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()