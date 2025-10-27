
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr

from .models import TipoEventoEnum, AlertaStatusEnum # Importa nossos Enums

# --- Schemas de Evento ---

class UserBase(BaseModel):
    nome_completo: str
    cpf: str
    email: Optional[EmailStr] = None
    role: Optional[str] = "advogado"

class UserCreate(UserBase):
    password: str # A senha em texto puro, apenas na criação

class User(UserBase):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    """Schema para o usuário atualizar seu próprio perfil."""
    nome_completo: Optional[str] = None
    email: Optional[EmailStr] = None

class PasswordChange(BaseModel):
    """Schema para mudança de senha."""
    senha_antiga: str
    nova_senha: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    cpf: Optional[str] = None

class EventoBase(BaseModel):
    data_evento: datetime
    tipo_evento: TipoEventoEnum
    descricao: Optional[str] = None

class EventoCreate(EventoBase):
    pass # Para criar, não precisa de mais nada

class Evento(EventoBase):
    id: int
    processo_id: int
    alerta_status: AlertaStatusEnum

    model_config = ConfigDict(from_attributes=True)

# --- Schemas de Processo ---

class ProcessoBase(BaseModel):
    numero_processo: str
    status_processual: Optional[str] = None
    tipo_prisao: Optional[str] = None
    data_prisao: Optional[date] = None
    local_segregacao: Optional[str] = None

class ProcessoCreate(ProcessoBase):
    pass

class Processo(ProcessoBase):
    id: int
    preso_id: int

    model_config = ConfigDict(from_attributes=True)

# --- Schemas de Preso (Base) ---

class PresoBase(BaseModel):
    nome_completo: str
    cpf: Optional[str] = None
    nome_da_mae: Optional[str] = None
    data_nascimento: Optional[date] = None

class PresoCreate(PresoBase):
    pass # Para criar, só precisamos dos dados base

class Preso(PresoBase):
    id: int
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Schemas Compostos (Para respostas completas) ---

class ProcessoComEventos(Processo):
    eventos: List[Evento] = [] # Um processo terá uma lista de seus eventos

class PresoDetalhe(Preso):
    processos: List[ProcessoComEventos] = [] # Um preso terá uma lista de seus processos (com eventos)

# --- NOVO SCHEMA PARA CADASTRO ---

class PresoCadastroCompleto(BaseModel):
    """
    Schema para receber os dados do preso e uma lista de 
    seus processos iniciais em uma única requisição.
    """
    preso: PresoCreate
    processos: List[ProcessoCreate] # O frontend enviará o primeiro processo aqui

# ... (imports e schemas existentes) ...

# --- NOVOS SCHEMAS PARA O DASHBOARD DE ALERTAS ---

class PresoSimples(BaseModel):
    """Schema mínimo do Preso para o Alerta."""
    id: int
    nome_completo: str

    model_config = ConfigDict(from_attributes=True)

class ProcessoSimplesParaAlerta(BaseModel):
    """Schema mínimo do Processo para o Alerta."""
    id: int
    numero_processo: str
    preso: PresoSimples # Aninha o PresoSimples dentro do Processo

    model_config = ConfigDict(from_attributes=True)

class EventoAlerta(BaseModel):
    """Schema completo do Evento para o Alerta."""
    id: int
    data_evento: datetime
    tipo_evento: TipoEventoEnum
    alerta_status: AlertaStatusEnum
    descricao: Optional[str] = None
    processo: ProcessoSimplesParaAlerta # Aninha o ProcessoSimples

    model_config = ConfigDict(from_attributes=True)