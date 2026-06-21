"""Domain error types and a consistent error envelope.

Every error the API returns is shaped as ``{"error": {"code", "message",
"details"}}`` so the frontend `apiClient` can parse failures uniformly.
"""

from __future__ import annotations

from typing import Any


class AxonError(Exception):
    """Base class for expected, handled application errors."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: Any | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message or self.code)
        self.message = message or self.code
        self.details = details
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(AxonError):
    status_code = 404
    code = "not_found"


class UnauthorizedError(AxonError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AxonError):
    status_code = 403
    code = "forbidden"


class NotImplementedYetError(AxonError):
    """Used by Phase 2+ placeholder endpoints."""

    status_code = 501
    code = "not_implemented"

    def __init__(self, feature: str) -> None:
        super().__init__(f"'{feature}' is not available in Phase 1.")
        self.feature = feature
