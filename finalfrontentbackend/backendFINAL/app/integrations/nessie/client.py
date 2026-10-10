"""Capital One Nessie mock-banking API adapter (http://api.nessieisreal.com, HackNC sponsor track).

Nessie serves only plain HTTP; the host is fixed and the key travels as the `key` query
parameter, which HttpClient never logs. Data is mock data, never real customer data.
"""

import re
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, RootModel

from app.integrations.base import ExternalService

_ID = re.compile(r"[A-Za-z0-9]{1,64}")


class _NessieModel(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)


class Customer(_NessieModel):
    id: str | None = None
    first_name: str | None = None
    last_name: str | None = None


class Account(_NessieModel):
    id: str | None = None
    type: str | None = None
    nickname: str | None = None
    rewards: int | None = None
    balance: float | None = None
    customer_id: str | None = None


class Transaction(_NessieModel):
    """Purchases, deposits, withdrawals and transfers share this loose shape."""

    id: str | None = None
    type: str | None = None
    status: str | None = None
    medium: str | None = None
    amount: float | None = None
    description: str | None = None
    merchant_id: str | None = None
    purchase_date: str | None = None
    transaction_date: str | None = None


class Bill(_NessieModel):
    id: str | None = None
    status: str | None = None
    payee: str | None = None
    nickname: str | None = None
    payment_amount: float | None = None
    upcoming_payment_date: str | None = None
    recurring_date: int | None = None


class Merchant(_NessieModel):
    id: str | None = None
    name: str | None = None
    category: list[str] | str | None = None


class _Customers(RootModel[list[Customer]]):
    pass


class _Accounts(RootModel[list[Account]]):
    pass


class _Transactions(RootModel[list[Transaction]]):
    pass


class _Bills(RootModel[list[Bill]]):
    pass


class _Merchants(RootModel[list[Merchant]]):
    pass


def _check_id(value: str) -> str:
    if not _ID.fullmatch(value):
        raise ValueError("invalid Nessie id")
    return value


class NessieClient(ExternalService):
    service_name: ClassVar[str] = "nessie"
    env_var: ClassVar[str] = "NESSIE_API_KEY"
    base_url: ClassVar[str] = "http://api.nessieisreal.com"

    def auth_headers(self) -> dict[str, str]:
        return {}  # Nessie authenticates with ?key=; see auth_params().

    def auth_params(self) -> dict[str, str]:
        return {"key": self.credential()}

    async def list_customers(self) -> list[Customer]:
        return (await self.call("GET", "/customers", model=_Customers)).root

    async def list_accounts(self, customer_id: str | None = None) -> list[Account]:
        path = f"/customers/{_check_id(customer_id)}/accounts" if customer_id else "/accounts"
        return (await self.call("GET", path, model=_Accounts)).root

    async def get_account(self, account_id: str) -> Account:
        return await self.call("GET", f"/accounts/{_check_id(account_id)}", model=Account)

    async def list_purchases(self, account_id: str) -> list[Transaction]:
        return (await self.call("GET", f"/accounts/{_check_id(account_id)}/purchases", model=_Transactions)).root

    async def list_deposits(self, account_id: str) -> list[Transaction]:
        return (await self.call("GET", f"/accounts/{_check_id(account_id)}/deposits", model=_Transactions)).root

    async def list_transfers(self, account_id: str) -> list[Transaction]:
        return (await self.call("GET", f"/accounts/{_check_id(account_id)}/transfers", model=_Transactions)).root

    async def list_bills(self, account_id: str) -> list[Bill]:
        return (await self.call("GET", f"/accounts/{_check_id(account_id)}/bills", model=_Bills)).root

    async def list_merchants(self) -> list[Merchant]:
        return (await self.call("GET", "/merchants", model=_Merchants)).root
