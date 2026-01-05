from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import asyncio
import subprocess
import os
import pty
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UserSessionDB, SessionStatus

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/shell/{session_id}")
async def websocket_shell(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    db: Session = SessionLocal()
    try:
        session = db.query(UserSessionDB).filter(UserSessionDB.session_uuid == session_id).first()
        if not session or session.status != SessionStatus.ACTIVE:
            await websocket.close(code=4004, reason="Session not found or inactive")
            return
        
        sandbox_ns = session.sandbox_namespace
        logger.info(f"Connecting to toolbox in {sandbox_ns} for session {session_id}")
        
    finally:
        db.close()

    # Create PTY
    master_fd, slave_fd = pty.openpty()

    # kubectl exec command
    # We use -i -t to allocate a TTY in the container
    try:
        proc = await asyncio.create_subprocess_exec(
            "kubectl", "exec", "-n", sandbox_ns, "playground-toolbox", "-i", "-t",
            "--", "/bin/bash",
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid
        )
    except Exception as e:
        logger.error(f"Failed to start kubectl exec: {e}")
        os.close(master_fd)
        os.close(slave_fd)
        await websocket.close(code=4000, reason="Failed to start shell")
        return

    # Close slave_fd in parent as it's used by child
    os.close(slave_fd)

    loop = asyncio.get_running_loop()
    output_queue = asyncio.Queue()

    def read_from_pty():
        try:
            data = os.read(master_fd, 1024)
            if data:
                asyncio.run_coroutine_threadsafe(output_queue.put(data), loop)
            else:
                asyncio.run_coroutine_threadsafe(output_queue.put(None), loop)
        except OSError:
            asyncio.run_coroutine_threadsafe(output_queue.put(None), loop)

    loop.add_reader(master_fd, read_from_pty)

    async def pipe_output():
        try:
            while True:
                data = await output_queue.get()
                if data is None:
                    break
                await websocket.send_text(data.decode("utf-8", errors="replace"))
        except Exception as e:
            logger.debug(f"Output pipe ended: {e}")

    output_task = asyncio.create_task(pipe_output())

    try:
        while True:
            data = await websocket.receive_text()
            # Write to master_fd
            try:
                os.write(master_fd, data.encode())
            except OSError:
                break
    except WebSocketDisconnect:
        logger.info(f"Shell disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Shell connection error: {e}")
    finally:
        loop.remove_reader(master_fd)
        try:
            os.close(master_fd)
        except OSError:
            pass
        output_task.cancel()
        if proc.returncode is None:
            proc.terminate()
            try:
                await proc.wait()
            except Exception:
                pass