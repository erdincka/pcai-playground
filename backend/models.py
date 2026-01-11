from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    JSON,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()

# --- Enums ---


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    ERROR = "error"


# --- SQLAlchemy Models ---


class LabDB(Base):
    __tablename__ = "labs"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    persona = Column(JSON, nullable=False)  # List[str]
    category = Column(String, nullable=False)
    duration = Column(String)
    difficulty = Column(String, default="intermediate")
    skills = Column(JSON, default=[])  # List[str]
    tags = Column(JSON, default=[])  # List[str]
    prerequisites = Column(JSON)  # List[str]
    description = Column(String)
    steps = Column(JSON)  # List[Dict]
    completion = Column(JSON)
    pca_resources = Column(JSON)
    sandbox_requirements = Column(JSON)
    ui_hints = Column(JSON)


class UserSessionDB(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_uuid = Column(String, unique=True, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    lab_id = Column(String, ForeignKey("labs.id"))
    sandbox_namespace = Column(String, unique=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    status = Column(SQLEnum(SessionStatus), default=SessionStatus.ACTIVE)
    resource_quota_used = Column(JSON)  # Current usage snapshot

    lab = relationship("LabDB")


class LabProgressDB(Base):
    __tablename__ = "lab_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    step_completed = Column(Integer)
    completed_at = Column(DateTime, default=datetime.utcnow)


# --- Pydantic Schemas ---


class LabStep(BaseModel):
    step: int
    title: Optional[str] = None
    instruction: str
    content: Optional[str] = None
    command: Optional[str] = None
    commands: Optional[List[str]] = None
    template: Optional[str] = None
    verification: str


class CompletionResource(BaseModel):
    title: str
    url: str


class CompletionData(BaseModel):
    summary: str
    next_steps: List[str]
    resources: List[CompletionResource]


class PCAResources(BaseModel):
    storage_class: str
    project: str
    model_registry: Optional[str] = None


class SandboxRequirements(BaseModel):
    cpu: str
    memory: str


class UIHints(BaseModel):
    showShell: bool = True
    showEditor: bool = False
    requiresPCAIUI: bool = False


class LabBase(BaseModel):
    id: str
    title: str
    persona: List[str]
    category: str
    duration: str
    difficulty: Optional[str] = "intermediate"
    skills: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    prerequisites: List[str]
    description: str
    steps: List[LabStep]
    completion: Optional[CompletionData] = None
    pca_resources: PCAResources
    sandbox_requirements: SandboxRequirements
    ui_hints: UIHints = UIHints()


class Lab(LabBase):
    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    lab_id: str


class ManifestRequest(BaseModel):
    manifest: str


class UserSession(BaseModel):
    id: int
    session_uuid: str
    user_id: str
    lab_id: str
    sandbox_namespace: str
    start_time: datetime
    last_activity: datetime
    expires_at: datetime
    status: SessionStatus
    resource_quota_used: Optional[Dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class LabProgressUpdate(BaseModel):
    step_number: int


class LabProgress(BaseModel):
    session_uuid: str
    completed_steps: List[int] = []


class AdminSessionStats(BaseModel):
    active_sessions: int
    total_sessions_today: int
    popular_labs: Dict[str, int]