import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator
from uuid import uuid4

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import create_engine, delete, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session
from sqlalchemy.orm import mapped_column, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv(
    "KEYVAULT_DATABASE_URL",
    "sqlite:///./data/keyvault.db",
)
JWT_SECRET = os.getenv("KEYVAULT_JWT_SECRET")
ACCESS_TOKEN_MINUTES = int(
    os.getenv("KEYVAULT_ACCESS_TOKEN_MINUTES", "60")
)

if not JWT_SECRET:
    raise RuntimeError("KEYVAULT_JWT_SECRET is missing from .env")

Path("data").mkdir(exist_ok=True)

connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()
JWT_ALGORITHM = "HS256"
PBKDF2_ITERATIONS = 600_000
LEGACY_PBKDF2_ITERATIONS = 310_000


class Base(DeclarativeBase):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        index=True,
    )
    auth_hash: Mapped[str] = mapped_column(Text)
    crypto_salt: Mapped[str] = mapped_column(String(255))
    kdf_iterations: Mapped[int] = mapped_column(
        Integer,
        default=PBKDF2_ITERATIONS,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )


class Vault(Base):
    __tablename__ = "vaults"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        index=True,
    )
    ciphertext: Mapped[str] = mapped_column(Text)
    iv: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class RegisterRequest(BaseModel):
    email: EmailStr
    auth_secret: str = Field(min_length=32, max_length=1000)
    crypto_salt: str = Field(min_length=16, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    auth_secret: str = Field(min_length=32, max_length=1000)


class AuthParametersResponse(BaseModel):
    crypto_salt: str
    kdf_iterations: int


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    crypto_salt: str


class VaultWriteRequest(BaseModel):
    ciphertext: str = Field(min_length=1)
    iv: str = Field(min_length=1, max_length=255)
    version: int = Field(ge=0)


class VaultResponse(BaseModel):
    ciphertext: str
    iv: str
    version: int
    updated_at: datetime | None = None


class MessageResponse(BaseModel):
    message: str


def get_db() -> Iterator[Session]:
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_access_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_MINUTES
    )

    return jwt.encode(
        {
            "sub": user_id,
            "exp": expiration,
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")

        if not isinstance(user_id, str):
            raise jwt.InvalidTokenError()

    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    return user


Base.metadata.create_all(bind=engine)


def migrate_legacy_sqlite_database() -> None:
    """Preserve accounts created before per-user KDF parameters were stored."""
    if engine.dialect.name != "sqlite":
        return

    columns = {
        column["name"]
        for column in inspect(engine).get_columns("users")
    }
    if "kdf_iterations" in columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users ADD COLUMN kdf_iterations "
                f"INTEGER NOT NULL DEFAULT {LEGACY_PBKDF2_ITERATIONS}"
            )
        )


migrate_legacy_sqlite_database()

app = FastAPI(
    title="KeyVault API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^(chrome-extension://[a-p]{32}|"
        r"http://localhost(:[0-9]+)?|"
        r"http://127\.0\.0\.1(:[0-9]+)?)$"
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "KeyVault API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/auth/params",
    response_model=AuthParametersResponse,
)
def get_auth_parameters(
    email: str,
    db: Session = Depends(get_db),
) -> AuthParametersResponse:
    user = db.scalar(
        select(User).where(
            User.email == normalize_email(email)
        )
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    return AuthParametersResponse(
        crypto_salt=user.crypto_salt,
        kdf_iterations=user.kdf_iterations,
    )


@app.post(
    "/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    email = normalize_email(str(payload.email))

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account already exists",
        )

    user = User(
        email=email,
        auth_hash=password_hash.hash(payload.auth_secret),
        crypto_salt=payload.crypto_salt,
        kdf_iterations=PBKDF2_ITERATIONS,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id),
        crypto_salt=user.crypto_salt,
    )


@app.post(
    "/auth/login",
    response_model=AuthResponse,
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    email = normalize_email(str(payload.email))

    user = db.scalar(
        select(User).where(User.email == email)
    )

    valid_secret = (
        user is not None
        and password_hash.verify(
            payload.auth_secret,
            user.auth_hash,
        )
    )

    if user is None or not valid_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or authentication secret",
        )

    return AuthResponse(
        access_token=create_access_token(user.id),
        crypto_salt=user.crypto_salt,
    )


@app.get(
    "/vault",
    response_model=VaultResponse,
)
def get_vault(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultResponse:
    vault = db.scalar(
        select(Vault).where(Vault.user_id == user.id)
    )

    if vault is None:
        return VaultResponse(
            ciphertext="",
            iv="",
            version=0,
            updated_at=None,
        )

    return VaultResponse(
        ciphertext=vault.ciphertext,
        iv=vault.iv,
        version=vault.version,
        updated_at=vault.updated_at,
    )


@app.put(
    "/vault",
    response_model=VaultResponse,
)
def save_vault(
    payload: VaultWriteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultResponse:
    vault = db.scalar(
        select(Vault).where(Vault.user_id == user.id)
    )

    if vault is None:
        if payload.version != 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vault version conflict",
            )

        vault = Vault(
            user_id=user.id,
            ciphertext=payload.ciphertext,
            iv=payload.iv,
            version=1,
        )
        db.add(vault)

    else:
        if payload.version != vault.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vault version conflict",
            )

        vault.ciphertext = payload.ciphertext
        vault.iv = payload.iv
        vault.version += 1

    db.commit()
    db.refresh(vault)

    return VaultResponse(
        ciphertext=vault.ciphertext,
        iv=vault.iv,
        version=vault.version,
        updated_at=vault.updated_at,
    )


@app.delete(
    "/auth/account",
    response_model=MessageResponse,
)
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    db.execute(
        delete(Vault).where(Vault.user_id == user.id)
    )
    db.delete(user)
    db.commit()

    return MessageResponse(message="Account deleted")
