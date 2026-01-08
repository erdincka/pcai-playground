FROM alpine:3.20

# Install basic tools and AI Essentials (mlflow, boto3, mc)
RUN apk add --no-cache \
    curl wget git htop bash bash-completion openssl \
    python3 py3-pip jq yq \
    # enable gcc
    build-base gcc g++ musl-dev \
    python3-dev
# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl && mv kubectl /usr/local/bin/
# Install helm
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \
    && chmod 700 get_helm.sh \
    && ./get_helm.sh \
    && rm get_helm.sh
# Install MinIO Client (mc)
RUN curl https://dl.min.io/client/mc/release/linux-amd64/mc \
    --create-dirs -o /usr/local/bin/mc \
    && chmod +x /usr/local/bin/mc
# Install Python AI tools
RUN pip3 install --break-system-packages mlflow boto3 kubernetes

# Setup completions
RUN mkdir -p /etc/bash_completion.d \
    && kubectl completion bash > /etc/bash_completion.d/kubectl \
    && helm completion bash > /etc/bash_completion.d/helm

# Add entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create sandbox user
RUN adduser -D -u 1000 sandbox

# Configure bash completion for sandbox user
RUN echo "source /usr/share/bash-completion/bash_completion" >> /home/sandbox/.bashrc \
    && echo "alias k=kubectl" >> /home/sandbox/.bashrc \
    && echo "complete -o default -F __start_kubectl k" >> /home/sandbox/.bashrc

WORKDIR /home/sandbox
USER sandbox

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash"]