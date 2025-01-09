import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {jsonStringify} from "@pulumi/pulumi";

const config = new pulumi.Config();
const gitToken = config.requireSecret('git-token');

const env = {
  GIT_TOKEN: gitToken,
};

export interface InitialRepository {
    url?: string;
    branch?: string;
    path?: string;
}

export interface ArgoCDArgs {
    initialObjects?: pulumi.asset.FileAsset
    namespace?: pulumi.Input<string>;
    version?: pulumi.Input<string>;
}

export class ArgoCD extends pulumi.ComponentResource {
    readonly namespace: pulumi.Input<string>;

    constructor(name: string,
                args: ArgoCDArgs,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:ArgoCD", name, {}, opts);

   
        const pulumiAccessToken = new k8s.core.v1.Secret("pulumi-access-token", {
            metadata: {
                name: "pulumi-access-token",
                namespace: 'default'
            },
            type: "Opaque",
            stringData: {
              "PULUMI_ACCESS_TOKEN": config.require("PULUMI_PAT")
            }
        }, {
            parent: this,
        });

        const argocd = new k8s.helm.v3.Release("argocd", {
            chart: "argo-cd",
            version: args.version || "7.6.12",
            repositoryOpts: {
                repo: "https://argoproj.github.io/argo-helm",
            },
            createNamespace: true,
            namespace: args.namespace || "argocd",
            values: {
                configs: {
                    secret: {
                        argocdServerAdminPassword: "$2a$10$RjjTokiJSaTQt8jAMOUTK.O0VIZ3.0AEs3/JxtaFKGZir93yFPEOG",
                        argocdServerAdminPasswordMtime: "2025-01-01T09:23:16Z"
                    },
                    params: {
                        "server\.insecure": true,
                    }
                },
                server: {}
            }
        }, {
            parent: this,
            ignoreChanges: ["checksum", "version", "values"],
        });


        const argocdApps = new k8s.helm.v3.Release("argocd-apps", {
            chart: "argocd-apps",
            repositoryOpts: argocd.repositoryOpts,
            namespace: argocd.namespace,
            createNamespace: false,
            valueYamlFiles: [
                args.initialObjects || new pulumi.asset.FileAsset(""),
            ],
            values: {
                env: env
            }
        }, {
            parent: this,
            dependsOn: argocd,
            ignoreChanges: ["checksum"],
        });

        const inCluster = new k8s.core.v1.Secret("in-cluster", {
            metadata: {
                name: "in-cluster",
                namespace: argocd.namespace,
                labels: {
                    "argocd.argoproj.io/secret-type": "cluster",
                }
            },
            type: "Opaque",
            stringData: {
                "name": "in-cluster",
                "server": "https://kubernetes.default.svc",
                "config": jsonStringify({
                    "tlsClientConfig": {
                        "insecure": false,
                    }
                })
            }
        }, {
            parent: this,
            dependsOn: argocd,
        });

        this.namespace = argocd.namespace;
        this.registerOutputs({
            namespace: this.namespace
        });
    }
}