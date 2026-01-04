# Tiltfile for PCAI Playground Development

# 1. Build Backend
docker_build(
    'localhost:5000/playground-backend',
    context='./backend',
    dockerfile='./backend/Dockerfile',
    live_update=[
        sync('./backend', '/app'),
        run('pip install -r requirements.txt', trigger='requirements.txt'),
    ]
)

# 2. Build Frontend
docker_build(
    'localhost:5000/playground-frontend',
    context='./frontend',
    dockerfile='./frontend/Dockerfile',
    live_update=[
        sync('./frontend', '/app'),
        run('npm install --legacy-peer-deps', trigger='frontend/package.json'),
    ]
)

# 3. Deploy the development manifests
k8s_yaml('dev/manifests.yaml')

# 4. Port forward for local testing
k8s_resource('playground-backend', port_forwards=8000)
k8s_resource('playground-frontend', port_forwards=3000)
k8s_resource('postgres', port_forwards=5432)

# 5. Settings
allow_k8s_contexts('zbook')
