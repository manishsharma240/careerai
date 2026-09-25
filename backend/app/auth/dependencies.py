"""
FastAPI authentication dependencies.
All authorization decisions are made server-side from the verified JWT claim.
Frontend roles are NEVER trusted.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import User, UserRole
from app.security.crypto import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate the Bearer JWT and return the active, verified user.
    Raises 401 on any token issue; 403 if the account is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Please contact support.",
        )
    return user


async def get_verified_user(user: User = Depends(get_current_user)) -> User:
    """Require the user to have a verified email address."""
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before continuing.",
        )
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """Require the user to have the ADMIN role (checked server-side from DB)."""
    if user.role != UserRole.ADMIN:
        # Return 404 instead of 403 for admin routes to not leak existence
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    return user
