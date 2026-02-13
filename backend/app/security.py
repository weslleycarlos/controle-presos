import os
import logging
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Optional


load_dotenv()
logger = logging.getLogger(__name__)

# --- Configuração do Token (JWT) ---
ENVIRONMENT = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
IS_PRODUCTION = ENVIRONMENT in {"production", "prod"}

SECRET_KEY = os.getenv("SECRET_KEY")

if IS_PRODUCTION:
    if not SECRET_KEY or len(SECRET_KEY) < 32:
        raise RuntimeError(
            "SECRET_KEY ausente ou fraca para produção. Defina SECRET_KEY com no mínimo 32 caracteres."
        )
else:
    if not SECRET_KEY:
        SECRET_KEY = "dev-insecure-secret-key-change-me"
        logger.warning("Usando SECRET_KEY de desenvolvimento. Defina SECRET_KEY no ambiente.")
    elif len(SECRET_KEY) < 32:
        logger.warning("SECRET_KEY de desenvolvimento com menos de 32 caracteres.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 2 # 2 horas

# --- Configuração de Senha ---
# Usamos bcrypt para "hashear" as senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class TokenData(BaseModel):
    cpf: Optional[str] = None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto puro bate com o hash salvo."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Gera um hash para a senha em texto puro."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um novo token JWT."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    """Decodifica um token e retorna o CPF (subject) se for válido."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        cpf: Optional[str] = payload.get("sub")
        if cpf is None:
            return None
        # (Opcional: verificar se o TokenData(cpf=cpf) é válido)
        return cpf
    except JWTError:
        return None