"""Route-level tests for app.py, with the DeepFace engine monkeypatched out.

These exercise the HTTP contract (status codes, auth, input validation,
response shape) without loading TensorFlow. They skip cleanly when FastAPI is
not installed, so the pure-logic suite still runs on a bare Python install.
"""

import base64
import importlib
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from fastapi.testclient import TestClient

    HAS_FASTAPI = True
except Exception:  # noqa: BLE001
    HAS_FASTAPI = False


def _jpeg(nbytes=300):
    blob = b"\xff\xd8\xff" + b"\x00" * nbytes
    return "data:image/jpeg;base64," + base64.b64encode(blob).decode()


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class AppRouteTests(unittest.TestCase):
    def setUp(self):
        # Fresh config/app per test so token changes take effect, and warm-up is
        # off so startup never touches DeepFace.
        os.environ.pop("FACE_SERVICE_TOKEN", None)
        os.environ["FACE_WARM_ON_STARTUP"] = "false"
        import config

        importlib.reload(config)
        import engine

        importlib.reload(engine)
        import app as app_module

        importlib.reload(app_module)
        self.app_module = app_module
        self.engine = engine
        self.client = TestClient(app_module.app)

    def test_health_ok(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("model", body)

    def test_represent_returns_embedding(self):
        self.engine.represent = lambda _b: [0.1, 0.2, 0.3]
        res = self.client.post("/represent", json={"image": _jpeg()})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["embedding"], [0.1, 0.2, 0.3])
        self.assertEqual(body["dims"], 3)

    def test_represent_no_face_is_422(self):
        def _boom(_b):
            raise self.engine.NoFaceError("no face detected in the image")

        self.engine.represent = _boom
        res = self.client.post("/represent", json={"image": _jpeg()})
        self.assertEqual(res.status_code, 422)
        self.assertIn("no face", res.json()["detail"])

    def test_represent_bad_image_is_400(self):
        res = self.client.post("/represent", json={"image": "data:image/gif;base64,AAAA"})
        self.assertEqual(res.status_code, 400)

    def test_verify_with_embedding(self):
        self.engine.verify_against_embedding = lambda _b, _e: {
            "verified": True,
            "distance": 0.12,
            "threshold": 0.30,
            "model": "Facenet512",
            "metric": "cosine",
            "dims": 3,
        }
        res = self.client.post(
            "/verify",
            json={"image": _jpeg(), "reference_embedding": [0.1, 0.2, 0.3]},
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["verified"])

    def test_verify_requires_exactly_one_reference(self):
        # Neither reference supplied.
        res = self.client.post("/verify", json={"image": _jpeg()})
        self.assertEqual(res.status_code, 400)
        # Both supplied.
        res = self.client.post(
            "/verify",
            json={
                "image": _jpeg(),
                "reference_embedding": [0.1],
                "reference_image": _jpeg(),
            },
        )
        self.assertEqual(res.status_code, 400)

    def test_verify_rejects_malformed_embedding(self):
        res = self.client.post(
            "/verify",
            json={"image": _jpeg(), "reference_embedding": ["not", "numbers"]},
        )
        # pydantic coerces/validates the list[float] type first → 422.
        self.assertIn(res.status_code, (400, 422))

    def test_token_enforced_when_configured(self):
        os.environ["FACE_SERVICE_TOKEN"] = "s3cret"
        import config

        importlib.reload(config)
        import app as app_module

        importlib.reload(app_module)
        app_module.engine.represent = lambda _b: [0.1, 0.2]
        client = TestClient(app_module.app)

        # No token → 401.
        res = client.post("/represent", json={"image": _jpeg()})
        self.assertEqual(res.status_code, 401)
        # Correct token → 200.
        res = client.post(
            "/represent",
            json={"image": _jpeg()},
            headers={"X-Face-Service-Token": "s3cret"},
        )
        self.assertEqual(res.status_code, 200)
        # Health needs no token.
        self.assertEqual(client.get("/health").status_code, 200)

        os.environ.pop("FACE_SERVICE_TOKEN", None)


if __name__ == "__main__":
    unittest.main()
