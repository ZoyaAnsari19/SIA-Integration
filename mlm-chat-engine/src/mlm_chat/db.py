from __future__ import annotations

import asyncpg


class Db:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    @classmethod
    async def connect(cls, database_url: str) -> "Db":
        pool = await asyncpg.create_pool(dsn=database_url, min_size=1, max_size=10)
        return cls(pool=pool)

    async def close(self) -> None:
        await self.pool.close()

