FROM alpine:3.20

# Install basic tools
RUN apk add --no-cache \
    curl wget git htop bash \
    python3 py3-pip jq yq \
    # Install kubectl
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl && mv kubectl /usr/local/bin/

# Add entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /home

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash"]