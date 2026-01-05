# Development environment setup

# Port-forward to your localhost if required
default_registry('localhost:5000')

docker_build(
    'playground-backend',
    context='./backend',
    dockerfile='./backend/Dockerfile',
    live_update=[
        fall_back_on(['backend/requirements.txt']),
        sync('./backend', '/app'),
    ]
)

docker_build(
    'playground-frontend',
    context='./frontend',
    dockerfile='./frontend/Dockerfile',
    target='dev',
    live_update=[
        fall_back_on(['frontend/package.json', 'frontend/package-lock.json']),
        sync('./frontend', '/app'),
    ]
)

docker_build(
    'playground-toolbox:dev',
    context='./toolbox',
    dockerfile='./toolbox/Dockerfile',
    live_update=[sync('./toolbox', '/')],
)

k8s_yaml('dev/manifests.yaml')

k8s_resource('playground-backend', port_forwards=8000)
k8s_resource('playground-frontend', port_forwards=3000)
k8s_resource('postgres', port_forwards=5432)

allow_k8s_contexts('zbook')
update_settings(suppress_unused_image_warnings=["playground-toolbox:dev"])