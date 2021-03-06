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
exports.managedNodeGroupProviderFactory = exports.nodeGroupProviderFactory = void 0;
const nodegroup_1 = require("../../nodegroup");
const nodeGroupProvider = {
    construct: (name, type, inputs, options) => {
        try {
            const nodegroup = new nodegroup_1.NodeGroup(name, inputs, options);
            return Promise.resolve({
                urn: nodegroup.urn,
                state: {
                    nodeSecurityGroup: nodegroup.nodeSecurityGroup,
                    extraNodeSecurityGroups: nodegroup.extraNodeSecurityGroups,
                    cfnStack: nodegroup.cfnStack,
                    autoScalingGroupName: nodegroup.autoScalingGroupName,
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
function nodeGroupProviderFactory() {
    return nodeGroupProvider;
}
exports.nodeGroupProviderFactory = nodeGroupProviderFactory;
const managedNodeGroupProvider = {
    construct: (name, type, inputs, options) => {
        try {
            const nodegroup = new nodegroup_1.ManagedNodeGroup(name, inputs, options);
            return Promise.resolve({
                urn: nodegroup.urn,
                state: {
                    nodeGroup: nodegroup.nodeGroup,
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
function managedNodeGroupProviderFactory() {
    return managedNodeGroupProvider;
}
exports.managedNodeGroupProviderFactory = managedNodeGroupProviderFactory;
//# sourceMappingURL=nodegroup.js.map