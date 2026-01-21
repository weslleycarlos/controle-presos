from datetime import date
from . import crud, models, schemas
from .database import SessionLocal, engine, get_db
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import timedelta, datetime, timezone
from .security import create_access_token, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES, decode_access_token
from apscheduler.schedulers.background import BackgroundScheduler

# Esta linha é crucial! Ela cria as tabelas no seu banco de dados
# com base no que definimos em models.py
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistema de Controle de Presos")

# --- INÍCIO DA CONFIGURAÇÃO DO CORS ---
# Lista de "origens" (endereços) que podem acessar este backend
origins = [
    "https://controle-presos-front-production.up.railway.app", # Endereço do frontend em produção
    "http://localhost:5173", # O endereço do seu frontend React (Vite)
    "http://localhost",
    "http://127.0.0.1:5173", # Outra forma de acessar o mesmo endereço
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Quais origens são permitidas
    allow_credentials=True,    # Permite cookies/tokens (autenticação)
    allow_methods=["*"],       # Permite todos os métodos (GET, POST, etc)
    allow_headers=["*"],       # Permite todos os cabeçalhos (como 'Authorization')
)
# --- FIM DA CONFIGURAÇÃO DO CORS ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Dependência para obter o usuário logado a partir do token.
    """
    cpf = decode_access_token(token)
    if cpf is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = crud.get_user_by_cpf(db, cpf=cpf)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
         raise HTTPException(status_code=400, detail="Usuário inativo")
    return user

# --- 1. ADICIONE ESTA NOVA FUNÇÃO (dependência de admin) ---
# (Coloque-a logo após a função 'get_current_user')
def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    """
    Verifica se o usuário logado é um admin.
    Se não for, levanta um erro 403 (Forbidden).
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores"
        )
    return current_user

@app.post("/api/users/", response_model=schemas.User, tags=["Autenticação"])
def create_new_user(
    user: schemas.UserCreate, 
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # <-- NOVA LINHA
):
    """
    Cria um novo usuário. (Protegido - Apenas Admins)
    """
    db_user = crud.get_user_by_cpf(db, cpf=user.cpf)
    if db_user:
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    return crud.create_user(db=db, user=user)

@app.post("/api/token", response_model=schemas.Token, tags=["Autenticação"])
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """
    Endpoint de Login. Recebe CPF (no campo 'username') e Senha.
    Retorna um Token JWT.
    """
    # O form_data usa 'username', vamos usá-lo para o nosso 'cpf'
    user = crud.get_user_by_cpf(db, cpf=form_data.username)
    
    # Verifica se o usuário existe e se a senha está correta
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="CPF ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Cria o token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.cpf, "role": user.role}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# --- Endpoints de Preso ---

# --- NOVO ENDPOINT DE CADASTRO COMPLETO ---
@app.post("/api/cadastro-completo", response_model=schemas.Preso, tags=["Presos"])
def create_preso_e_processo(
    cadastro: schemas.PresoCadastroCompleto,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <-- ROTA PROTEGIDA
):
    """
    Cria um novo preso e seus processos iniciais.
    Exige autenticação.
    """
    # (Opcional: verificar se o 'current_user' tem permissão de cadastro)
    
    try:
        return crud.create_preso_completo(db=db, cadastro=cadastro)
    except Exception as e:
        # (Opcional: logar o erro 'e')
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar: {e}")

@app.post("/api/presos/", response_model=schemas.Preso, tags=["Presos"])
def create_preso(preso: schemas.PresoCreate, db: Session = Depends(get_db)):
    # Verifica se o CPF já existe
    if preso.cpf:
        db_preso = crud.get_preso_by_cpf(db, cpf=preso.cpf)
        if db_preso:
            raise HTTPException(status_code=400, detail="CPF já cadastrado")
    return crud.create_preso(db=db, preso=preso)

@app.get("/api/presos/search/", response_model=List[schemas.PresoDetalhe], tags=["Presos"])
def search_presos_endpoint( # Mudei o nome da função para evitar conflito
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user), # Protegido
    # --- NOVOS PARÂMETROS DE CONSULTA ---
    nome: Optional[str] = None,
    status_processual: Optional[str] = None,
    data_prisao: Optional[date] = None
):
    presos = crud.search_presos(
        db=db, 
        nome=nome, 
        status_processual=status_processual, 
        data_prisao=data_prisao
    )
    return presos

@app.get("/api/presos/{preso_id}", response_model=schemas.PresoDetalhe, tags=["Presos"])
def read_preso_details(
    preso_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Critério de sucesso: "...vê todas as informações principais"
    db_preso = crud.get_preso(db, preso_id=preso_id)
    if db_preso is None:
        raise HTTPException(status_code=404, detail="Preso não encontrado")
    return db_preso

# --- Endpoints de Processo ---

@app.post("/api/presos/{preso_id}/processos/", response_model=schemas.Processo, tags=["Processos"])
def create_processo_for_preso(
    preso_id: int,
    processo: schemas.ProcessoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # (Poderia checar se o preso_id existe primeiro, mas o FK do banco já vai barrar)
    return crud.create_processo(db=db, processo=processo, preso_id=preso_id)

# --- Endpoints de Evento ---

@app.post("/api/processos/{processo_id}/eventos/", response_model=schemas.Evento, tags=["Eventos"])
def create_evento_for_processo(
    processo_id: int, 
    evento: schemas.EventoCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <-- ADICIONE A PROTEÇÃO
):
    # (Opcional: checar se o usuário tem permissão para este processo)
    return crud.create_evento(db=db, evento=evento, processo_id=processo_id)

# --- Endpoint de Alerta (O MVP do seu sistema de alertas) ---
# (A lógica de background ainda não está aqui, mas o endpoint de consulta está)

@app.get("/api/alertas/proximos", response_model=List[schemas.Evento], tags=["Alertas"])
def get_proximos_alertas(db: Session = Depends(get_db)):
    """
    Retorna todos os eventos com status 'pendente' ou 'disparado'
    que ainda não aconteceram, ordenados pelo mais próximo.
    """
    agora = datetime.now()
    eventos = db.query(models.Evento).filter(
        models.Evento.data_evento > agora,
        models.Evento.alerta_status.in_([models.AlertaStatusEnum.pendente, models.AlertaStatusEnum.disparado])
    ).order_by(models.Evento.data_evento.asc()).limit(50).all()
    
    return eventos

# --- LÓGICA DO JOB AGENDADO (ROBÔ) ---

def check_alertas_job():
    """
    Função que o Scheduler rodará.
    Verifica eventos nos próximos 7 dias e muda o status para 'disparado'.
    """
    print(f"[{datetime.now()}] Rodando Job de Verificação de Alertas...")
    db: Session = SessionLocal() # O Job precisa criar sua própria sessão de DB
    try:
        agora = datetime.now(timezone.utc)
        limite_dias = agora + timedelta(days=7)

        # 1. Encontra eventos "pendentes" que vencem nos próximos 7 dias
        eventos_para_alertar = db.query(models.Evento).filter(
            models.Evento.data_evento > agora,
            models.Evento.data_evento <= limite_dias,
            models.Evento.alerta_status == models.AlertaStatusEnum.pendente
        ).all()

        if not eventos_para_alertar:
            print("Nenhum novo alerta para disparar.")
            return

        # 2. Atualiza o status
        for evento in eventos_para_alertar:
            evento.alerta_status = models.AlertaStatusEnum.disparado
        
        db.commit()
        print(f"Job finalizado. {len(eventos_para_alertar)} alertas atualizados para 'disparado'.")

    except Exception as e:
        print(f"Erro no Job de Alertas: {e}")
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
def start_scheduler():
    """
    Inicia o Scheduler quando o FastAPI é iniciado.
    """
    scheduler = BackgroundScheduler(timezone="America/Sao_Paulo") # Use o fuso do Brasil
    
    # Roda o job todo dia às 8:00 da manhã
    scheduler.add_job(check_alertas_job, 'cron', hour=8, minute=0)
    
    # (Opcional: Rodar o job agora mesmo para teste)
    scheduler.add_job(check_alertas_job, 'date', run_date=datetime.now() + timedelta(seconds=5))
    
    scheduler.start()
    print("Scheduler de Alertas iniciado. Job rodará diariamente às 08:00.")


# ... (get_current_user, /api/users/, /api/token) ...

# --- NOVO ENDPOINT DE ALERTAS ATIVOS ---
@app.get("/api/alertas/ativos", response_model=List[schemas.EventoAlerta], tags=["Alertas"])
def get_alertas_ativos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user), # Protegido
    limit: Optional[int] = None # <-- 1. ADICIONE ESTE PARÂMETRO
):
    """
    Retorna todos os eventos que foram "disparados" e ainda não venceram.
    """
    agora = datetime.now(timezone.utc)
    
    query = db.query(models.Evento).options(
        joinedload(models.Evento.processo).joinedload(models.Processo.preso)
    ).filter(
        models.Evento.alerta_status == models.AlertaStatusEnum.disparado,
        models.Evento.data_evento > agora
    ).order_by(
        models.Evento.data_evento.asc()
    )
    
    # --- 2. APLIQUE O LIMITE SE ELE FOR FORNECIDO ---
    if limit:
        query = query.limit(limit)
    
    alertas = query.all()
    return alertas

# --- Novo Schema para o request ---
class EventoStatusUpdate(BaseModel):
    status: models.AlertaStatusEnum # Força que o status seja um dos nossos Enums

# --- NOVO ENDPOINT DE ATUALIZAÇÃO DE STATUS ---
@app.patch("/api/eventos/{evento_id}/status", response_model=schemas.Evento, tags=["Alertas"])
def update_evento_status(
    evento_id: int,
    status_update: EventoStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protegido
):
    """
    Atualiza o status de um evento (ex: de 'disparado' para 'concluido').
    """
    db_evento = db.query(models.Evento).filter(models.Evento.id == evento_id).first()
    
    if db_evento is None:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    # (Opcional: verificar se o 'current_user' tem permissão para este evento)

    db_evento.alerta_status = status_update.status
    db.commit()
    db.refresh(db_evento)
    return db_evento

# --- NOVOS ENDPOINTS DE UPDATE (PUT) E DELETE ---

@app.put("/api/presos/{preso_id}", response_model=schemas.Preso, tags=["Presos"])
def update_preso_endpoint(
    preso_id: int,
    preso_update: schemas.PresoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protegido
):
    """Atualiza os dados de um preso."""
    db_preso = crud.update_preso(db, preso_id=preso_id, preso_update=preso_update)
    if db_preso is None:
        raise HTTPException(status_code=404, detail="Preso não encontrado")
    return db_preso


@app.put("/api/processos/{processo_id}", response_model=schemas.Processo, tags=["Processos"])
def update_processo_endpoint(
    processo_id: int,
    processo_update: schemas.ProcessoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protegido
):
    """Atualiza os dados de um processo."""
    db_processo = crud.update_processo(db, processo_id=processo_id, processo_update=processo_update)
    if db_processo is None:
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    return db_processo


@app.delete("/api/presos/{preso_id}", response_model=schemas.Preso, tags=["Presos"])
def delete_preso_endpoint(
    preso_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protegido
):
    """Deleta um preso e todos os seus dados associados."""
    db_preso = crud.delete_preso(db, preso_id=preso_id)
    if db_preso is None:
        raise HTTPException(status_code=404, detail="Preso não encontrado")
    return db_preso

@app.get("/api/users/me", response_model=schemas.User, tags=["Usuário"])
def read_users_me(
    current_user: models.User = Depends(get_current_user)
):
    """Retorna os dados do usuário logado."""
    return current_user


@app.put("/api/users/me", response_model=schemas.User, tags=["Usuário"])
def update_users_me(
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza o nome e/ou email do usuário logado."""
    return crud.update_user_profile(db=db, db_user=current_user, user_in=user_in)


@app.put("/api/users/me/password", tags=["Usuário"])
def change_users_me_password(
    password_data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Muda a senha do usuário logado."""
    # 1. Verifica se a senha antiga está correta
    if not verify_password(password_data.senha_antiga, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha antiga incorreta.")
    
    # 2. (Opcional) Verifica a força da nova senha
    if len(password_data.nova_senha) < 8:
         raise HTTPException(status_code=400, detail="Nova senha deve ter pelo menos 8 caracteres.")
    
    # 3. Atualiza a senha
    crud.update_user_password(db=db, db_user=current_user, nova_senha=password_data.nova_senha)
    return {"message": "Senha atualizada com sucesso."}

# --- NOVO ENDPOINT DE LISTAR USUÁRIOS ---
@app.get("/api/users/", response_model=List[schemas.User], tags=["Usuário"])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # Protegido
):
    """
    Retorna uma lista de todos os usuários. (Apenas Admins)
    """
    users = crud.get_users(db, skip=skip, limit=limit)
    return users


# --- NOVO ENDPOINT DE RESET DE SENHA (ADMIN) ---
@app.post("/api/users/{user_id}/reset-password", tags=["Usuário"])
def admin_reset_user_password(
    user_id: int,
    password_data: schemas.AdminPasswordReset,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # Protegido
):
    """
    Permite que um admin defina uma nova senha para qualquer usuário.
    """
    # 1. Encontra o usuário-alvo
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # 2. (Opcional) Impede um admin de resetar a própria senha por aqui
    if db_user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Admin não pode resetar a própria senha por este endpoint. Use /users/me/change-password.")
        
    # 3. Verifica a força da nova senha
    if len(password_data.nova_senha) < 8:
         raise HTTPException(status_code=400, detail="Nova senha deve ter pelo menos 8 caracteres.")
    
    # 4. Atualiza a senha (reutilizando nossa função de crud)
    crud.update_user_password(db=db, db_user=db_user, nova_senha=password_data.nova_senha)
    return {"message": f"Senha do usuário '{db_user.nome_completo}' atualizada com sucesso."}

# --- NOVO ENDPOINT DE EDIÇÃO (ADMIN) ---
@app.put("/api/users/{user_id}", response_model=schemas.User, tags=["Usuário"])
def update_user_by_admin_endpoint(
    user_id: int,
    user_in: schemas.UserUpdate, # O schema só permite mudar nome, email e tema
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # Protegido
):
    """
    Permite que um admin atualize nome, email ou tema de um usuário.
    """
    try:
        updated_user = crud.update_user_by_admin(db, user_id=user_id, user_in=user_in)
        return updated_user
    except HTTPException as e:
        raise e
    except Exception as e:
        # Pega o erro de email duplicado do crud.update_user_profile
        raise HTTPException(status_code=400, detail=str(e))