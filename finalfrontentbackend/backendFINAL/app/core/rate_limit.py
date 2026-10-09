"""In-memory sliding-window rate limiter.

Per process only: with several workers/instances each keeps its own counts. Good enough to stop a
runaway client from burning paid API credits during a demo; use Redis for anything stricter.
"""

import math
import time
from collections import deque
from collections.abc import Callable

from app.core.errors import TooManyRequestsError


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> None:
        """Records a hit for `key`, or raises TooManyRequestsError if the window is full."""
        now = self._clock()
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise TooManyRequestsError(max(1, math.ceil(hits[0] + self.window - now)))
        hits.append(now)
