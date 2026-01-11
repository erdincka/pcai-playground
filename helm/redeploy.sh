#!/usr/bin/env bash

set -euo pipefail

# Remove, re-package, and re-deploy ezapp

### MAKE SURE CORRECT KUBECONFIG IS SELECTED!

# Delete the ezapp deployment
kubectl delete -f playground-ezapp.yaml

# Get version from Chart.yaml
VERSION=$(grep '^version:' ./playground/Chart.yaml | awk '{print $2}')
echo "Processing version: $VERSION"

# Package the chart
helm package ./playground

# Forward chartmuseum port for localhost
kubectl port-forward -n ez-chartmuseum-ns svc/chartmuseum 8080:8080 &

sleep 3

# Delete the old chart (if it exists)
curl -X DELETE http://localhost:8080/api/charts/playground/$VERSION || true

# Upload the new chart
curl http://localhost:8080/api/charts --data-binary "@playground-$VERSION.tgz"

# Install the ezapp
kubectl apply -f playground-ezapp.yaml

# Kill the port-forward
kill %1

echo "Redeployed"