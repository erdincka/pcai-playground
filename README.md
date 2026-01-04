# HPE PCAI Kubernetes Playground

A self-contained Kubernetes learning platform for HPE PCAI.

## Architecture

- **Frontend**: Next.js 15, Tailwind, shadcn/ui, Monaco Editor, xterm.js
- **Backend**: FastAPI, SQLAlchemy, K8s Python Client
- **Orchestration**: Automatic namespace provisioning, RBAC, and Quotas per user session.

## Local Development

### 1. Backend
```bash
pip install -r requirements.txt
python main.py
```
Backend runs at `http://localhost:8000`.

### 2. Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Frontend runs at `http://localhost:3000`.

## PCAI Deployment (Helm)

```bash
helm upgrade --install playground ./helm/playground
```

## Features

- **Lab Catalog**: 15 labs across Foundations, K8s, Data & AI.
- **Web Shell**: Integrated xterm.js terminal proxying to K8s pods.
- **Code Editor**: Monaco-based YAML editor for manifest application.
- **Admin Dashboard**: Real-time monitoring of cluster resources.
- **Auto-Cleanup**: Background worker for session expiry and resource reclamation.
