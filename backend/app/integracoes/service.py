import os
import re
from typing import Any

import requests


def _normalizar_numero_processo(numero: str) -> str:
    return re.sub(r"\D", "", numero or "")


def _normalizar_cpf(cpf: str) -> str:
    return re.sub(r"\D", "", cpf or "")


def _normalizar_data_nascimento(valor: Any) -> str | None:
    if not valor:
        return None

    texto = str(valor).strip()
    match_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})", texto)
    if match_iso:
        return f"{match_iso.group(1)}-{match_iso.group(2)}-{match_iso.group(3)}"

    match_br = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", texto)
    if match_br:
        return f"{match_br.group(3)}-{match_br.group(2)}-{match_br.group(1)}"

    return None


def _consultar_fonte(
    *,
    fonte: str,
    base_url: str | None,
    token: str | None,
    numero_processo: str,
    tribunal: str | None,
) -> dict[str, Any]:
    if not base_url:
        return {
            "fonte": fonte,
            "sucesso": False,
            "mensagem": f"Integração {fonte.upper()} não configurada.",
            "dados": None,
        }

    url = f"{base_url.rstrip('/')}/processos/{numero_processo}"
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params: dict[str, str] = {}
    if tribunal:
        params["tribunal"] = tribunal

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 404:
            return {
                "fonte": fonte,
                "sucesso": False,
                "mensagem": "Processo não encontrado na fonte consultada.",
                "dados": None,
            }

        response.raise_for_status()

        payload = response.json()
        return {
            "fonte": fonte,
            "sucesso": True,
            "mensagem": "Consulta realizada com sucesso.",
            "dados": payload,
        }
    except requests.Timeout:
        return {
            "fonte": fonte,
            "sucesso": False,
            "mensagem": "Timeout na consulta à fonte externa.",
            "dados": None,
        }
    except requests.RequestException as exc:
        return {
            "fonte": fonte,
            "sucesso": False,
            "mensagem": f"Falha na consulta externa: {exc}",
            "dados": None,
        }


def consultar_processo_externo(
    numero_processo: str,
    fontes: list[str],
    tribunal: str | None = None,
) -> dict[str, Any]:
    numero_normalizado = _normalizar_numero_processo(numero_processo)

    if len(numero_normalizado) < 7:
        raise ValueError("Número de processo inválido.")

    resultados: list[dict[str, Any]] = []

    for fonte in fontes:
        if fonte == "datajud":
            resultados.append(
                _consultar_fonte(
                    fonte="datajud",
                    base_url=os.getenv("DATAJUD_API_URL"),
                    token=os.getenv("DATAJUD_API_TOKEN"),
                    numero_processo=numero_normalizado,
                    tribunal=tribunal,
                )
            )
        elif fonte == "pje":
            resultados.append(
                _consultar_fonte(
                    fonte="pje",
                    base_url=os.getenv("PJE_API_URL"),
                    token=os.getenv("PJE_API_TOKEN"),
                    numero_processo=numero_normalizado,
                    tribunal=tribunal,
                )
            )

    melhor_resultado = next((r["dados"] for r in resultados if r["sucesso"] and r.get("dados")), None)

    return {
        "numero_processo": numero_normalizado,
        "resultados": resultados,
        "melhor_resultado": melhor_resultado,
    }


def consultar_cpf_externo(cpf: str) -> dict[str, Any]:
    cpf_normalizado = _normalizar_cpf(cpf)
    if len(cpf_normalizado) != 11:
        raise ValueError("CPF inválido. Informe 11 dígitos.")

    base_url = os.getenv("CPF_API_URL")
    token = os.getenv("CPF_API_TOKEN")

    if not base_url:
        return {
            "cpf": cpf_normalizado,
            "sucesso": False,
            "mensagem": "Integração de CPF não configurada.",
            "dados": None,
        }

    url = f"{base_url.rstrip('/')}/cpf/{cpf_normalizado}"
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 404:
            return {
                "cpf": cpf_normalizado,
                "sucesso": False,
                "mensagem": "CPF não encontrado na fonte consultada.",
                "dados": None,
            }

        response.raise_for_status()
        payload = response.json() or {}

        nome = payload.get("nome_completo") or payload.get("nome")
        nome_da_mae = payload.get("nome_da_mae") or payload.get("mae")
        data_nascimento = (
            payload.get("data_nascimento")
            or payload.get("nascimento")
            or payload.get("dt_nascimento")
        )

        dados_normalizados = {
            "nome_completo": nome,
            "nome_da_mae": nome_da_mae,
            "data_nascimento": _normalizar_data_nascimento(data_nascimento),
        }

        return {
            "cpf": cpf_normalizado,
            "sucesso": True,
            "mensagem": "Consulta de CPF realizada com sucesso.",
            "dados": dados_normalizados,
        }
    except requests.Timeout:
        return {
            "cpf": cpf_normalizado,
            "sucesso": False,
            "mensagem": "Timeout na consulta de CPF.",
            "dados": None,
        }
    except requests.RequestException as exc:
        return {
            "cpf": cpf_normalizado,
            "sucesso": False,
            "mensagem": f"Falha na consulta externa de CPF: {exc}",
            "dados": None,
        }
