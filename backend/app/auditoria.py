"""
Trilha de auditoria da aplicação.

Registrar um evento nunca deve derrubar a operação que o originou: todas as
falhas de gravação são engolidas e apenas logadas. Auditoria é observabilidade,
não regra de negócio.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models

logger = logging.getLogger(__name__)

MAX_DETALHE = 2000
MAX_USER_AGENT = 400

# --- Ações registradas ---
LOGIN_SUCESSO = "login_sucesso"
LOGIN_FALHA = "login_falha"
LOGOUT = "logout"
USUARIO_CRIADO = "usuario_criado"
USUARIO_ATUALIZADO = "usuario_atualizado"
USUARIO_SENHA_ALTERADA = "usuario_senha_alterada"
USUARIO_SENHA_RESETADA = "usuario_senha_resetada"
PERFIL_ATUALIZADO = "perfil_atualizado"
PRESO_CRIADO = "preso_criado"
PRESO_ATUALIZADO = "preso_atualizado"
PRESO_EXCLUIDO = "preso_excluido"
PROCESSO_CRIADO = "processo_criado"
PROCESSO_ATUALIZADO = "processo_atualizado"
EVENTO_CRIADO = "evento_criado"
EVENTO_ATUALIZADO = "evento_atualizado"
EVENTO_EXCLUIDO = "evento_excluido"
EVENTO_STATUS_ALTERADO = "evento_status_alterado"
INTEGRACAO_CONSULTADA = "integracao_consultada"
JOB_EXECUTADO = "job_executado"
ACESSO_NEGADO = "acesso_negado"

# Rótulos amigáveis para a tela de auditoria.
ACOES_DISPONIVEIS = {
    LOGIN_SUCESSO: "Login realizado",
    LOGIN_FALHA: "Tentativa de login falhou",
    LOGOUT: "Logout",
    USUARIO_CRIADO: "Usuário criado",
    USUARIO_ATUALIZADO: "Usuário atualizado",
    USUARIO_SENHA_ALTERADA: "Senha alterada pelo próprio usuário",
    USUARIO_SENHA_RESETADA: "Senha resetada por admin",
    PERFIL_ATUALIZADO: "Perfil atualizado",
    PRESO_CRIADO: "Preso cadastrado",
    PRESO_ATUALIZADO: "Preso atualizado",
    PRESO_EXCLUIDO: "Preso excluído",
    PROCESSO_CRIADO: "Processo criado",
    PROCESSO_ATUALIZADO: "Processo atualizado",
    EVENTO_CRIADO: "Evento criado",
    EVENTO_ATUALIZADO: "Evento atualizado",
    EVENTO_EXCLUIDO: "Evento excluído",
    EVENTO_STATUS_ALTERADO: "Status de evento alterado",
    INTEGRACAO_CONSULTADA: "Integração externa consultada",
    JOB_EXECUTADO: "Job automático executado",
    ACESSO_NEGADO: "Acesso negado",
}


def extrair_ip(request: Optional[Request]) -> Optional[str]:
    """
    Descobre o IP de origem considerando proxies (Vercel/Railway ficam na frente).
    Usa o primeiro endereço do X-Forwarded-For, que é o cliente original.
    """
    if request is None:
        return None

    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        primeiro = encaminhado.split(",")[0].strip()
        if primeiro:
            return primeiro[:64]

    ip_real = request.headers.get("x-real-ip")
    if ip_real:
        return ip_real.strip()[:64]

    if request.client and request.client.host:
        return request.client.host[:64]

    return None


def registrar(
    db: Session,
    acao: str,
    *,
    request: Optional[Request] = None,
    usuario: Optional[models.User] = None,
    usuario_cpf: Optional[str] = None,
    entidade: Optional[str] = None,
    entidade_id: Optional[object] = None,
    detalhe: Optional[str] = None,
    sucesso: bool = True,
) -> None:
    """
    Grava uma entrada de auditoria e faz commit imediato.

    O commit é próprio para que o registro sobreviva mesmo se a transação da
    operação principal for revertida logo depois (caso típico: login que falha).
    """
    try:
        log = models.LogAuditoria(
            acao=acao,
            usuario_id=usuario.id if usuario else None,
            usuario_cpf=(usuario.cpf if usuario else usuario_cpf),
            usuario_nome=usuario.nome_completo if usuario else None,
            entidade=entidade,
            entidade_id=str(entidade_id) if entidade_id is not None else None,
            sucesso=sucesso,
            detalhe=detalhe[:MAX_DETALHE] if detalhe else None,
            ip=extrair_ip(request),
            user_agent=(
                request.headers.get("user-agent", "")[:MAX_USER_AGENT]
                if request else None
            ),
        )
        db.add(log)
        db.commit()
    except Exception:
        logger.exception("Falha ao registrar log de auditoria (%s).", acao)
        try:
            db.rollback()
        except Exception:
            logger.exception("Falha ao reverter sessão após erro de auditoria.")


def contar_falhas_login_recentes(
    db: Session,
    *,
    cpf: str,
    ip: Optional[str],
    janela_minutos: int,
) -> int:
    """
    Conta tentativas de login malsucedidas recentes para o par CPF/IP.

    Serve de base para o bloqueio temporário por força bruta. Conta por CPF OU
    por IP: assim tanto o ataque focado numa conta quanto a varredura de vários
    CPFs a partir de uma mesma origem são contidos.
    """
    try:
        desde = datetime.now(timezone.utc) - timedelta(minutes=janela_minutos)
        query = db.query(func.count(models.LogAuditoria.id)).filter(
            models.LogAuditoria.acao == LOGIN_FALHA,
            models.LogAuditoria.data_hora >= desde,
        )

        if ip:
            query = query.filter(
                (models.LogAuditoria.usuario_cpf == cpf) | (models.LogAuditoria.ip == ip)
            )
        else:
            query = query.filter(models.LogAuditoria.usuario_cpf == cpf)

        return int(query.scalar() or 0)
    except Exception:
        # Se a contagem falhar, não bloqueamos o login — auditoria indisponível
        # não pode virar negação de serviço para usuários legítimos.
        logger.exception("Falha ao contar tentativas de login recentes.")
        return 0


def listar_logs(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    acao: Optional[str] = None,
    usuario_cpf: Optional[str] = None,
    entidade: Optional[str] = None,
    sucesso: Optional[bool] = None,
    data_inicio: Optional[datetime] = None,
    data_fim: Optional[datetime] = None,
):
    """Lista logs com filtros opcionais. Retorna (itens, total)."""
    query = db.query(models.LogAuditoria)

    if acao:
        query = query.filter(models.LogAuditoria.acao == acao)
    if usuario_cpf:
        query = query.filter(models.LogAuditoria.usuario_cpf == usuario_cpf)
    if entidade:
        query = query.filter(models.LogAuditoria.entidade == entidade)
    if sucesso is not None:
        query = query.filter(models.LogAuditoria.sucesso.is_(sucesso))
    if data_inicio:
        query = query.filter(models.LogAuditoria.data_hora >= data_inicio)
    if data_fim:
        query = query.filter(models.LogAuditoria.data_hora <= data_fim)

    total = query.count()
    itens = (
        query.order_by(models.LogAuditoria.data_hora.desc(), models.LogAuditoria.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return itens, total
