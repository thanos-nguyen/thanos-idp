import * as k8s from "@pulumi/kubernetes";

/*const appLabels = { app: "nginx" };
const deployment = new k8s.apps.v1.Deployment("nginx", {
    spec: {
        selector: { matchLabels: appLabels },
        replicas: 1,
        template: {
            metadata: { labels: appLabels },
            spec: { containers: [{ name: "nginx", image: "nginx" }] }
        }
    }
});
export const name = deployment.metadata.name;*/

import * as pulumi from "@pulumi/pulumi";
import {ArgoCD} from "./argocd";

let initialObjects = new pulumi.asset.FileAsset("./argocd-initial-objects.yaml");

const argocd = new ArgoCD("argocd", {
    initialObjects: initialObjects,
    version: "7.7.0",
})