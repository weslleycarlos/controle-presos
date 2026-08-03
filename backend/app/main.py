from datetime import date
import logging
import os
import secrets
from . import crud, models, schemas
from .database import SessionLocal, engine, get_db
from fastapi import FastAPI, Depends, HTTPException, status, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from pydantic import BaseModel
from datetime import timedelta, datetime, timezone
from .security import (
    create_access_token,
    verify_password,
    validar_forca_senha,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    decode_access_token_payload,
    precisa_renovar_token,
)
from apscheduler.schedulers.background import BackgroundScheduler
from .integracoes import consultar_processo_externo, consultar_cpf_externo
from .notifications import send_email_alerts
from . import auditoria
from .migrations import run_lightweight_migrations

# Esta linha é crucial! Ela cria as tabelas no seu banco de dados
# com base no que definimos em models.py
models.Base.metadata.create_all(bind=engine)
run_lightweight_migrations(engine)

logger = logging.getLogger(__name__)
AUTH_COOKIE_NAME = "access_token"
CSRF_COOKIE_NAME = "csrf_token"
REFRESHED_TOKEN_HEADER = "X-Refreshed-Token"
IS_PRODUCTION = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower() in {"production", "prod"}
COOKIE_SAMESITE = "none" if IS_PRODUCTION else "lax"

# Bloqueio temporário por força bruta no login.
LOGIN_MAX_TENTATIVAS = 5
LOGIN_JANELA_MINUTOS = 15

# A documentação interativa expõe o mapa completo da API. Em produção ela fica
# desligada; em desenvolvimento continua disponível normalmente.
app = FastAPI(
    title="Sistema de Controle de Presos",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)


def _validar_cron_secret(request: Request):
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET não configurado no ambiente."
        )

    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "", 1).strip()

    if not token:
        token = request.headers.get("X-Cron-Secret", "").strip()

    # O segredo não é aceito por query string: URLs acabam em logs de acesso,
    # históricos de proxy e no próprio arquivo de configuração do cron.
    if not token or not secrets.compare_digest(token, cron_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autorizado para execução do job.")


def _bootstrap_admin_if_configured():
    auto_bootstrap = os.getenv("AUTO_BOOTSTRAP_ADMIN", "false").lower() in {"1", "true", "yes", "on"}
    if not auto_bootstrap:
        return

    admin_nome = (os.getenv("FIRST_ADMIN_NOME") or "").strip()
    admin_cpf = (os.getenv("FIRST_ADMIN_CPF") or "").strip()
    admin_email = (os.getenv("FIRST_ADMIN_EMAIL") or "").strip()
    admin_senha = os.getenv("FIRST_ADMIN_SENHA") or ""

    if not admin_nome or not admin_cpf or not admin_email or not admin_senha:
        logger.warning("AUTO_BOOTSTRAP_ADMIN ativo, mas FIRST_ADMIN_* incompleto. Bootstrap ignorado.")
        return

    if len(admin_cpf) != 11 or not admin_cpf.isdigit():
        logger.warning("FIRST_ADMIN_CPF inválido. Bootstrap ignorado.")
        return

    if len(admin_senha) < 8:
        logger.warning("FIRST_ADMIN_SENHA precisa ter no mínimo 8 caracteres. Bootstrap ignorado.")
        return

    db: Session = SessionLocal()
    try:
        admins_existentes = db.query(models.User).filter(models.User.role == "admin").count()
        if admins_existentes > 0:
            logger.info("Bootstrap de admin ignorado: já existe usuário admin.")
            return

        usuario_existente = crud.get_user_by_cpf(db, cpf=admin_cpf)
        if usuario_existente:
            usuario_existente.role = "admin"
            usuario_existente.is_active = True
            db.commit()
            logger.info("Bootstrap: usuário existente promovido para admin.")
            return

        admin_schema = schemas.UserCreate(
            nome_completo=admin_nome,
            cpf=admin_cpf,
            email=admin_email,
            password=admin_senha,
            role="admin",
            preferencia_tema="light",
        )
        crud.create_user(db=db, user=admin_schema)
        logger.info("Bootstrap: primeiro admin criado com sucesso.")
    except Exception:
        db.rollback()
        logger.exception("Falha no bootstrap automático do primeiro admin")
    finally:
        db.close()

# --- INÍCIO DA CONFIGURAÇÃO DO CORS ---
# Origens de produção sempre permitidas.
origins = [
    "https://controle-presos-front-production.up.railway.app", # Frontend em produção (Railway)
    "https://controle-presos.vercel.app", # Frontend em produção (Vercel)
]

# Endereços de desenvolvimento só entram fora de produção: em produção eles
# ampliariam a superfície de ataque sem nenhum ganho.
if not IS_PRODUCTION:
    origins.extend([
        "http://localhost:5173",
        "http://localhost",
        "http://127.0.0.1:5173",
    ])

origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
if origins_env:
    extra_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]
    for origin in extra_origins:
        if origin not in origins:
            origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    # Sem isto o navegador esconde estes cabeçalhos do JavaScript, quebrando a
    # paginação e a renovação silenciosa de sessão em requisições cross-origin.
    expose_headers=["X-Total-Count", "X-Week-Count", REFRESHED_TOKEN_HEADER],
)
# --- FIM DA CONFIGURAÇÃO DO CORS ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token", auto_error=False)


@app.get("/", include_in_schema=False)
def root():
    """
    Em produção não anunciamos a documentação; a raiz só confirma que a API
    está de pé. Em desenvolvimento, redireciona para o /docs por conveniência.
    """
    if IS_PRODUCTION:
        return {"status": "ok"}
    return RedirectResponse(url="/docs")


@app.middleware("http")
async def csrf_protection_middleware(request: Request, call_next):
    # O endpoint de job autentica por segredo próprio em cabeçalho, que um
    # navegador nunca anexa sozinho — logo, não há vetor de CSRF a proteger.
    csrf_exempt_paths = {
        "/api/token",
        "/api/logout",
        "/api/csrf-token",
        "/api/jobs/check-alertas",
    }
    if (
        request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and request.url.path.startswith("/api")
        and request.url.path not in csrf_exempt_paths
    ):
        auth_header = request.headers.get("Authorization", "")
        has_bearer_auth = auth_header.startswith("Bearer ")
        session_cookie = request.cookies.get(AUTH_COOKIE_NAME)
        # CSRF é obrigatório apenas para autenticação baseada em cookie.
        if session_cookie and not has_bearer_auth:
            csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
            csrf_header = request.headers.get("X-CSRF-Token")
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                return JSONResponse(status_code=403, content={"detail": "CSRF token inválido."})
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response

def _definir_cookie_sessao(response: Response, nome: str, valor: str, httponly: bool):
    """Grava um cookie de sessão com os atributos de segurança do ambiente."""
    response.set_cookie(
        key=nome,
        value=valor,
        httponly=httponly,
        secure=IS_PRODUCTION,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


async def get_current_user(
    request: Request,
    response: Response,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Dependência para obter o usuário logado a partir do token.

    Além de validar, mantém a sessão viva enquanto houver atividade: quando o
    token se aproxima do fim da janela de inatividade, um novo é emitido.
    """
    access_token = token
    if not access_token:
        access_token = request.cookies.get(AUTH_COOKIE_NAME)

    if access_token and access_token.startswith("Bearer "):
        access_token = access_token.replace("Bearer ", "", 1)

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token_payload(access_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada ou inválida. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = crud.get_user_by_cpf(db, cpf=payload.cpf)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário inativo")

    # Token emitido antes da última troca de senha não vale mais.
    if payload.token_version != (user.token_version or 1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão encerrada porque a senha foi alterada. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if precisa_renovar_token(payload):
        novo_token = create_access_token(
            data={"sub": user.cpf, "role": user.role, "tv": user.token_version or 1},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            sessao_iniciada_em=payload.sessao_iniciada_em,
        )
        _definir_cookie_sessao(response, AUTH_COOKIE_NAME, novo_token, httponly=True)
        # Clientes que usam Bearer leem o token renovado por este cabeçalho.
        response.headers[REFRESHED_TOKEN_HEADER] = novo_token

    return user

# --- 1. ADICIONE ESTA NOVA FUNÇÃO (dependência de admin) ---
# (Coloque-a logo após a função 'get_current_user')
def get_current_admin_user(
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifica se o usuário logado é um admin.
    Se não for, levanta um erro 403 (Forbidden).
    """
    if current_user.role != "admin":
        auditoria.registrar(
            db,
            auditoria.ACESSO_NEGADO,
            request=request,
            usuario=current_user,
            sucesso=False,
            detalhe=f"Tentativa de acesso a recurso restrito: {request.method} {request.url.path}",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores"
        )
    return current_user

@app.post("/api/users/", response_model=schemas.User, tags=["Autenticação"])
def create_new_user(
    user: schemas.UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # <-- NOVA LINHA
):
    """
    Cria um novo usuário. (Protegido - Apenas Admins)
    """
    erro_senha = validar_forca_senha(user.password)
    if erro_senha:
        raise HTTPException(status_code=400, detail=erro_senha)

    db_user = crud.get_user_by_cpf(db, cpf=user.cpf)
    if db_user:
        raise HTTPException(status_code=400, detail="CPF já cadastrado")

    novo_usuario = crud.create_user(db=db, user=user)
    auditoria.registrar(
        db,
        auditoria.USUARIO_CRIADO,
        request=request,
        usuario=admin_user,
        entidade="usuario",
        entidade_id=novo_usuario.id,
        detalhe=f"Criou o usuário '{novo_usuario.nome_completo}' com papel '{novo_usuario.role}'.",
    )
    return novo_usuario

@app.post("/api/token", response_model=schemas.Token, tags=["Autenticação"])
def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Endpoint de Login. Recebe CPF (no campo 'username') e Senha.
    Retorna um Token JWT.
    """
    # O form_data usa 'username', vamos usá-lo para o nosso 'cpf'
    cpf_informado = (form_data.username or "").strip()
    ip_origem = auditoria.extrair_ip(request)

    # Bloqueio temporário após tentativas malsucedidas seguidas.
    falhas_recentes = auditoria.contar_falhas_login_recentes(
        db,
        cpf=cpf_informado,
        ip=ip_origem,
        janela_minutos=LOGIN_JANELA_MINUTOS,
    )
    if falhas_recentes >= LOGIN_MAX_TENTATIVAS:
        auditoria.registrar(
            db,
            auditoria.LOGIN_FALHA,
            request=request,
            usuario_cpf=cpf_informado,
            sucesso=False,
            detalhe="Login bloqueado temporariamente por excesso de tentativas.",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Muitas tentativas de login. Aguarde {LOGIN_JANELA_MINUTOS} minutos "
                "antes de tentar novamente."
            ),
        )

    user = crud.get_user_by_cpf(db, cpf=cpf_informado)

    # Verifica se o usuário existe e se a senha está correta
    if not user or not verify_password(form_data.password, user.hashed_password):
        auditoria.registrar(
            db,
            auditoria.LOGIN_FALHA,
            request=request,
            usuario_cpf=cpf_informado,
            sucesso=False,
            detalhe="CPF ou senha incorretos.",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="CPF ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        auditoria.registrar(
            db,
            auditoria.LOGIN_FALHA,
            request=request,
            usuario=user,
            sucesso=False,
            detalhe="Tentativa de login em conta inativa.",
        )
        raise HTTPException(status_code=403, detail="Usuário inativo")

    # Cria o token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.cpf, "role": user.role, "tv": user.token_version or 1},
        expires_delta=access_token_expires
    )
    csrf_token = secrets.token_urlsafe(32)

    _definir_cookie_sessao(response, AUTH_COOKIE_NAME, access_token, httponly=True)
    _definir_cookie_sessao(response, CSRF_COOKIE_NAME, csrf_token, httponly=False)

    auditoria.registrar(
        db,
        auditoria.LOGIN_SUCESSO,
        request=request,
        usuario=user,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/logout", tags=["Autenticação"])
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    # O logout não exige sessão válida, então identificamos o autor pelo token
    # apenas para fins de registro — sem bloquear a limpeza dos cookies.
    token = request.cookies.get(AUTH_COOKIE_NAME)
    auth_header = request.headers.get("Authorization", "")
    if not token and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "", 1)

    if token:
        payload = decode_access_token_payload(token)
        if payload:
            usuario = crud.get_user_by_cpf(db, cpf=payload.cpf)
            if usuario:
                auditoria.registrar(db, auditoria.LOGOUT, request=request, usuario=usuario)

    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return {"message": "Logout realizado com sucesso."}


@app.get("/api/csrf-token", tags=["Autenticação"])
def get_csrf_token(request: Request, response: Response):
    csrf_token = request.cookies.get(CSRF_COOKIE_NAME) or secrets.token_urlsafe(32)
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=IS_PRODUCTION,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return {"csrf_token": csrf_token}

# --- Endpoints de Preso ---

# --- NOVO ENDPOINT DE CADASTRO COMPLETO ---
@app.post("/api/cadastro-completo", response_model=schemas.Preso, tags=["Presos"])
def create_preso_e_processo(
    cadastro: schemas.PresoCadastroCompleto,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <-- ROTA PROTEGIDA
):
    """
    Cria um novo preso e seus processos iniciais.
    Exige autenticação.
    """
    # (Opcional: verificar se o 'current_user' tem permissão de cadastro)

    try:
        novo_preso = crud.create_preso_completo(db=db, cadastro=cadastro)
        auditoria.registrar(
            db,
            auditoria.PRESO_CRIADO,
            request=request,
            usuario=current_user,
            entidade="preso",
            entidade_id=novo_preso.id,
            detalhe=(
                f"Cadastrou '{novo_preso.nome_completo}' com "
                f"{len(cadastro.processos)} processo(s)."
            ),
        )
        return novo_preso
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Dados inválidos ou conflitantes para cadastro.")
    except Exception:
        db.rollback()
        logger.exception("Falha ao criar cadastro completo")
        raise HTTPException(status_code=500, detail="Não foi possível concluir o cadastro no momento.")

@app.post("/api/presos/", response_model=schemas.Preso, tags=["Presos"])
def create_preso(
    preso: schemas.PresoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verifica se o CPF já existe
    if preso.cpf:
        db_preso = crud.get_preso_by_cpf(db, cpf=preso.cpf)
        if db_preso:
            raise HTTPException(status_code=400, detail="CPF já cadastrado")

    novo_preso = crud.create_preso(db=db, preso=preso)
    auditoria.registrar(
        db,
        auditoria.PRESO_CRIADO,
        request=request,
        usuario=current_user,
        entidade="preso",
        entidade_id=novo_preso.id,
        detalhe=f"Cadastrou '{novo_preso.nome_completo}'.",
    )
    return novo_preso


@app.get("/api/presos/status-processuais", response_model=List[str], tags=["Presos"])
def listar_status_processuais(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Lista os status processuais em uso no banco.

    O campo é digitado livremente no cadastro, então os filtros precisam
    refletir o que existe de fato — não uma lista fixa.
    """
    return crud.get_status_processuais(db)

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

@app.get("/api/relatorios/completo", response_model=List[schemas.PresoDetalhe], tags=["Relatórios"])
def get_relatorio_completo(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    nome: Optional[str] = None,
    status_processual: Optional[str] = None,
    data_prisao: Optional[date] = None,
):
    return crud.search_presos(
        db=db,
        nome=nome,
        status_processual=status_processual,
        data_prisao=data_prisao,
        skip=0,
        limit=10000,
    )

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
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # (Poderia checar se o preso_id existe primeiro, mas o FK do banco já vai barrar)
    novo_processo = crud.create_processo(db=db, processo=processo, preso_id=preso_id)
    auditoria.registrar(
        db,
        auditoria.PROCESSO_CRIADO,
        request=request,
        usuario=current_user,
        entidade="processo",
        entidade_id=novo_processo.id,
        detalhe=f"Criou o processo '{novo_processo.numero_processo}' para o preso #{preso_id}.",
    )
    return novo_processo

# --- Endpoints de Evento ---

@app.post("/api/processos/{processo_id}/eventos/", response_model=schemas.Evento, tags=["Eventos"])
def create_evento_for_processo(
    processo_id: int,
    evento: schemas.EventoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <-- ADICIONE A PROTEÇÃO
):
    # (Opcional: checar se o usuário tem permissão para este processo)
    novo_evento = crud.create_evento(db=db, evento=evento, processo_id=processo_id)
    _sincronizar_alertas_status(db)
    db.refresh(novo_evento)
    auditoria.registrar(
        db,
        auditoria.EVENTO_CRIADO,
        request=request,
        usuario=current_user,
        entidade="evento",
        entidade_id=novo_evento.id,
        detalhe=f"Criou evento '{novo_evento.tipo_evento.value}' no processo #{processo_id}.",
    )
    return novo_evento

@app.put("/api/eventos/{evento_id}", response_model=schemas.Evento, tags=["Eventos"])
def update_evento(
    evento_id: int,
    evento_update: schemas.EventoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_evento = crud.update_evento(db=db, evento_id=evento_id, evento_update=evento_update)
    if not db_evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    _sincronizar_alertas_status(db)
    auditoria.registrar(
        db,
        auditoria.EVENTO_ATUALIZADO,
        request=request,
        usuario=current_user,
        entidade="evento",
        entidade_id=evento_id,
        detalhe=f"Atualizou evento '{db_evento.tipo_evento.value}'.",
    )
    return db_evento

@app.delete("/api/eventos/{evento_id}", status_code=204, tags=["Eventos"])
def delete_evento(
    evento_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user)
):
    """Exclui um evento. (Protegido - Apenas Admins)"""
    db_evento = crud.delete_evento(db=db, evento_id=evento_id)
    if not db_evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    _sincronizar_alertas_status(db)
    auditoria.registrar(
        db,
        auditoria.EVENTO_EXCLUIDO,
        request=request,
        usuario=admin_user,
        entidade="evento",
        entidade_id=evento_id,
        detalhe=f"Excluiu evento '{db_evento.tipo_evento.value}' do processo #{db_evento.processo_id}.",
    )
    return None

# --- Endpoint de Alerta (O MVP do seu sistema de alertas) ---
# (A lógica de background ainda não está aqui, mas o endpoint de consulta está)

@app.get("/api/alertas/proximos", response_model=List[schemas.Evento], tags=["Alertas"])
def get_proximos_alertas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retorna todos os eventos com status 'pendente' ou 'disparado'
    que ainda não aconteceram, ordenados pelo mais próximo.
    """
    _sincronizar_alertas_status(db)
    agora = datetime.now(timezone.utc)
    eventos = db.query(models.Evento).filter(
        models.Evento.alerta_status.in_([models.AlertaStatusEnum.pendente, models.AlertaStatusEnum.disparado])
    ).order_by(models.Evento.data_evento.asc()).limit(50).all()
    
    return eventos

# --- LÓGICA DO JOB AGENDADO (ROBÔ) ---


def _sincronizar_alertas_status(db: Session) -> list[models.Evento]:
    """
    Atualiza eventos pendentes para 'disparado' quando estiverem
    dentro da janela de 7 dias.
    """
    agora = datetime.now(timezone.utc)
    limite_dias = agora + timedelta(days=7)

    eventos_para_alertar = db.query(models.Evento).options(
        joinedload(models.Evento.processo).joinedload(models.Processo.preso)
    ).filter(
        models.Evento.data_evento <= limite_dias,
        models.Evento.alerta_status == models.AlertaStatusEnum.pendente
    ).all()

    if not eventos_para_alertar:
        return []

    for evento in eventos_para_alertar:
        evento.alerta_status = models.AlertaStatusEnum.disparado

    db.commit()
    return eventos_para_alertar

def check_alertas_job():
    """
    Função que o Scheduler rodará.
    Verifica eventos nos próximos 7 dias e muda o status para 'disparado'.
    """
    logger.info("Rodando job de verificação de alertas")
    db: Session = SessionLocal() # O Job precisa criar sua própria sessão de DB
    try:
        resultado = executar_job_alertas(db)
        if resultado["alertas_disparados"] == 0:
            logger.info("Nenhum novo alerta para disparar")
            return

        logger.info(
            "Job finalizado. %s alertas atualizados para 'disparado'.",
            resultado["alertas_disparados"]
        )
        if resultado["email_status"] == "enviado":
            logger.info("E-mail de alertas enviado para %s usuário(s)", resultado["emails_enviados"])
        elif resultado["email_status"] == "falha_envio":
            logger.warning("E-mail de alertas não foi enviado; verifique configuração SMTP")

    except Exception:
        logger.exception("Erro no job de alertas")
        db.rollback()
    finally:
        db.close()


def executar_job_alertas(db: Session) -> dict:
    eventos_para_alertar = _sincronizar_alertas_status(db)

    if not eventos_para_alertar:
        return {
            "alertas_disparados": 0,
            "emails_enviados": 0,
            "email_status": "nenhum_alerta",
        }

    usuarios_para_notificar = crud.get_users_for_email_alerts(db)
    destinatarios = [usuario.email for usuario in usuarios_para_notificar if usuario.email]

    email_status = "nao_configurado_ou_sem_destinatarios"
    emails_enviados = 0
    if destinatarios:
        total_alertas = len(eventos_para_alertar)
        alertas_preview = []
        for evento in eventos_para_alertar[:20]:
            numero_processo = evento.processo.numero_processo if evento.processo else "-"
            nome_preso = "-"
            if evento.processo and evento.processo.preso:
                nome_preso = evento.processo.preso.nome_completo
            data_evento = evento.data_evento.strftime("%d/%m/%Y %H:%M")
            alertas_preview.append(
                f"- {data_evento} | {evento.tipo_evento.value} | Proc. {numero_processo} | {nome_preso}"
            )

        mensagem = [
            "Novos alertas processuais foram disparados no Sistema de Controle de Presos.",
            "",
            f"Total de alertas: {total_alertas}",
            "",
            "Prévia (até 20):",
            *alertas_preview,
            "",
            "Acesse o sistema para ver todos os detalhes.",
        ]

        enviado = send_email_alerts(
            recipients=destinatarios,
            subject=f"[Controle de Presos] {total_alertas} novo(s) alerta(s) processual(is)",
            body="\n".join(mensagem),
        )
        if enviado:
            email_status = "enviado"
            emails_enviados = len(destinatarios)
        else:
            email_status = "falha_envio"

    return {
        "alertas_disparados": len(eventos_para_alertar),
        "emails_enviados": emails_enviados,
        "email_status": email_status,
    }


@app.post("/api/jobs/check-alertas", tags=["Jobs"])
def executar_job_alertas_endpoint(
    request: Request,
    db: Session = Depends(get_db),
):
    _validar_cron_secret(request)

    try:
        resultado = executar_job_alertas(db)
        return {
            "status": "ok",
            **resultado,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Erro ao executar job de alertas por endpoint")
        db.rollback()
        raise HTTPException(status_code=500, detail="Falha ao executar job de alertas.")


@app.on_event("startup")
def start_scheduler():
    """
    Inicia o Scheduler quando o FastAPI é iniciado.
    """
    _bootstrap_admin_if_configured()

    if os.getenv("VERCEL"):
        logger.info("Ambiente Vercel detectado: scheduler desativado.")
        return

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
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user), # Protegido
    skip: int = Query(default=0, ge=0, le=100000),
    limit: Optional[int] = Query(default=None, ge=1, le=100)
):
    """
    Retorna todos os eventos que foram "disparados" e ainda não venceram.
    """
    _sincronizar_alertas_status(db)
    agora = datetime.now(timezone.utc)
    
    base_query = db.query(models.Evento).filter(
        models.Evento.alerta_status == models.AlertaStatusEnum.disparado
    )

    total_alertas = base_query.count()
    limite_semana = agora + timedelta(days=7)
    total_semana = base_query.filter(models.Evento.data_evento <= limite_semana).count()

    response.headers["X-Total-Count"] = str(total_alertas)
    response.headers["X-Week-Count"] = str(total_semana)

    query = db.query(models.Evento).options(
        joinedload(models.Evento.processo).joinedload(models.Processo.preso)
    ).filter(
        models.Evento.alerta_status == models.AlertaStatusEnum.disparado
    ).order_by(
        models.Evento.data_evento.asc()
    )

    if skip:
        query = query.offset(skip)
    
    # --- 2. APLIQUE O LIMITE SE ELE FOR FORNECIDO ---
    if limit is not None:
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
    request: Request,
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

    status_anterior = db_evento.alerta_status.value
    db_evento.alerta_status = status_update.status
    db.commit()
    db.refresh(db_evento)
    auditoria.registrar(
        db,
        auditoria.EVENTO_STATUS_ALTERADO,
        request=request,
        usuario=current_user,
        entidade="evento",
        entidade_id=evento_id,
        detalhe=f"Status alterado de '{status_anterior}' para '{status_update.status.value}'.",
    )
    return db_evento

# --- NOVOS ENDPOINTS DE UPDATE (PUT) E DELETE ---

@app.put("/api/presos/{preso_id}", response_model=schemas.Preso, tags=["Presos"])
def update_preso_endpoint(
    preso_id: int,
    preso_update: schemas.PresoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protegido
):
    """Atualiza os dados de um preso."""
    db_preso = crud.update_preso(db, preso_id=preso_id, preso_update=preso_update)
    if db_preso is None:
        raise HTTPException(status_code=404, detail="Preso não encontrado")
    auditoria.registrar(
        db,
        auditoria.PRESO_ATUALIZADO,
        request=request,
        usuario=current_user,
        entidade="preso",
        entidade_id=preso_id,
        detalhe=f"Atualizou os dados de '{db_preso.nome_completo}'.",
    )
    return db_preso


@app.put("/api/processos/{processo_id}", response_model=schemas.Processo, tags=["Processos"])
def update_processo_endpoint(
    processo_id: int,
    processo_update: schemas.ProcessoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Protegido
):
    """Atualiza os dados de um processo."""
    db_processo = crud.update_processo(db, processo_id=processo_id, processo_update=processo_update)
    if db_processo is None:
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    auditoria.registrar(
        db,
        auditoria.PROCESSO_ATUALIZADO,
        request=request,
        usuario=current_user,
        entidade="processo",
        entidade_id=processo_id,
        detalhe=f"Atualizou o processo '{db_processo.numero_processo}'.",
    )
    return db_processo


@app.delete("/api/presos/{preso_id}", response_model=schemas.Preso, tags=["Presos"])
def delete_preso_endpoint(
    preso_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user)
):
    """
    Deleta um preso e todos os seus dados associados.
    (Protegido - Apenas Admins, pois a exclusão é em cascata e irreversível.)
    """
    db_preso = crud.delete_preso(db, preso_id=preso_id)
    if db_preso is None:
        raise HTTPException(status_code=404, detail="Preso não encontrado")
    auditoria.registrar(
        db,
        auditoria.PRESO_EXCLUIDO,
        request=request,
        usuario=admin_user,
        entidade="preso",
        entidade_id=preso_id,
        detalhe=f"Excluiu '{db_preso.nome_completo}' e todos os processos/eventos vinculados.",
    )
    return db_preso

@app.get("/api/users/me", response_model=schemas.User, tags=["Usuário"])
def read_users_me(
    current_user: models.User = Depends(get_current_user)
):
    """Retorna os dados do usuário logado."""
    return current_user


@app.get("/api/users/me/notificacoes", response_model=schemas.UserNotificationPreference, tags=["Usuário"])
def read_users_me_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna preferências de notificação do usuário logado."""
    pref = crud.get_user_notification_preference(db=db, user_id=current_user.id)
    if pref is None:
        return schemas.UserNotificationPreference(receber_alertas_email=False)
    return pref


@app.put("/api/users/me/notificacoes", response_model=schemas.UserNotificationPreference, tags=["Usuário"])
def update_users_me_notifications(
    payload: schemas.UserNotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza preferências de notificação do usuário logado."""
    return crud.upsert_user_notification_preference(
        db=db,
        user_id=current_user.id,
        receber_alertas_email=payload.receber_alertas_email,
    )


@app.put("/api/users/me", response_model=schemas.User, tags=["Usuário"])
def update_users_me(
    user_in: schemas.UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Atualiza o nome e/ou email do usuário logado."""
    usuario = crud.update_user_profile(db=db, db_user=current_user, user_in=user_in)
    auditoria.registrar(
        db,
        auditoria.PERFIL_ATUALIZADO,
        request=request,
        usuario=current_user,
        entidade="usuario",
        entidade_id=current_user.id,
        detalhe="Atualizou os próprios dados de perfil.",
    )
    return usuario


@app.put("/api/users/me/password", tags=["Usuário"])
def change_users_me_password(
    password_data: schemas.PasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Muda a senha do usuário logado."""
    # 1. Verifica se a senha antiga está correta
    if not verify_password(password_data.senha_antiga, current_user.hashed_password):
        auditoria.registrar(
            db,
            auditoria.USUARIO_SENHA_ALTERADA,
            request=request,
            usuario=current_user,
            entidade="usuario",
            entidade_id=current_user.id,
            sucesso=False,
            detalhe="Troca de senha recusada: senha antiga incorreta.",
        )
        raise HTTPException(status_code=400, detail="Senha antiga incorreta.")

    # 2. Verifica a força da nova senha
    erro_senha = validar_forca_senha(password_data.nova_senha)
    if erro_senha:
        raise HTTPException(status_code=400, detail=erro_senha)

    # 3. Atualiza a senha
    crud.update_user_password(db=db, db_user=current_user, nova_senha=password_data.nova_senha)
    auditoria.registrar(
        db,
        auditoria.USUARIO_SENHA_ALTERADA,
        request=request,
        usuario=current_user,
        entidade="usuario",
        entidade_id=current_user.id,
        detalhe="Alterou a própria senha. Sessões anteriores foram encerradas.",
    )
    return {"message": "Senha atualizada com sucesso."}

# --- NOVO ENDPOINT DE LISTAR USUÁRIOS ---
@app.get("/api/users/", response_model=List[schemas.User], tags=["Usuário"])
def read_users(
    response: Response,
    skip: int = Query(default=0, ge=0, le=10000),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # Protegido
):
    """
    Retorna uma lista de todos os usuários. (Apenas Admins)
    """
    total_users = db.query(models.User).count()
    response.headers["X-Total-Count"] = str(total_users)
    users = crud.get_users(db, skip=skip, limit=limit)
    return users


# --- NOVO ENDPOINT DE RESET DE SENHA (ADMIN) ---
@app.post("/api/users/{user_id}/reset-password", tags=["Usuário"])
def admin_reset_user_password(
    user_id: int,
    password_data: schemas.AdminPasswordReset,
    request: Request,
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
    erro_senha = validar_forca_senha(password_data.nova_senha)
    if erro_senha:
        raise HTTPException(status_code=400, detail=erro_senha)

    # 4. Atualiza a senha (reutilizando nossa função de crud)
    crud.update_user_password(db=db, db_user=db_user, nova_senha=password_data.nova_senha)
    auditoria.registrar(
        db,
        auditoria.USUARIO_SENHA_RESETADA,
        request=request,
        usuario=admin_user,
        entidade="usuario",
        entidade_id=db_user.id,
        detalhe=(
            f"Resetou a senha de '{db_user.nome_completo}' (CPF {db_user.cpf}). "
            "As sessões desse usuário foram encerradas."
        ),
    )
    return {"message": f"Senha do usuário '{db_user.nome_completo}' atualizada com sucesso."}

# --- NOVO ENDPOINT DE EDIÇÃO (ADMIN) ---
@app.put("/api/users/{user_id}", response_model=schemas.User, tags=["Usuário"])
def update_user_by_admin_endpoint(
    user_id: int,
    user_in: schemas.UserUpdate, # O schema só permite mudar nome, email e tema
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user) # Protegido
):
    """
    Permite que um admin atualize nome, email ou tema de um usuário.
    """
    try:
        updated_user = crud.update_user_by_admin(db, user_id=user_id, user_in=user_in)
        auditoria.registrar(
            db,
            auditoria.USUARIO_ATUALIZADO,
            request=request,
            usuario=admin_user,
            entidade="usuario",
            entidade_id=user_id,
            detalhe=f"Atualizou os dados de '{updated_user.nome_completo}'.",
        )
        return updated_user
    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Falha ao atualizar usuário por admin")
        raise HTTPException(status_code=500, detail="Não foi possível atualizar o usuário no momento.")


# --- Auditoria (Apenas Admins) ---


@app.get("/api/logs", response_model=List[schemas.LogAuditoria], tags=["Auditoria"])
def listar_logs_auditoria(
    response: Response,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
    skip: int = Query(default=0, ge=0, le=100000),
    limit: int = Query(default=50, ge=1, le=200),
    acao: Optional[str] = None,
    usuario_cpf: Optional[str] = None,
    entidade: Optional[str] = None,
    sucesso: Optional[bool] = None,
    data_inicio: Optional[datetime] = None,
    data_fim: Optional[datetime] = None,
):
    """
    Lista a trilha de auditoria, da mais recente para a mais antiga.
    (Protegido - Apenas Admins)
    """
    itens, total = auditoria.listar_logs(
        db,
        skip=skip,
        limit=limit,
        acao=acao,
        usuario_cpf=usuario_cpf,
        entidade=entidade,
        sucesso=sucesso,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
    response.headers["X-Total-Count"] = str(total)
    return itens


@app.get("/api/logs/acoes", response_model=List[schemas.AcaoAuditoria], tags=["Auditoria"])
def listar_acoes_auditoria(
    admin_user: models.User = Depends(get_current_admin_user),
):
    """Lista as ações registráveis com rótulos legíveis, para montar filtros."""
    return [
        schemas.AcaoAuditoria(valor=valor, rotulo=rotulo)
        for valor, rotulo in auditoria.ACOES_DISPONIVEIS.items()
    ]


@app.post(
    "/api/integracoes/processos/consultar",
    response_model=schemas.ProcessoConsultaIntegracaoResponse,
    tags=["Integrações"]
)
def consultar_processo_integracoes(
    payload: schemas.ProcessoConsultaIntegracaoRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    auditoria.registrar(
        db,
        auditoria.INTEGRACAO_CONSULTADA,
        request=request,
        usuario=current_user,
        entidade="processo",
        detalhe=f"Consultou o processo '{payload.numero_processo}' nas fontes: {', '.join(payload.fontes)}.",
    )
    try:
        return consultar_processo_externo(
            numero_processo=payload.numero_processo,
            fontes=payload.fontes,
            tribunal=payload.tribunal,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Erro inesperado ao consultar integrações externas")
        raise HTTPException(status_code=500, detail="Falha ao consultar integração externa.")


@app.post(
    "/api/integracoes/cpf/consultar",
    response_model=schemas.PessoaConsultaCPFResponse,
    tags=["Integrações"]
)
def consultar_cpf_integracao(
    payload: schemas.PessoaConsultaCPFRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Consulta de dados pessoais por CPF é sensível: fica sempre registrada.
    auditoria.registrar(
        db,
        auditoria.INTEGRACAO_CONSULTADA,
        request=request,
        usuario=current_user,
        entidade="pessoa",
        detalhe=f"Consultou dados pessoais do CPF '{payload.cpf}' em integração externa.",
    )
    try:
        return consultar_cpf_externo(cpf=payload.cpf)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Erro inesperado ao consultar integração de CPF")
        raise HTTPException(status_code=500, detail="Falha ao consultar integração de CPF.")