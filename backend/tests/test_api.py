import os
import sys
import tempfile
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / "keyvault-api-test.db"
if TEST_DB.exists():
    TEST_DB.unlink()

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ["KEYVAULT_DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["KEYVAULT_JWT_SECRET"] = "test-secret-that-is-long-enough-for-local-tests"

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


client = TestClient(app)


def test_auth_vault_and_account_lifecycle():
    register = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "auth_secret": "a" * 44,
            "crypto_salt": "c2FsdC1mb3ItdGVzdGluZw==",
        },
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    auth_parameters = client.get(
        "/auth/params",
        params={"email": "test@example.com"},
    )
    assert auth_parameters.status_code == 200
    assert auth_parameters.json()["kdf_iterations"] == 600_000

    empty_vault = client.get("/vault", headers=headers)
    assert empty_vault.status_code == 200
    assert empty_vault.json()["version"] == 0

    saved = client.put(
        "/vault",
        headers=headers,
        json={"ciphertext": "encrypted", "iv": "initialization-vector", "version": 0},
    )
    assert saved.status_code == 200
    assert saved.json()["version"] == 1

    conflict = client.put(
        "/vault",
        headers=headers,
        json={"ciphertext": "stale", "iv": "initialization-vector", "version": 0},
    )
    assert conflict.status_code == 409

    login = client.post(
        "/auth/login",
        json={"email": "test@example.com", "auth_secret": "a" * 44},
    )
    assert login.status_code == 200

    deleted = client.delete("/auth/account", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/vault", headers=headers).status_code == 401
