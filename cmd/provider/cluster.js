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
exports.clusterCreationRoleProviderProviderFactory = exports.clusterProviderFactory = void 0;
const cluster_1 = require("../../cluster");
const clusterProvider = {
    construct: (name, type, inputs, options) => {
        try {
            const cluster = new cluster_1.Cluster(name, inputs, options);
            return Promise.resolve({
                urn: cluster.urn,
                state: {
                    kubeconfig: cluster.kubeconfig,
                    awsProvider: cluster.awsProvider,
                    provider: cluster.provider,
                    clusterSecurityGroup: cluster.clusterSecurityGroup,
                    instanceRoles: cluster.instanceRoles,
                    nodeSecurityGroup: cluster.nodeSecurityGroup,
                    eksClusterIngressRule: cluster.eksClusterIngressRule,
                    defaultNodeGroup: cluster.defaultNodeGroup,
                    eksCluster: cluster.eksCluster,
                    core: cluster.core,
                },
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    },
    version: "",
};
/** @internal */
function clusterProviderFactory() {
    return clusterProvider;
}
exports.clusterProviderFactory = clusterProviderFactory;
const clusterCreationRoleProviderProvider = {
    construct: (name, type, inputs, options) => {
        try {
            const roleProvider = new cluster_1.ClusterCreationRoleProvider(name, inputs, options);
            return Promise.resolve({
                urn: roleProvider.urn,
                state: {
                    role: roleProvider.role,
                    provider: roleProvider.provider,
                },
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    },
    version: "",
};
/** @internal */
function clusterCreationRoleProviderProviderFactory() {
    return clusterCreationRoleProviderProvider;
}
exports.clusterCreationRoleProviderProviderFactory = clusterCreationRoleProviderProviderFactory;
//# sourceMappingURL=cluster.js.map