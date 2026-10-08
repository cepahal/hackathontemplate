"""Demo/test routes for integrations. All require a signed-in user; paid or side-effecting calls
are rate limited per user. No route accepts a URL, so nothing here can be used for SSRF."""

from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import AdminUser, CurrentUser, IntegrationsDep, RateLimitedUser
from app.core.errors import ErrorResponse
from app.integrations.email.client import EmailResult
from app.integrations.github.client import Repository, RepositorySearchResult, RepoSort
from app.integrations.maps.client import GeocodeResult
from app.modules.integrations import service
from app.modules.integrations.schemas import (
    IntegrationStatus,
    NotificationRequest,
    TestEmailRequest,
)

PROVIDER_ERRORS: dict[int | str, dict[str, object]] = {
    code: {"model": ErrorResponse} for code in (401, 422, 429, 502, 503, 504)
}

router = APIRouter(prefix="/integrations", tags=["integrations"], responses=PROVIDER_ERRORS)


@router.get("/status", response_model=IntegrationStatus)
async def integration_status(_: CurrentUser, integrations: IntegrationsDep) -> IntegrationStatus:
    return IntegrationStatus(**integrations.status())


@router.get("/github/repos/{owner}/{repo}", response_model=Repository, responses={404: {"model": ErrorResponse}})
async def get_repository(
    owner: Annotated[str, Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}$")],
    repo: Annotated[str, Path(pattern=r"^[A-Za-z0-9._-]{1,100}$")],
    _: RateLimitedUser,
    integrations: IntegrationsDep,
) -> Repository:
    return await service.get_public_repository(integrations, owner, repo)


@router.get("/github/search", response_model=RepositorySearchResult)
async def search_repositories(
    _: RateLimitedUser,
    integrations: IntegrationsDep,
    q: Annotated[str, Query(min_length=1, max_length=256)],
    sort: RepoSort | None = None,
    per_page: Annotated[int, Query(ge=1, le=50)] = 10,
    page: Annotated[int, Query(ge=1, le=10)] = 1,
) -> RepositorySearchResult:
    return await service.search_public_repositories(integrations, q, sort=sort, per_page=per_page, page=page)


@router.get("/maps/geocode", response_model=list[GeocodeResult])
async def geocode(
    _: RateLimitedUser,
    integrations: IntegrationsDep,
    q: Annotated[str, Query(min_length=1, max_length=256)],
    limit: Annotated[int, Query(ge=1, le=10)] = 5,
) -> list[GeocodeResult]:
    return await service.geocode(integrations, q, limit)


@router.post("/email/test", response_model=EmailResult, responses={400: {"model": ErrorResponse}})
async def send_test_email(body: TestEmailRequest, user: RateLimitedUser, integrations: IntegrationsDep) -> EmailResult:
    return await service.send_test_email(integrations, user, body)


@router.post("/notifications", status_code=status.HTTP_204_NO_CONTENT, responses={403: {"model": ErrorResponse}})
async def send_notification(
    body: NotificationRequest, _admin: AdminUser, _: RateLimitedUser, integrations: IntegrationsDep
) -> Response:
    await service.notify(integrations, body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
