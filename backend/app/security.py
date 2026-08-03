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


def _env_int(nome: str, padrao: int, minimo: int, maximo: int) -> int:
    """Lê um inteiro do ambiente mantendo-o dentro de limites sensatos."""
    bruto = os.getenv(nome)
    if not bruto:
        return padrao
    try:
        valor = int(bruto)
    except ValueError:
        logger.warning("%s inválido (%r); usando padrão %s.", nome, bruto, padrao)
        return padrao
    if valor < minimo or valor > maximo:
        logger.warning(
            "%s fora do intervalo permitido (%s-%s); usando padrão %s.",
            nome, minimo, maximo, padrao
        )
        return padrao
    return valor


# Janela de inatividade: a sessão morre se ficar este tempo sem nenhuma requisição.
ACCESS_TOKEN_EXPIRE_MINUTES = _env_int("SESSION_IDLE_MINUTES", 30, 5, 240)

# Teto absoluto: mesmo em uso contínuo, a sessão termina depois deste tempo.
SESSION_ABSOLUTE_HOURS = _env_int("SESSION_ABSOLUTE_HOURS", 12, 1, 72)

# Renova o token quando já se passou esta fração da janela de inatividade.
SESSION_RENEW_AFTER_RATIO = 0.5

# --- Configuração de Senha ---
# Usamos bcrypt para "hashear" as senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt trunca em 72 bytes; acima disso o excedente é silenciosamente ignorado.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_LENGTH = 8


class TokenData(BaseModel):
    cpf: Optional[str] = None


class TokenPayload(BaseModel):
    """Dados extraídos de um token válido."""

    cpf: str
    token_version: int = 1
    emitido_em: Optional[datetime] = None
    sessao_iniciada_em: Optional[datetime] = None
    expira_em: Optional[datetime] = None


def validar_forca_senha(senha: str) -> Optional[str]:
    """
    Retorna uma mensagem de erro se a senha for fraca, ou None se estiver ok.
    Regras propositalmente simples: comprimento mínimo e variedade básica.
    """
    if len(senha) < MIN_PASSWORD_LENGTH:
        return f"A senha deve ter pelo menos {MIN_PASSWORD_LENGTH} caracteres."
    if len(senha.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return "A senha é longa demais (máximo de 72 bytes)."
    if senha.isdigit() or senha.isalpha():
        return "A senha deve combinar letras e números."
    return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto puro bate com o hash salvo."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        # Hash malformado no banco não deve derrubar o login com um 500.
        logger.warning("Hash de senha inválido encontrado ao verificar credenciais.")
        return False

def get_password_hash(password: str) -> str:
    """Gera um hash para a senha em texto puro."""
    return pwd_context.hash(password)

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    sessao_iniciada_em: Optional[datetime] = None,
) -> str:
    """
    Cria um novo token JWT.

    'sessao_iniciada_em' preserva o início real da sessão entre renovações,
    permitindo aplicar o teto absoluto mesmo com uso contínuo.
    """
    to_encode = data.copy()
    agora = datetime.now(timezone.utc)
    if expires_delta:
        expire = agora + expires_delta
    else:
        expire = agora + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    inicio_sessao = sessao_iniciada_em or agora
    to_encode.update({
        "exp": expire,
        "iat": agora,
        "sid_iat": int(inicio_sessao.timestamp()),
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    """Decodifica um token e retorna o CPF (subject) se for válido."""
    payload = decode_access_token_payload(token)
    return payload.cpf if payload else None


def decode_access_token_payload(token: str) -> Optional[TokenPayload]:
    """
    Decodifica o token e devolve os dados relevantes para validar a sessão.
    Retorna None se o token for inválido, expirado ou ultrapassar o teto absoluto.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    cpf: Optional[str] = payload.get("sub")
    if not cpf:
        return None

    def _to_datetime(valor) -> Optional[datetime]:
        if valor is None:
            return None
        try:
            return datetime.fromtimestamp(float(valor), tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            return None

    sessao_iniciada_em = _to_datetime(payload.get("sid_iat"))

    # Teto absoluto de sessão: independe de atividade.
    if sessao_iniciada_em is not None:
        idade = datetime.now(timezone.utc) - sessao_iniciada_em
        if idade > timedelta(hours=SESSION_ABSOLUTE_HOURS):
            return None

    try:
        token_version = int(payload.get("tv", 1))
    except (TypeError, ValueError):
        token_version = 1

    return TokenPayload(
        cpf=cpf,
        token_version=token_version,
        emitido_em=_to_datetime(payload.get("iat")),
        sessao_iniciada_em=sessao_iniciada_em,
        expira_em=_to_datetime(payload.get("exp")),
    )


def precisa_renovar_token(payload: TokenPayload) -> bool:
    """
    Indica se o token já consumiu boa parte da janela de inatividade e
    deve ser reemitido para manter a sessão viva enquanto houver uso.
    """
    if payload.expira_em is None:
        return False

    restante = payload.expira_em - datetime.now(timezone.utc)
    limite = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES) * SESSION_RENEW_AFTER_RATIO
    return restante < limite
