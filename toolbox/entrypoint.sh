#!/bin/bash
set -e

# Setup kubeconfig if mounted
if [ -f /root/.kube/config ]; then
    export KUBECONFIG=/root/.kube/config
fi

exec "$@"