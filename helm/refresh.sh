#!/usr/bin/env bash

# Update images, upgrade chart in-place

### MAKE SURE CORRECT KUBECONFIG IS SELECTED!

# Images tagged for latest
# pushd .. >/dev/null
# ./build-and-push.sh v0.1.0

# Helm upgrade with mandatory settings (ie, domainname)
helm upgrade playground helm/playground --namespace playground --set ezua.domainName=demo.lon-pcai.twlon.com --set ezua.virtualService.endpoint=playground.demo.lon-pcai.twlon.com

# popd >/dev/null