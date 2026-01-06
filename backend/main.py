import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
from fastapi import FastAPI, Depends, HTTPException, status, Security, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler

import models
from database import engine, SessionLocal
from kubernetes_ops import KubernetesOps
from background_tasks import ExpiryController
import websocket_shell

# --- Configuration & Setup ---

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


async def get_current_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security),
):
    # In development, assume user is authorized
    if os.getenv("ENVIRONMENT") == "development":
        return "dev-user"

    # Log headers for debugging
    logger.info(f"Received headers: {request.headers}")

    # Check for headers from oauth2-proxy (EZUA/PCAI) and other common providers
    auth_headers = [
        "x-auth-request-preferred-username",
        "x-auth-request-email",
        "x-auth-request-user",
        "x-forwarded-email",
        "x-forwarded-user",
        "x-oidc-email",
        "x-remote-user",
    ]
    
    for header in auth_headers:
        val = request.headers.get(header)
        if val:
            return val

    # Check for _oauth2_proxy cookie and query userinfo
    cookie_header = request.headers.get("cookie")
    if cookie_header and "_oauth2_proxy" in cookie_header:
        try:
            async with httpx.AsyncClient() as client:
                # Forward the cookie to oauth2-proxy userinfo endpoint
                # Assuming oauth2-proxy service is in oauth2-proxy namespace
                # Adjust URL if service/namespace is different
                headers = {"Cookie": cookie_header}
                resp = await client.get(
                    "http://oauth2-proxy.oauth2-proxy.svc.cluster.local/oauth2/userinfo",
                    headers=headers,
                    timeout=5.0
                )
                if resp.status_code == 200:
                    user_data = resp.json()
                    logger.info(f"Got user info from oauth2-proxy: {user_data}")
                    # Extract email/user
                    user = (
                        user_data.get("preferredUsername")
                        or user_data.get("email")
                        or user_data.get("user")
                    )
                    if user:
                        return user
                else:
                    logger.warning(f"Failed to get user info from oauth2-proxy: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.error(f"Error querying oauth2-proxy: {e}")

    # Check for hadoop.auth cookie (fallback for some EZUA environments)
    if cookie_header:
        for cookie in cookie_header.split(";"):
            cookie = cookie.strip()
            if cookie.startswith("hadoop.auth="):
                try:
                    # Format: hadoop.auth="u=user&..."
                    # Extract value after =
                    value = cookie.split("=", 1)[1]
                    # Remove quotes if present
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    
                    # Parse key-values in the cookie value
                    parts = value.split("&")
                    for part in parts:
                        if part.startswith("u="):
                            user = part.split("=", 1)[1]
                            logger.info(f"Extracted user from hadoop.auth cookie: {user}")
                            return user
                except Exception as e:
                    logger.warning(f"Failed to parse hadoop.auth cookie: {e}")

    # In production, validate OIDC JWT token here using python-jose
    # For now, we simulate user extraction from token
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid token")
    return "user-123"  # Mock user_id


async def get_current_user_info(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security),
):
    # Log headers for debugging
    logger.info(f"Received headers: {request.headers}")

    user_info = {
        "user_id": "unknown",
        "email": None,
        "groups": [],
        "preferredUsername": None,
    }

    # Extract info from headers (PCAI/OAuth2-Proxy standard)
    if request.headers.get("x-auth-request-user"):
        user_info["user_id"] = request.headers.get("x-auth-request-user")
        # Default fallback
        user_info["preferredUsername"] = request.headers.get("x-auth-request-user")

    if request.headers.get("x-auth-request-preferred-username"):
        user_info["preferredUsername"] = request.headers.get("x-auth-request-preferred-username")
    
    if request.headers.get("x-auth-request-email"):
        user_info["email"] = request.headers.get("x-auth-request-email")

    if request.headers.get("x-auth-request-groups"):
        groups = request.headers.get("x-auth-request-groups")
        if groups:
            # Handle comma separated list
            user_info["groups"] = [g.strip() for g in groups.split(",")]

    # Fallback to get_current_user logic if headers missing (e.g. dev or cookie)
    if user_info["user_id"] == "unknown":
        try:
            user_id = await get_current_user(request, auth)
            user_info["user_id"] = user_id
            user_info["preferredUsername"] = user_id
        except Exception:
            pass

    return user_info


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

@app.get("/users/me")
def get_me(user_info: dict = Depends(get_current_user_info)):
    return user_info


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
    
    # Sanitize user_id for Kubernetes Namespace (RFC 1123 DNS Label)
    # Replace dots and @ with hyphens, convert to lowercase
    sanitized_user_id = user_id.lower().replace(".", "-").replace("@", "-")
    # Ensure it starts/ends with alphanumeric (should be handled if user_id is reasonable)
    
    namespace = f"playground-{sanitized_user_id}-{session_uuid}"

    try:
        k8s_ops.create_sandbox_namespace(namespace, user_id)
        k8s_ops.apply_quotas(namespace)
        k8s_ops.setup_rbac(namespace, user_id)
        # Pass original user_id for secret lookup
        k8s_ops.deploy_toolbox(namespace, user_id)
    except Exception as e:
        logger.error(f"K8s provisioning failed: {e}")
        # Only try delete if creation failed midway
        try:
            k8s_ops.delete_sandbox_namespace(namespace)
        except:
            pass
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
    manifest_req: models.ManifestRequest,
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
        k8s_ops.apply_manifest(session.sandbox_namespace, manifest_req.manifest)
    except Exception as e:
        logger.error(f"Failed to apply manifest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Manifest applied successfully"}


@app.post("/sessions/{session_uuid}/delete-manifest")
async def delete_manifest(
    session_uuid: str,
    manifest_req: models.ManifestRequest,
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
        k8s_ops.delete_manifest(session.sandbox_namespace, manifest_req.manifest)
    except Exception as e:
        logger.error(f"Failed to delete manifest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Manifest deleted successfully"}


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


@app.get("/admin/sessions/{session_uuid}/resources")
def admin_get_session_resources(session_uuid: str, db: Session = Depends(get_db)):
    session = (
        db.query(models.UserSessionDB)
        .filter(models.UserSessionDB.session_uuid == session_uuid)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return k8s_ops.list_resources(session.sandbox_namespace)


@app.delete("/admin/sessions/{session_uuid}/resources/{kind}/{name}")
def admin_delete_resource(
    session_uuid: str, kind: str, name: str, db: Session = Depends(get_db)
):
    session = (
        db.query(models.UserSessionDB)
        .filter(models.UserSessionDB.session_uuid == session_uuid)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        k8s_ops.delete_resource(session.sandbox_namespace, kind, name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete resource: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete resource")
        
    return {"message": f"Deleted {kind} {name}"}


@app.post("/sessions/{session_uuid}/complete")
def complete_session(
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
        
    # Mark as completed in progress table
    progress = models.LabProgressDB(
        session_id=session.id,
        step_completed=999, # Sentinel for completion
        completed_at=datetime.utcnow()
    )
    db.add(progress)
    db.commit()
    
    return {"message": "Lab marked as completed"}


if __name__ == "__main__":
    import uvicorn

    # Trigger reload - step 2
    uvicorn.run(app, host="0.0.0.0", port=8000)