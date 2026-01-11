import logging
import os
import subprocess
from kubernetes import client, config
from kubernetes.client.rest import ApiException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KubernetesOps:
    def __init__(self):
        try:
            config.load_incluster_config()
        except config.ConfigException:
            config.load_kube_config()

        self.v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.networking_v1 = client.NetworkingV1Api()
        self.rbac = client.RbacAuthorizationV1Api()
        self.custom_objects = client.CustomObjectsApi()

    def create_network_policy(self, namespace_name: str):
        """Creates a NetworkPolicy to isolate the sandbox."""
        # Allow traffic from ingress (istio) and the platform monitoring
        # Deny traffic to other tenant namespaces
        
        # Note: This is a basic policy. In a strict multi-tenant env, 
        # we would deny all ingress except from specific sources.
        policy = client.V1NetworkPolicy(
            metadata=client.V1ObjectMeta(name="sandbox-isolation", namespace=namespace_name),
            spec=client.V1NetworkPolicySpec(
                pod_selector=client.V1LabelSelector(match_labels={}),
                policy_types=["Ingress"],
                ingress=[
                    # Allow traffic from within the same namespace
                    client.V1NetworkPolicyIngressRule(
                        from_=[
                            client.V1NetworkPolicyPeer(
                                pod_selector=client.V1LabelSelector(match_labels={})
                            )
                        ]
                    ),
                    # Allow traffic from istio-system (ingress gateway)
                    client.V1NetworkPolicyIngressRule(
                        from_=[
                            client.V1NetworkPolicyPeer(
                                namespace_selector=client.V1LabelSelector(
                                    match_labels={"kubernetes.io/metadata.name": "istio-system"}
                                )
                            )
                        ]
                    ),
                    # Allow traffic from playground (backend/frontend)
                    # Assuming playground is installed in a specific namespace (e.g. 'playground')
                    # or labelled specifically. 
                    # For now, we allow from any namespace with 'hpe-ezua/type: vendor-service'
                    # which playground components should have.
                    client.V1NetworkPolicyIngressRule(
                        from_=[
                            client.V1NetworkPolicyPeer(
                                namespace_selector=client.V1LabelSelector(
                                    match_labels={"hpe-ezua/type": "vendor-service"}
                                )
                            )
                        ]
                    ),
                ]
            )
        )
        try:
            self.networking_v1.create_namespaced_network_policy(namespace_name, policy)
            logger.info(f"Created NetworkPolicy in {namespace_name}")
        except ApiException as e:
            logger.error(f"Error creating NetworkPolicy for {namespace_name}: {e}")
            # Non-critical for now, but should be logged
            pass

    def create_sandbox_namespace(self, namespace_name: str, user_id: str):
        """Creates a new sandbox namespace with labels."""
        body = client.V1Namespace(
            metadata=client.V1ObjectMeta(
                name=namespace_name,
                labels={
                    "app": "pcai-playground",
                    "created-by": "playground-api",
                    "user-id": user_id,
                    "type": "sandbox",
                },
            )
        )
        try:
            self.v1.create_namespace(body=body)
            logger.info(f"Created namespace: {namespace_name}")
        except ApiException as e:
            if e.status != 409:  # Ignore if already exists
                logger.error(f"Error creating namespace {namespace_name}: {e}")
                raise

    def apply_quotas(self, namespace_name: str):
        """Applies ResourceQuota and LimitRange to the namespace."""
        # 20 cores / 64GB quota per session as per requirements
        quota = client.V1ResourceQuota(
            metadata=client.V1ObjectMeta(name="sandbox-quota"),
            spec=client.V1ResourceQuotaSpec(
                hard={
                    "cpu": "20",
                    "memory": "64Gi",
                    "pods": "20",
                    "persistentvolumeclaims": "5",
                    "services": "10",
                }
            ),
        )

        limit_range = client.V1LimitRange(
            metadata=client.V1ObjectMeta(name="sandbox-limits"),
            spec=client.V1LimitRangeSpec(
                limits=[
                    client.V1LimitRangeItem(
                        default={"cpu": "2", "memory": "4Gi"},
                        default_request={"cpu": "500m", "memory": "1Gi"},
                        type="Container",
                    )
                ]
            ),
        )

        try:
            self.v1.create_namespaced_resource_quota(namespace_name, quota)
            self.v1.create_namespaced_limit_range(namespace_name, limit_range)
        except ApiException as e:
            logger.error(f"Error applying quotas to {namespace_name}: {e}")
            raise

    def copy_user_secret(self, user_id: str, target_namespace: str):
        """Finds the user's access-token secret and copies it to the target namespace."""
        try:
            # Find the secret across all namespaces.
            # We filter by resource type first, then match the project label manually
            # because the project label contains random suffix (user-{user_id}-{random})
            selector = "ezprojects.hpe.com/resource=access-token"
            secrets = self.v1.list_secret_for_all_namespaces(label_selector=selector)
            
            source_secret = None
            for secret in secrets.items:
                project_label = secret.metadata.labels.get("ezprojects.hpe.com/ezproject", "")
                if project_label.startswith(f"user-{user_id}"):
                    source_secret = secret
                    break

            if not source_secret:
                logger.warning(f"No access-token secret found for user {user_id}")
                return

            logger.info(f"Found access-token secret for {user_id} in {source_secret.metadata.namespace}")

            # Create the new secret in the target namespace
            new_secret = client.V1Secret(
                metadata=client.V1ObjectMeta(
                    name="access-token",
                    namespace=target_namespace,
                    labels={
                        "created-by": "playground-api",
                        "user-id": user_id
                    }
                ),
                data=source_secret.data,
                type=source_secret.type
            )

            self.v1.create_namespaced_secret(target_namespace, new_secret)
            logger.info(f"Copied access-token secret to {target_namespace}")

        except ApiException as e:
            logger.error(f"Error copying secret for user {user_id}: {e}")

    def setup_rbac(self, namespace_name: str, user_id: str):
        """Sets up sandbox-specific RBAC (Role + RoleBinding)."""
        # Create ServiceAccount for toolbox
        sa = client.V1ServiceAccount(
            metadata=client.V1ObjectMeta(name="sandbox-sa", namespace=namespace_name)
        )

        # Role allowing full access within the sandbox namespace
        role = client.V1Role(
            metadata=client.V1ObjectMeta(
                name="sandbox-user-role", namespace=namespace_name
            ),
            rules=[
                client.V1PolicyRule(
                    api_groups=[
                        "",
                        "apps",
                        "batch",
                        "networking.k8s.io",
                        "serving.kserve.io",
                        "networking.istio.io",
                        "rbac.authorization.k8s.io",
                    ],
                    resources=["*"],
                    verbs=["*"],
                )
            ],
        )

        # Binding the role to the user (identified by user_id from OIDC)
        # AND to the sandbox-sa ServiceAccount
        binding = client.V1RoleBinding(
            metadata=client.V1ObjectMeta(
                name="sandbox-user-binding", namespace=namespace_name
            ),
            subjects=[
                client.RbacV1Subject(
                    kind="User", name=user_id, api_group="rbac.authorization.k8s.io"
                ),
                client.RbacV1Subject(
                    kind="ServiceAccount", name="sandbox-sa", namespace=namespace_name
                ),
            ],
            role_ref=client.V1RoleRef(
                kind="Role",
                name="sandbox-user-role",
                api_group="rbac.authorization.k8s.io",
            ),
        )

        try:
            self.v1.create_namespaced_service_account(namespace_name, sa)
            self.rbac.create_namespaced_role(namespace_name, role)
            self.rbac.create_namespaced_role_binding(namespace_name, binding)

            # Create ClusterRoleBinding for cluster-wide read access (Kyverno, Cert-Manager)
            crb_name = f"sandbox-viewer-{namespace_name}"
            crb = client.V1ClusterRoleBinding(
                metadata=client.V1ObjectMeta(name=crb_name),
                subjects=[
                    client.RbacV1Subject(
                        kind="ServiceAccount",
                        name="sandbox-sa",
                        namespace=namespace_name
                    )
                ],
                role_ref=client.V1RoleRef(
                    kind="ClusterRole",
                    name="playground-sandbox-viewer",
                    api_group="rbac.authorization.k8s.io"
                )
            )
            self.rbac.create_cluster_role_binding(crb)
            logger.info(f"Created ClusterRoleBinding: {crb_name}")

        except ApiException as e:
            logger.error(f"Error setting up RBAC for {namespace_name}: {e}")
            raise

    def deploy_toolbox(self, sandbox_namespace: str, user_id: str = None):
        """Deploys the toolbox pod to the sandbox namespace."""
        if user_id:
            self.copy_user_secret(user_id, sandbox_namespace)

        toolbox_image = os.getenv("TOOLBOX_IMAGE", "playground-toolbox:latest")

        # AI Essentials / Platform Environment Variables
        env_vars = [
            client.V1EnvVar(name="MLFLOW_TRACKING_URI", value=os.getenv("MLFLOW_TRACKING_URI", "http://mlflow-tracking-service.kubeflow.svc.cluster.local:5000")),
            client.V1EnvVar(name="S3_ENDPOINT", value=os.getenv("S3_ENDPOINT", "http://minio.minio.svc.cluster.local:9000")),
        ]

        toolbox_manifest = client.V1Pod(
            metadata=client.V1ObjectMeta(
                name="playground-toolbox",
                namespace=sandbox_namespace,
                labels={
                    "app": "toolbox", 
                    "add-user-info-config": "true",
                    "sidecar.istio.io/inject": "true" # Ensure sidecar is injected for mTLS
                },
                annotations={"hpe-ezua/add-auth-token": "true"},
            ),
            spec=client.V1PodSpec(
                service_account_name="sandbox-sa",
                containers=[
                    client.V1Container(
                        name="toolbox",
                        image=toolbox_image,
                        image_pull_policy="Always",
                        command=["/bin/bash"],
                        args=[
                            "-c",
                            "trap : TERM INT; sleep infinity & wait",
                        ],  # Keep alive
                        tty=True,
                        stdin=True,
                        env=env_vars,
                        resources=client.V1ResourceRequirements(
                            limits={"cpu": "1000m", "memory": "1Gi"},
                            requests={"cpu": "100m", "memory": "256Mi"},
                        ),
                        security_context=client.V1SecurityContext(
                            run_as_non_root=True,
                            run_as_user=1000,
                            allow_privilege_escalation=False,
                            capabilities=client.V1Capabilities(drop=["ALL"]),
                        ),
                    )
                ],
                security_context=client.V1PodSecurityContext(
                    run_as_non_root=True, run_as_user=1000, fs_group=1000
                ),
            ),
        )

        try:
            self.v1.create_namespaced_pod(sandbox_namespace, toolbox_manifest)
            logger.info(f"Deployed toolbox pod to {sandbox_namespace}")
        except ApiException as e:
            logger.error(f"Error deploying toolbox to {sandbox_namespace}: {e}")
            raise

    def delete_sandbox_namespace(self, namespace_name: str):
        """Deletes the sandbox namespace and all resources within it."""
        # Delete associated ClusterRoleBinding
        crb_name = f"sandbox-viewer-{namespace_name}"
        try:
            self.rbac.delete_cluster_role_binding(name=crb_name)
            logger.info(f"Deleted ClusterRoleBinding: {crb_name}")
        except ApiException as e:
            if e.status != 404:
                logger.error(f"Error deleting ClusterRoleBinding {crb_name}: {e}")

        try:
            self.v1.delete_namespace(name=namespace_name)
            logger.info(f"Deleted namespace: {namespace_name}")
        except ApiException as e:
            if e.status != 404:
                logger.error(f"Error deleting namespace {namespace_name}: {e}")
                raise

    def get_namespace_usage(self, namespace_name: str):
        """Gets current resource usage for the namespace."""
        try:
            quota = self.v1.read_namespaced_resource_quota(
                "sandbox-quota", namespace_name
            )
            return quota.status.used if quota.status else {}  # type: ignore
        except ApiException:
            return {}

    def apply_manifest(self, namespace_name: str, manifest_content: str):
        """Applies a YAML manifest to the namespace using kubectl."""
        try:
            cmd = ["kubectl", "apply", "-f", "-", "-n", namespace_name]
            process = subprocess.run(
                cmd,
                input=manifest_content.encode("utf-8"),
                check=True,
                capture_output=True,
            )
            logger.info(f"Applied manifest to {namespace_name}")
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode("utf-8")
            logger.error(f"Error applying manifest: {error_msg}")
            raise Exception(f"Failed to apply manifest: {error_msg}")

    def delete_manifest(self, namespace_name: str, manifest_content: str):
        """Deletes resources defined in a YAML manifest from the namespace using kubectl."""
        try:
            cmd = ["kubectl", "delete", "-f", "-", "-n", namespace_name]
            process = subprocess.run(
                cmd,
                input=manifest_content.encode("utf-8"),
                check=True,
                capture_output=True,
            )
            logger.info(f"Deleted manifest resources from {namespace_name}")
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode("utf-8")
            logger.error(f"Error deleting manifest: {error_msg}")
            raise Exception(f"Failed to delete manifest: {error_msg}")

    def list_resources(self, namespace_name: str):
        """Lists key resources in the namespace."""
        resources = {}
        try:
            # Pods
            pods = self.v1.list_namespaced_pod(namespace_name)
            resources["pods"] = [p.metadata.name for p in pods.items]

            # Services
            services = self.v1.list_namespaced_service(namespace_name)
            resources["services"] = [s.metadata.name for s in services.items]

            # Deployments
            deployments = self.apps_v1.list_namespaced_deployment(namespace_name)
            resources["deployments"] = [d.metadata.name for d in deployments.items]

            # Secrets
            secrets = self.v1.list_namespaced_secret(namespace_name)
            resources["secrets"] = [
                s.metadata.name
                for s in secrets.items
                if not s.metadata.name.startswith("default-token")
            ]

            # PVCs
            pvcs = self.v1.list_namespaced_persistent_volume_claim(namespace_name)
            resources["pvcs"] = [p.metadata.name for p in pvcs.items]

            return resources
        except ApiException as e:
            logger.error(f"Error listing resources in {namespace_name}: {e}")
            return {}

    def delete_resource(self, namespace_name: str, kind: str, name: str):
        """Deletes a specific resource."""
        try:
            if kind == "pod":
                self.v1.delete_namespaced_pod(name, namespace_name)
            elif kind == "service":
                self.v1.delete_namespaced_service(name, namespace_name)
            elif kind == "deployment":
                self.apps_v1.delete_namespaced_deployment(name, namespace_name)
            elif kind == "secret":
                self.v1.delete_namespaced_secret(name, namespace_name)
            elif kind == "pvc":
                self.v1.delete_namespaced_persistent_volume_claim(name, namespace_name)
            else:
                raise ValueError(f"Unsupported resource kind: {kind}")
        except ApiException as e:
            logger.error(f"Error deleting {kind} {name} in {namespace_name}: {e}")
            raise