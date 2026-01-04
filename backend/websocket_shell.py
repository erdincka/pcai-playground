from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import asyncio
import os
import pty
import subprocess

logger = logging.getLogger(__name__)

router = APIRouter()


class ShellProxy:
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.fd = None
        self.process = None

    async def connect(self):
        await self.websocket.accept()
        logger.info(f"Shell connected for session {self.session_id}")

        # Create a pseudo-terminal
        master_fd, slave_fd = pty.openpty()

        # Start the bash process
        self.process = await asyncio.create_subprocess_exec(
            "bash",
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid,
            env=os.environ.copy(),
        )

        self.fd = master_fd

        # Helper to read from process and send to websocket
        async def read_from_pty():
            try:
                while self.fd is not None:
                    # Use asyncio.to_thread for blocking read or non-blocking read
                    data = await asyncio.get_event_loop().run_in_executor(
                        None, os.read, self.fd, 1024
                    )
                    if not data:
                        break
                    await self.websocket.send_text(
                        data.decode("utf-8", errors="replace")
                    )
            except Exception as e:
                logger.debug(f"PTY read end: {e}")

        # Start the reader task
        read_task = asyncio.create_task(read_from_pty())

        try:
            while True:
                data = await self.websocket.receive_text()
                if self.fd is not None:
                    # Write websocket input to PTY master
                    os.write(self.fd, data.encode())

        except WebSocketDisconnect:
            logger.info(f"Shell disconnected for session {self.session_id}")
        except Exception as e:
            logger.error(f"Shell error: {e}")
        finally:
            read_task.cancel()
            if self.process:
                try:
                    self.process.terminate()
                    await self.process.wait()
                except Exception:
                    pass
            if self.fd is not None:
                try:
                    os.close(self.fd)
                except Exception:
                    pass
                self.fd = None


@router.websocket("/shell/exec")
async def websocket_shell(websocket: WebSocket, sessionId: str):
    proxy = ShellProxy(websocket, sessionId)
    await proxy.connect()
