"""Authentication endpoints.

Auth itself happens in Supabase on the frontend; these endpoints let the backend
verify a session and provide a logout hook. Device-linking for the physical
mirror will be added here in a future phase.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.auth import MessageResponse, SessionResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/session",
    response_model=SessionResponse,
    summary="Verify the current Supabase session",
)
async def verify_session(user: CurrentUser) -> SessionResponse:
    return SessionResponse(user_id=user.id, email=user.email, role=user.role)


@router.post("/logout", response_model=MessageResponse, summary="Log out")
async def logout(_user: CurrentUser) -> MessageResponse:
    # Supabase token revocation is handled client-side; this is a server hook
    # for future session bookkeeping / device unlinking.
    return MessageResponse(message="Logged out.")
