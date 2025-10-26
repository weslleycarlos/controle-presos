from sqlalchemy import Boolean, Column, Integer, String, Date, DateTime, ForeignKey, Text, Enum, func
from sqlalchemy.orm import relationship
import enum

# IMPORTANTE: Importe o 'engine' do database.py
from .database import Base, engine 
# A LINHA COM ERRO FOI REMOVIDA DAQUI

# --- Lógica de Timezone Híbrida ---
# Verifica o "dialeto" do banco (sqlite, postgresql, etc.)
if engine.dialect.name == "postgresql":
    # Se for Postgres, usamos o tipo com Timezone (melhor)
    TimestampTZ = DateTime(timezone=True)
else:
    # Se for SQLite ou outro, usamos o DateTime padrão (sem timezone)
    TimestampTZ = DateTime

# ------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String(255), nullable=False)
    cpf = Column(String(11), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String(50), nullable=True, default="advogado") # Ex: 'advogado', 'admin'
    is_active = Column(Boolean, default=True)

class TipoEventoEnum(str, enum.Enum):
    audiencia = "audiencia"
    reavaliacao_preventiva = "reavaliacao_preventiva"
    prazo_recurso = "prazo_recurso"
    outro = "outro"

class AlertaStatusEnum(str, enum.Enum):
    pendente = "pendente"
    disparado = "disparado"
    concluido = "concluido"


class Preso(Base):
    __tablename__ = "presos"

    id = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String(255), nullable=False, index=True)
    cpf = Column(String(11), unique=True, index=True, nullable=True)
    nome_da_mae = Column(String(255), nullable=True)
    data_nascimento = Column(Date, nullable=True)
    
    # Aplicamos nosso tipo de data híbrido aqui
    criado_em = Column(TimestampTZ, server_default=func.now()) 
    
    processos = relationship("Processo", back_populates="preso", cascade="all, delete-orphan")

class Processo(Base):
    __tablename__ = "processos"

    id = Column(Integer, primary_key=True, index=True)
    numero_processo = Column(String(50), nullable=False, index=True)
    status_processual = Column(String(100))
    tipo_prisao = Column(String(100))
    data_prisao = Column(Date, nullable=True)
    local_segregacao = Column(String(255), nullable=True)
    preso_id = Column(Integer, ForeignKey("presos.id"), nullable=False)
    
    preso = relationship("Preso", back_populates="processos")
    eventos = relationship("Evento", back_populates="processo", cascade="all, delete-orphan")

class Evento(Base):
    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, index=True)
    
    # E aplicamos aqui também
    data_evento = Column(TimestampTZ, nullable=False, index=True) 
    
    descricao = Column(Text, nullable=True)
    tipo_evento = Column(Enum(TipoEventoEnum), nullable=False, default=TipoEventoEnum.outro)
    alerta_status = Column(Enum(AlertaStatusEnum), nullable=False, default=AlertaStatusEnum.pendente)
    processo_id = Column(Integer, ForeignKey("processos.id"), nullable=False)
    
    processo = relationship("Processo", back_populates="eventos") 