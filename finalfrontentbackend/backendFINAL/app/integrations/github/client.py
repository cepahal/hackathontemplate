"""GitHub REST API adapter (https://docs.github.com/en/rest)."""

import re
from datetime import datetime
from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.core.errors import NotFoundError
from app.integrations.base import ExternalService
from app.integrations.errors import IntegrationRequestError

_OWNER = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})")
_REPO = re.compile(r"[A-Za-z0-9._-]{1,100}")

RepoSort = Literal["stars", "forks", "help-wanted-issues", "updated"]


class RepositoryOwner(BaseModel):
    login: str
    html_url: str


class Repository(BaseModel):
    id: int
    name: str
    full_name: str
    owner: RepositoryOwner
    private: bool
    html_url: str
    description: str | None = None
    language: str | None = None
    topics: list[str] = Field(default_factory=list)
    stargazers_count: int
    forks_count: int
    open_issues_count: int
    default_branch: str
    archived: bool = False
    updated_at: datetime


class RepositorySearchResult(BaseModel):
    total_count: int
    incomplete_results: bool
    items: list[Repository]


def validate_repo_name(owner: str, repo: str) -> None:
    if not _OWNER.fullmatch(owner) or not _REPO.fullmatch(repo) or repo in {".", ".."}:
        raise ValueError("invalid GitHub owner or repository name")


class GitHubClient(ExternalService):
    service_name: ClassVar[str] = "github"
    env_var: ClassVar[str] = "GITHUB_TOKEN"
    base_url: ClassVar[str] = "https://api.github.com"

    def default_headers(self) -> dict[str, str]:
        return {
            **super().default_headers(),
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def get_repository(self, owner: str, repo: str) -> Repository:
        validate_repo_name(owner, repo)
        try:
            return await self.call("GET", f"/repos/{owner}/{repo}", model=Repository)
        except IntegrationRequestError as exc:
            if exc.upstream_status == 404:
                raise NotFoundError("Repository not found", code="GITHUB_REPOSITORY_NOT_FOUND") from None
            raise

    async def search_repositories(
        self,
        query: str,
        *,
        sort: RepoSort | None = None,
        order: Literal["asc", "desc"] = "desc",
        per_page: int = 10,
        page: int = 1,
    ) -> RepositorySearchResult:
        if not 1 <= len(query.strip()) <= 256:
            raise ValueError("query must be 1-256 characters")
        if not 1 <= per_page <= 100 or not 1 <= page <= 10:
            raise ValueError("per_page must be 1-100 and page 1-10")
        return await self.call(
            "GET",
            "/search/repositories",
            model=RepositorySearchResult,
            params={"q": query.strip(), "sort": sort, "order": order, "per_page": per_page, "page": page},
        )
