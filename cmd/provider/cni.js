"use strict";
// Copyright 2016-2020, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.vpcCniProviderFactory = void 0;
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const process = require("process");
const tmp = require("tmp");
const which = require("which");
function applyVpcCniYaml(args) {
    // Check to ensure that kubectl is installed, as we'll need it in order to deploy k8s resources below.
    try {
        which.sync("kubectl");
    }
    catch (err) {
        throw new Error("Could not set VPC CNI options: kubectl is missing. See https://kubernetes.io/docs/tasks/tools/install-kubectl/#install-kubectl for installation instructions.");
    }
    const yamlPath = path.join(__dirname, "..", "..", "cni", "calico-vxlan.yaml");
    const kubeconfig = typeof args.kubeconfig === "string"
        ? args.kubeconfig
        : JSON.stringify(args);
    // Dump the kubeconfig to a file.
    const tmpKubeconfig = tmp.fileSync();
    fs.writeFileSync(tmpKubeconfig.fd, kubeconfig);
    // Call kubectl to apply the YAML.
    childProcess.execSync(`kubectl apply -f ${yamlPath}`, {
        env: Object.assign(Object.assign({}, process.env), { "KUBECONFIG": tmpKubeconfig.name }),
    });
}
/** @internal */
function vpcCniProviderFactory() {
    return {
        check: (urn, olds, news) => {
            let inputs = news;
            // Since this used to be implemented as a dynamic provider, if we have an old `__provider`
            // input, propagate it to the new inputs so the engine doesn't see a diff, to avoid any
            // unnecessary calls to `update`.
            if (olds.__provider && !news.__provider) {
                inputs = Object.assign(Object.assign({}, news), { __provider: olds.__provider });
            }
            return Promise.resolve({ inputs });
        },
        create: (urn, inputs) => {
            try {
                applyVpcCniYaml(inputs);
            }
            catch (e) {
                return Promise.reject(e);
            }
            return Promise.resolve({ id: crypto.randomBytes(8).toString("hex"), outs: {} });
        },
        update: (id, urn, olds, news) => {
            try {
                applyVpcCniYaml(news);
            }
            catch (e) {
                return Promise.reject(e);
            }
            return Promise.resolve({ outs: {} });
        },
        version: "",
    };
}
exports.vpcCniProviderFactory = vpcCniProviderFactory;
//# sourceMappingURL=cni.js.map