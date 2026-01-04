import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models import UserSessionDB, SessionStatus
from kubernetes_ops import KubernetesOps

logger = logging.getLogger(__name__)


class ExpiryController:
    def __init__(self, db_session_factory, k8s_ops: KubernetesOps):
        self.db_session_factory = db_session_factory
        self.k8s_ops = k8s_ops

    async def check_expired_sessions(self):
        """Checks for expired sessions and cleans up resources."""
        logger.info("Running expiry check...")
        db: Session = self.db_session_factory()
        try:
            now = datetime.utcnow()
            expired_sessions = (
                db.query(UserSessionDB)
                .filter(
                    UserSessionDB.status == SessionStatus.ACTIVE,
                    UserSessionDB.expires_at <= now,
                )
                .all()
            )

            for session in expired_sessions:
                logger.info(
                    f"Session {session.session_uuid} for user {session.user_id} has expired."
                )
                try:
                    # Cleanup K8s
                    self.k8s_ops.delete_sandbox_namespace(session.sandbox_namespace)

                    # Update DB status
                    session.status = SessionStatus.EXPIRED
                    db.commit()
                except Exception as e:
                    logger.error(
                        f"Failed to cleanup expired session {session.session_uuid}: {e}"
                    )
                    db.rollback()
        finally:
            db.close()

    async def update_resource_usage(self):
        """Periodically snapshots resource usage for active sessions."""
        db: Session = self.db_session_factory()
        try:
            active_sessions = (
                db.query(UserSessionDB)
                .filter(UserSessionDB.status == SessionStatus.ACTIVE)
                .all()
            )

            for session in active_sessions:
                usage = self.k8s_ops.get_namespace_usage(session.sandbox_namespace)
                session.resource_quota_used = usage
                session.last_activity = datetime.utcnow()
                db.commit()
        finally:
            db.close()
