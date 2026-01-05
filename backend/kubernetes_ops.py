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
        self.rbac = client.RbacAuthorizationV1Api()
        self.custom_objects = client.CustomObjectsApi()

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
        except ApiException as e:
            logger.error(f"Error setting up RBAC for {namespace_name}: {e}")
            raise

    def deploy_toolbox(self, sandbox_namespace: str):
        """Deploys the toolbox pod to the sandbox namespace."""
        toolbox_image = os.getenv("TOOLBOX_IMAGE", "playground-toolbox:latest")

        # We don't necessarily need to mount kubeconfig if we rely on ServiceAccount injection
        # but following instructions partially, we will use the ServiceAccount we created.

        toolbox_manifest = client.V1Pod(
            metadata=client.V1ObjectMeta(
                name="playground-toolbox",
                namespace=sandbox_namespace,
                labels={"app": "toolbox"},
            ),
            spec=client.V1PodSpec(
                service_account_name="sandbox-sa",
                containers=[
                    client.V1Container(
                        name="toolbox",
                        image=toolbox_image,
                        command=["/bin/bash"],
                        args=[
                            "-c",
                            "trap : TERM INT; sleep infinity & wait",
                        ],  # Keep alive
                        tty=True,
                        stdin=True,
                        resources=client.V1ResourceRequirements(
                            limits={"cpu": "500m", "memory": "512Mi"},
                            requests={"cpu": "100m", "memory": "128Mi"},
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
            return quota.status.used if quota.status else {}
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