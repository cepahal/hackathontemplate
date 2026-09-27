import base64
from uuid import UUID

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.ai.routes import VISION_SCHEMA, get_ai_service
from app.modules.identity.dependencies import get_current_user
from app.modules.identity.schemas import AuthenticatedUser


def test_image_route_requests_structured_ocr_and_uses_authenticated_identity():
    calls = []

    class VisionService:
        async def chat(self, request, image=None):
            calls.append((request, image))
            return {
                "text": "",
                "structured": {
                    "summary": "A sign",
                    "detected_text": "Hello",
                    "objects": ["sign"],
                    "uncertainties": [],
                },
                "usage": {},
            }

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=UUID("10000000-0000-4000-8000-000000000001")
    )
    app.dependency_overrides[get_ai_service] = VisionService
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/ai/vision",
            json={
                "provider": "openai",
                "prompt": "Read the sign",
                "media_type": "image/png",
                "image_base64": base64.b64encode(b"\x89PNG\r\n\x1a\nfixture").decode(),
            },
        )
        assert response.status_code == 200
        assert response.json()["structured"]["detected_text"] == "Hello"
        bad = client.post(
            "/api/v1/ai/vision",
            json={
                "prompt": "Read",
                "media_type": "image/png",
                "image_base64": "dGV4dA==",
            },
        )
        assert bad.status_code == 422
    assert len(calls) == 1
    assert calls[0][0].json_schema == VISION_SCHEMA
    assert calls[0][1].media_type == "image/png"
