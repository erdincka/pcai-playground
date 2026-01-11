# HPE PCAI Kubernetes Playground

A self-contained Kubernetes learning platform for HPE PCAI (Private Cloud AI). This application provides a safe, isolated environment for users to learn and experiment with Kubernetes, utilizing a web-based terminal, code editor, and lab catalog.

## Architecture

- **Frontend**: Next.js 15, Tailwind, shadcn/ui, Monaco Editor, xterm.js
- **Backend**: FastAPI, SQLAlchemy, K8s Python Client
- **Orchestration**: Automatic namespace provisioning, RBAC, and Quotas per user session.
- **Toolbox**: Alpine-based container with pre-installed tools (kubectl, helm, mc, etc.) for the user shell.

## Prerequisites

- **HPE Private Cloud AI** with admin access to add app using the "Import Framework" wizad.

## Local Development

The project uses [Tilt](https://tilt.dev/) for a rapid feedback loop.

1.  **Start your local Kubernetes cluster** (e.g., `colima start --kubernetes`).
2.  **Run Tilt**:
    ```bash
    tilt up
    ```
    This will build the images, deploy them to the `dev` namespace, and port-forward the services.

3.  **Access the application**:
    - Frontend: [http://localhost:3000](http://localhost:3000)
    - Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

## Deployment on HPE PCAI

The application is packaged as a Helm chart optimized for HPE PCAI environments.

### 1. Configuration

Review `helm/playground/values.yaml` for configuration options. Key parameters:
- `ezua.domainName`: The base domain for the environment.
- `postgresql.auth.password`: Database password (can be auto-generated or supplied via Secret).
- `backend.image`: Repository and tag for backend image, defaults to `erdincka/playground-backend:latest`
- `frontend.image`: Repository and tag for frontend image, defaults to `erdincka/playground-frontend:latest`

### 2. Deploy Using Import Framework

Follow the guide to install extra frameworks to HPE PCAI.

### 3. Security

- **Secrets**: The database password is managed via Kubernetes Secrets. You can provide your own secret by setting `postgresql.auth.existingSecret`.
- **RBAC**: The backend requires permissions to create Namespaces, RoleBindings, and Quotas. Review the `helm/playground/templates/rbac.yaml` for details.
- **Non-Root**: All containers run as non-root users for improved security.

## Features

- **Lab Catalog**: Curated labs across Foundations, K8s, Data & AI.
- **Web Shell**: Integrated xterm.js terminal proxying to K8s pods.
- **Code Editor**: Monaco-based YAML editor for manifest application.
- **Admin Dashboard**: Real-time monitoring of cluster resources.
- **Auto-Cleanup**: Background worker for session expiry and resource reclamation.

## Video Walkthrough

![demo](https://github.com/user-attachments/assets/83acffd3-781a-46be-a34c-db74a8a2c84b)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit issues and pull requests.
Please also review our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
