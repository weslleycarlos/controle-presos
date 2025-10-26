from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func # para usar func.lower
from datetime import date
from typing import Optional
from . import models, schemas
from .security import get_password_hash # Importar nossa função de hash

# --- CRUD de Preso ---

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_cpf(db: Session, cpf: str):
    return db.query(models.User).filter(models.User.cpf == cpf).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        nome_completo=user.nome_completo,
        cpf=user.cpf,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_preso(db: Session, preso_id: int):
    # Esta é a query principal: busca o preso e já "anexa" 
    # os processos e os eventos de cada processo em uma única consulta.
    # Isso é MUITO mais eficiente do que fazer consultas separadas.
    return db.query(models.Preso).options(
        joinedload(models.Preso.processos).
        joinedload(models.Processo.eventos)
    ).filter(models.Preso.id == preso_id).first()

def get_preso_by_cpf(db: Session, cpf: str):
    return db.query(models.Preso).filter(models.Preso.cpf == cpf).first()

def search_presos(
    db: Session, 
    nome: Optional[str] = None, 
    status_processual: Optional[str] = None,
    data_prisao: Optional[date] = None,
    skip: int = 0, 
    limit: int = 100
):
    """
    Busca presos por múltiplos critérios.
    Todos os filtros são opcionais.
    """
    # Começa a query base, já fazendo o JOIN em Processos
    query = db.query(models.Preso).join(models.Processo).options(
        joinedload(models.Preso.processos)
    )

    # 1. Filtro por Nome (se fornecido)
    if nome:
        query_nome = f"%{nome.lower()}%"
        query = query.filter(func.lower(models.Preso.nome_completo).ilike(query_nome))

    # 2. Filtro por Status (se fornecido)
    if status_processual:
        query = query.filter(models.Processo.status_processual == status_processual)
        
    # 3. Filtro por Data da Prisão (se fornecida)
    if data_prisao:
        query = query.filter(models.Processo.data_prisao == data_prisao)

    # Aplica ordenação, paginação e executa
    return query.order_by(models.Preso.nome_completo.asc()).offset(skip).limit(limit).all()

def create_preso(db: Session, preso: schemas.PresoCreate):
    db_preso = models.Preso(
        nome_completo=preso.nome_completo,
        cpf=preso.cpf,
        nome_da_mae=preso.nome_da_mae,
        data_nascimento=preso.data_nascimento
    )
    db.add(db_preso)
    db.commit()
    db.refresh(db_preso)
    return db_preso

# --- CRUD de Processo ---

def create_processo(db: Session, processo: schemas.ProcessoCreate, preso_id: int):
    db_processo = models.Processo(**processo.dict(), preso_id=preso_id)
    db.add(db_processo)
    db.commit()
    db.refresh(db_processo)
    return db_processo

# --- CRUD de Evento ---

def create_evento(db: Session, evento: schemas.EventoCreate, processo_id: int):
    db_evento = models.Evento(**evento.dict(), processo_id=processo_id)
    db.add(db_evento)
    db.commit()
    db.refresh(db_evento)
    return db_evento

# ... (imports existentes) ...

# (CRUD de Preso, Processo, Evento, User... continuam aqui)

# --- NOVA FUNÇÃO DE CRUD COMPLETO ---

def create_preso_completo(db: Session, cadastro: schemas.PresoCadastroCompleto):
    """
    Cria um preso e seus processos associados em uma única transação.
    """
    # 1. Cria o objeto Preso
    # .model_dump() é o novo .dict() do Pydantic v2
    db_preso = models.Preso(**cadastro.preso.model_dump())
    db.add(db_preso)
    
    # Fazemos um "pré-commit" (flush) para que o db_preso receba um ID 
    # ANTES de salvarmos os processos, mas sem finalizar a transação.
    db.flush() 
    
    # 2. Itera e cria os Processos
    for proc_schema in cadastro.processos:
        db_processo = models.Processo(
            **proc_schema.model_dump(), 
            preso_id=db_preso.id # <-- AQUI ESTÁ A MÁGICA DA VINCULAÇÃO
        )
        db.add(db_processo)
        
    # 3. Agora sim, comete tudo de uma vez.
    # Se algo der errado (ex: um processo inválido), 
    # o banco desfaz tudo (rollback), incluindo a criação do preso.
    db.commit()
    
    # Recarrega o db_preso para ele "saber" sobre os processos recém-criados
    db.refresh(db_preso)
    return db_preso

def update_preso(db: Session, preso_id: int, preso_update: schemas.PresoCreate):
    """Atualiza os dados de um preso."""
    db_preso = db.query(models.Preso).filter(models.Preso.id == preso_id).first()
    if not db_preso:
        return None
    
    # Pega os dados do schema Pydantic e os converte para um dict
    update_data = preso_update.model_dump(exclude_unset=True)
    
    # Atualiza o objeto db_preso campo a campo
    for key, value in update_data.items():
        setattr(db_preso, key, value)
        
    db.commit()
    db.refresh(db_preso)
    return db_preso

def update_processo(db: Session, processo_id: int, processo_update: schemas.ProcessoCreate):
    """Atualiza os dados de um processo."""
    db_processo = db.query(models.Processo).filter(models.Processo.id == processo_id).first()
    if not db_processo:
        return None
        
    update_data = processo_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_processo, key, value)
        
    db.commit()
    db.refresh(db_processo)
    return db_processo

def delete_preso(db: Session, preso_id: int):
    """Deleta um preso (e seus processos/eventos em cascata)."""
    db_preso = db.query(models.Preso).filter(models.Preso.id == preso_id).first()
    if not db_preso:
        return None
    
    db.delete(db_preso)
    db.commit()
    return db_preso # Retorna o objeto deletado (para confirmação)