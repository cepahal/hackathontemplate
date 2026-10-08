"""Policies for the integration demo routes. Provider calls live in app/integrations."""

import uuid

from app.core.errors import BadRequestError, NotFoundError
from app.core.security import AuthenticatedUser
from app.integrations.email.client import EmailResult
from app.integrations.github.client import Repository, RepositorySearchResult, RepoSort
from app.integrations.maps.client import GeocodeResult
from app.integrations.registry import Integrations
from app.modules.integrations.schemas import NotificationRequest, TestEmailRequest

# The GitHub token belongs to the server, not the caller: only ever return public repositories,
# so app users can't read private repositories the token happens to have access to.


async def get_public_repository(integrations: Integrations, owner: str, repo: str) -> Repository:
    repository = await integrations.github.get_repository(owner, repo)
    if repository.private:
        raise NotFoundError("Repository not found", code="GITHUB_REPOSITORY_NOT_FOUND")
    return repository


async def search_public_repositories(
    integrations: Integrations, query: str, *, sort: RepoSort | None, per_page: int, page: int
) -> RepositorySearchResult:
    result = await integrations.github.search_repositories(query, sort=sort, per_page=per_page, page=page)
    return result.model_copy(update={"items": [item for item in result.items if not item.private]})


async def geocode(integrations: Integrations, query: str, limit: int) -> list[GeocodeResult]:
    return await integrations.maps.geocode(query, limit=limit)


async def send_test_email(integrations: Integrations, user: AuthenticatedUser, body: TestEmailRequest) -> EmailResult:
    # Recipient is always the caller's own verified address, so this can't be used as an open relay.
    if not user.email:
        raise BadRequestError("Your account has no email address", code="NO_EMAIL_ADDRESS")
    return await integrations.email.send_email(
        user.email, body.subject, body.html, idempotency_key=f"test-email-{uuid.uuid4()}"
    )


async def notify(integrations: Integrations, body: NotificationRequest) -> None:
    await integrations.notifications.send(body.channel, body.text)
