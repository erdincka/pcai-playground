import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler

import models
from kubernetes_ops import KubernetesOps
from background_tasks import ExpiryController
import websocket_shell

# --- Configuration & Setup ---

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_URL = "sqlite:///./playground.db"  # In production use postgresql+asyncpg
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PCAI Playground API", version="1.0.0")
app.include_router(websocket_shell.router)
k8s_ops = KubernetesOps()
expiry_controller = ExpiryController(SessionLocal, k8s_ops)
scheduler = AsyncIOScheduler()
security = HTTPBearer(auto_error=False)

# --- Dependency ---


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(auth: HTTPAuthorizationCredentials = Security(security)):
    # In development, assume user is authorized
    if os.getenv("ENVIRONMENT") == "development":
        return "dev-user"

    # In production, validate OIDC JWT token here using python-jose
    # For now, we simulate user extraction from token
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid token")
    return "user-123"  # Mock user_id


# --- Startup Tasks ---


@app.on_event("startup")
async def startup_event():
    # Load lab catalog into DB
    db = SessionLocal()
    try:
        with open("lab_catalog.json") as f:
            catalog = json.load(f)
            for lab_data in catalog["labs"]:
                lab = models.LabDB(**lab_data)
                db.merge(lab)
            db.commit()
            logger.info("Lab catalog loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load lab catalog: {e}")
    finally:
        db.close()

    # Start background jobs
    scheduler.add_job(expiry_controller.check_expired_sessions, "interval", minutes=5)
    scheduler.add_job(expiry_controller.update_resource_usage, "interval", minutes=2)
    scheduler.start()


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()


# --- Endpoints ---


@app.get("/labs", response_model=List[models.Lab])
def list_labs(
    category: Optional[str] = None,
    persona: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.LabDB)
    if category:
        query = query.filter(models.LabDB.category == category)
    labs = query.all()
    if persona:
        labs = [l for l in labs if persona in l.persona]
    return labs


@app.get("/labs/{lab_id}", response_model=models.Lab)
def get_lab(lab_id: str, db: Session = Depends(get_db)):
    lab = db.query(models.LabDB).filter(models.LabDB.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")
    return lab


@app.post("/sessions", response_model=models.UserSession)
async def create_session(
    session_req: models.SessionCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check concurrent sessions (Max 5 for cluster)
    active_count = (
        db.query(models.UserSessionDB)
        .filter(models.UserSessionDB.status == "active")
        .count()
    )
    if active_count >= 5:
        raise HTTPException(
            status_code=429, detail="Maximum concurrent playground sessions reached"
        )

    # Check if user already has an active session
    existing = (
        db.query(models.UserSessionDB)
        .filter(
            models.UserSessionDB.user_id == user_id,
            models.UserSessionDB.status == "active",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="User already has an active session"
        )

    # Validate lab
    lab = db.query(models.LabDB).filter(models.LabDB.id == session_req.lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    # K8s Orchestration
    session_uuid = str(uuid.uuid4())[:8]
    namespace = f"playground-{user_id}-{session_uuid}"

    try:
        k8s_ops.create_sandbox_namespace(namespace, user_id)
        k8s_ops.apply_quotas(namespace)
        k8s_ops.setup_rbac(namespace, user_id)
    except Exception as e:
        logger.error(f"K8s provisioning failed: {e}")
        k8s_ops.delete_sandbox_namespace(namespace)
        raise HTTPException(status_code=500, detail="Failed to provision sandbox")

    # DB Record
    new_session = models.UserSessionDB(
        session_uuid=session_uuid,
        user_id=user_id,
        lab_id=lab.id,
        sandbox_namespace=namespace,
        expires_at=datetime.utcnow() + timedelta(hours=8),
        status=models.SessionStatus.ACTIVE,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@app.get("/sessions/me", response_model=List[models.UserSession])
def get_my_sessions(
    user_id: str = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(models.UserSessionDB)
        .filter(models.UserSessionDB.user_id == user_id)
        .all()
    )


@app.delete("/sessions/{session_uuid}")
async def end_session(
    session_uuid: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.UserSessionDB)
        .filter(
            models.UserSessionDB.session_uuid == session_uuid,
            models.UserSessionDB.user_id == user_id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        k8s_ops.delete_sandbox_namespace(session.sandbox_namespace)
    except Exception:
        pass  # Best effort cleanup

    session.status = models.SessionStatus.TERMINATED
    db.commit()
    return {"message": "Session terminated"}


@app.post("/sessions/{session_uuid}/extend")
def extend_session(
    session_uuid: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.UserSessionDB)
        .filter(
            models.UserSessionDB.session_uuid == session_uuid,
            models.UserSessionDB.user_id == user_id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.expires_at += timedelta(hours=1)
    db.commit()
    return {"message": "Session extended", "new_expiry": session.expires_at}


@app.post("/sessions/{session_uuid}/apply-manifest")
async def apply_manifest(
    session_uuid: str,
    manifest: dict,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.UserSessionDB)
        .filter(
            models.UserSessionDB.session_uuid == session_uuid,
            models.UserSessionDB.user_id == user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # In real world: k8s_ops.apply_manifest(session.sandbox_namespace, manifest)
    logger.info(f"Applying manifest to {session.sandbox_namespace}")
    return {"message": "Manifest applied successfully"}


# --- Admin APIs ---


@app.get("/admin/sessions", response_model=List[models.UserSession])
def admin_list_sessions(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.UserSessionDB)
    if status:
        query = query.filter(models.UserSessionDB.status == status)
    return query.all()


@app.delete("/admin/sessions/{session_uuid}")
async def admin_terminate_session(session_uuid: str, db: Session = Depends(get_db)):
    session = (
        db.query(models.UserSessionDB)
        .filter(models.UserSessionDB.session_uuid == session_uuid)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    k8s_ops.delete_sandbox_namespace(session.sandbox_namespace)
    session.status = models.SessionStatus.TERMINATED
    db.commit()
    return {"message": "Admin terminated session"}


@app.get("/admin/stats")
def admin_stats(db: Session = Depends(get_db)):
    active = (
        db.query(models.UserSessionDB)
        .filter(models.UserSessionDB.status == "active")
        .count()
    )
    total = db.query(models.UserSessionDB).count()
    return {
        "active_sessions": active,
        "total_sessions_all_time": total,
        "cluster_utilization_pct": (active / 5.0) * 100,
    }


if __name__ == "__main__":
    import uvicorn

    # Trigger reload - step 2
    uvicorn.run(app, host="0.0.0.0", port=8000)
