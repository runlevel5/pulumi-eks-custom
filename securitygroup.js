"use strict";
// Copyright 2016-2019, Pulumi Corporation.
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
exports.createNodeGroupSecurityGroup = exports.NodeGroupSecurityGroup = void 0;
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
/**
 * NodeGroupSecurityGroup is a component that wraps creating a security group for node groups with the
 * default ingress & egress rules required to connect and work with the EKS cluster security group.
 */
class NodeGroupSecurityGroup extends pulumi.ComponentResource {
    /**
     * Creates a security group for node groups with the default ingress & egress
     * rules required to connect and work with the EKS cluster security group.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this component.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name, args, opts) {
        super("eks:index:NodeGroupSecurityGroup", name, args, opts);
        [this.securityGroup, this.securityGroupRule] = createNodeGroupSecurityGroup(name, args, this, opts === null || opts === void 0 ? void 0 : opts.provider);
        this.registerOutputs(undefined);
    }
}
exports.NodeGroupSecurityGroup = NodeGroupSecurityGroup;
/**
 * createNodeGroupSecurityGroup creates a security group for node groups with the
 * default ingress & egress rules required to connect and work with the EKS
 * cluster security group.
 */
function createNodeGroupSecurityGroup(name, args, parent, provider) {
    const nodeSecurityGroup = new aws.ec2.SecurityGroup(`${name}-nodeSecurityGroup`, {
        vpcId: args.vpcId,
        revokeRulesOnDelete: true,
        tags: pulumi.all([
            args.tags,
            args.eksCluster.name,
        ]).apply(([tags, clusterName]) => (Object.assign({ "Name": `${name}-nodeSecurityGroup`, [`kubernetes.io/cluster/${clusterName}`]: "owned" }, tags))),
    }, { parent, provider });
    const nodeIngressRule = new aws.ec2.SecurityGroupRule(`${name}-eksNodeIngressRule`, {
        description: "Allow nodes to communicate with each other",
        type: "ingress",
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        securityGroupId: nodeSecurityGroup.id,
        self: true,
    }, { parent, provider });
    const nodeClusterIngressRule = new aws.ec2.SecurityGroupRule(`${name}-eksNodeClusterIngressRule`, {
        description: "Allow worker Kubelets and pods to receive communication from the cluster control plane",
        type: "ingress",
        fromPort: 1025,
        toPort: 65535,
        protocol: "tcp",
        securityGroupId: nodeSecurityGroup.id,
        sourceSecurityGroupId: args.clusterSecurityGroup.id,
    }, { parent, provider });
    const extApiServerClusterIngressRule = new aws.ec2.SecurityGroupRule(`${name}-eksExtApiServerClusterIngressRule`, {
        description: "Allow pods running extension API servers on port 443 to receive communication from cluster control plane",
        type: "ingress",
        fromPort: 443,
        toPort: 443,
        protocol: "tcp",
        securityGroupId: nodeSecurityGroup.id,
        sourceSecurityGroupId: args.clusterSecurityGroup.id,
    }, { parent, provider });
    const nodeInternetEgressRule = new aws.ec2.SecurityGroupRule(`${name}-eksNodeInternetEgressRule`, {
        description: "Allow internet access.",
        type: "egress",
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
        securityGroupId: nodeSecurityGroup.id,
    }, { parent, provider });
    const eksClusterIngressRule = new aws.ec2.SecurityGroupRule(`${name}-eksClusterIngressRule`, {
        description: "Allow pods to communicate with the cluster API Server",
        type: "ingress",
        fromPort: 443,
        toPort: 443,
        protocol: "tcp",
        securityGroupId: args.clusterSecurityGroup.id,
        sourceSecurityGroupId: nodeSecurityGroup.id,
    }, { parent, provider });
    return [nodeSecurityGroup, eksClusterIngressRule];
}
exports.createNodeGroupSecurityGroup = createNodeGroupSecurityGroup;
//# sourceMappingURL=securitygroup.js.map