import re
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Request
from .db import SessionLocal
from .config import settings

import jwt
from jwt import PyJWKClient

@dataclass
class CurrentUser:
    upn: str
    name: str
    is_reception: bool
    groups: list[str]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_JWKS_CLIENT = None
_JWKS_TENANT = None

_CLIENT_ID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _get_valid_audiences(configured_audience: str | None) -> list[str]:
    """Return explicitly configured API audiences and safe client-ID aliases.

    Entra can emit either the API application (client) ID or ``api://<client-id>``
    as ``aud``, depending on the access-token version and App ID URI. Supporting
    both forms for the same GUID avoids deployment-specific mismatches without
    accepting tokens issued for an unrelated application.
    """
    audiences: list[str] = []
    for value in (configured_audience or "").split(","):
        audience = value.strip()
        if not audience:
            continue

        aliases = [audience]
        if _CLIENT_ID_RE.fullmatch(audience):
            aliases.append(f"api://{audience}")
        elif audience.lower().startswith("api://"):
            client_id = audience[6:]
            if _CLIENT_ID_RE.fullmatch(client_id):
                aliases.append(client_id)

        for alias in aliases:
            if alias not in audiences:
                audiences.append(alias)

    return audiences

def _get_jwks_client():
    global _JWKS_CLIENT, _JWKS_TENANT
    if _JWKS_CLIENT and _JWKS_TENANT == settings.ENTRA_TENANT_ID:
        return _JWKS_CLIENT
    if not settings.ENTRA_TENANT_ID:
        raise HTTPException(500, "ENTRA_TENANT_ID is not set")
    jwks_url = f"https://login.microsoftonline.com/{settings.ENTRA_TENANT_ID}/discovery/v2.0/keys"
    _JWKS_CLIENT = PyJWKClient(jwks_url)
    _JWKS_TENANT = settings.ENTRA_TENANT_ID
    return _JWKS_CLIENT

def _decode(token: str) -> dict:
    valid_audiences = _get_valid_audiences(settings.ENTRA_AUDIENCE)
    if not valid_audiences:
        raise HTTPException(500, "ENTRA_AUDIENCE is not set")

    jwks_client = _get_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(token).key

    try:
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=valid_audiences,
            options={"require": ["exp", "iat"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(401, "Invalid audience (ENTRA_AUDIENCE mismatch)")
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid token: {str(e)}")

def _extract_user(payload: dict) -> CurrentUser:
    upn = payload.get("preferred_username") or payload.get("upn") or payload.get("unique_name")
    name = payload.get("name") or upn or "Unknown"
    if not upn:
        raise HTTPException(401, "UPN not present in token")

    groups = payload.get("groups") or []
    if isinstance(groups, str):
        groups = [groups]

    is_reception = False
    if settings.RECEPTION_GROUP_ID:
        is_reception = settings.RECEPTION_GROUP_ID.lower() in [g.lower() for g in groups]

    return CurrentUser(upn=upn, name=name, is_reception=is_reception, groups=groups)

def get_current_user(
    request: Request,
    x_user_upn: str | None = Header(default=None, alias="X-User-Upn"),
    x_user_name: str | None = Header(default=None, alias="X-User-Name"),
) -> CurrentUser:
    if settings.AUTH_MODE == "dev":
        if not x_user_upn:
            raise HTTPException(401, "Missing X-User-Upn header (dev auth)")
        return CurrentUser(upn=x_user_upn, name=x_user_name or x_user_upn, is_reception=False, groups=[])

    if settings.AUTH_MODE != "entra":
        raise HTTPException(500, f"Unknown AUTH_MODE={settings.AUTH_MODE}")

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    token = auth.removeprefix("Bearer ").strip()

    payload = _decode(token)
    return _extract_user(payload)

def require_reception(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_reception:
        raise HTTPException(403, "Reception role required")
    return user
