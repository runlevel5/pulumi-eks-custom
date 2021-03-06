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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManagedNodeGroup = exports.ManagedNodeGroup = exports.computeWorkerSubnets = exports.createNodeGroup = exports.NodeGroup = void 0;
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const netmask = require("netmask");
const randomSuffix_1 = require("./randomSuffix");
const securitygroup_1 = require("./securitygroup");
/**
 * NodeGroup is a component that wraps the AWS EC2 instances that provide compute capacity for an EKS cluster.
 */
class NodeGroup extends pulumi.ComponentResource {
    /**
     * Create a new EKS cluster with worker nodes, optional storage classes, and deploy the Kubernetes Dashboard if
     * requested.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this cluster.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name, args, opts) {
        super("eks:index:NodeGroup", name, args, opts);
        const group = createNodeGroup(name, args, this, opts === null || opts === void 0 ? void 0 : opts.provider);
        this.nodeSecurityGroup = group.nodeSecurityGroup;
        this.cfnStack = group.cfnStack;
        this.autoScalingGroupName = group.autoScalingGroupName;
        this.registerOutputs(undefined);
    }
}
exports.NodeGroup = NodeGroup;
function isCoreData(arg) {
    return arg.cluster !== undefined;
}
/**
 * Create a self-managed node group using CloudFormation and an ASG.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/worker.html
 */
function createNodeGroup(name, args, parent, provider) {
    const core = isCoreData(args.cluster) ? args.cluster : args.cluster.core;
    if (!args.instanceProfile && !core.nodeGroupOptions.instanceProfile) {
        throw new Error(`an instanceProfile is required`);
    }
    if (core.nodeGroupOptions.nodeSecurityGroup && args.nodeSecurityGroup) {
        if (core.nodeSecurityGroupTags &&
            core.nodeGroupOptions.nodeSecurityGroup.id !== args.nodeSecurityGroup.id) {
            throw new Error(`The NodeGroup's nodeSecurityGroup and the cluster option nodeSecurityGroupTags are mutually exclusive. Choose a single approach`);
        }
    }
    if (args.nodePublicKey && args.keyName) {
        throw new Error("nodePublicKey and keyName are mutually exclusive. Choose a single approach");
    }
    if (args.amiId && args.gpu) {
        throw new Error("amiId and gpu are mutually exclusive.");
    }
    if (args.nodeUserDataOverride && (args.nodeUserData || args.labels || args.taints || args.kubeletExtraArgs || args.bootstrapExtraArgs)) {
        throw new Error("nodeUserDataOverride and any combination of {nodeUserData, labels, taints, kubeletExtraArgs, or bootstrapExtraArgs} is mutually exclusive.");
    }
    let nodeSecurityGroup;
    const cfnStackDeps = [];
    const eksCluster = core.cluster;
    if (core.vpcCni !== undefined) {
        cfnStackDeps.push(core.vpcCni);
    }
    if (core.eksNodeAccess !== undefined) {
        cfnStackDeps.push(core.eksNodeAccess);
    }
    let eksClusterIngressRule = args.clusterIngressRule;
    if (args.nodeSecurityGroup) {
        nodeSecurityGroup = args.nodeSecurityGroup;
        if (eksClusterIngressRule === undefined) {
            throw new Error(`invalid args for node group ${name}, clusterIngressRule is required when nodeSecurityGroup is manually specified`);
        }
    }
    else {
        [nodeSecurityGroup, eksClusterIngressRule] = securitygroup_1.createNodeGroupSecurityGroup(name, {
            vpcId: core.vpcId,
            clusterSecurityGroup: core.clusterSecurityGroup,
            eksCluster: eksCluster,
            tags: pulumi.all([
                core.tags,
                core.nodeSecurityGroupTags,
            ]).apply(([tags, nodeSecurityGroupTags]) => (Object.assign(Object.assign({}, nodeSecurityGroupTags), tags))),
        }, parent);
    }
    // This apply is necessary in s.t. the launchConfiguration picks up a
    // dependency on the eksClusterIngressRule. The nodes may fail to
    // connect to the cluster if we attempt to create them before the
    // ingress rule is applied.
    const nodeSecurityGroupId = pulumi.all([nodeSecurityGroup.id, eksClusterIngressRule.id])
        .apply(([id]) => id);
    // Collect the IDs of any extra, user-specific security groups.
    const extraNodeSecurityGroupIds = args.extraNodeSecurityGroups ? args.extraNodeSecurityGroups.map(sg => sg.id) : [];
    // If requested, add a new EC2 KeyPair for SSH access to the instances.
    let keyName = args.keyName;
    if (args.nodePublicKey) {
        const key = new aws.ec2.KeyPair(`${name}-keyPair`, {
            publicKey: args.nodePublicKey,
        }, { parent, provider });
        keyName = key.keyName;
    }
    const cfnStackName = randomSuffix_1.default(`${name}-cfnStackName`, name, { parent });
    const awsRegion = pulumi.output(aws.getRegion({}, { parent, async: true }));
    const userDataArg = args.nodeUserData || pulumi.output("");
    const kubeletExtraArgs = args.kubeletExtraArgs ? args.kubeletExtraArgs.split(" ") : [];
    if (args.labels) {
        const parts = [];
        for (const key of Object.keys(args.labels)) {
            parts.push(key + "=" + args.labels[key]);
        }
        if (parts.length > 0) {
            kubeletExtraArgs.push("--node-labels=" + parts.join(","));
        }
    }
    if (args.taints) {
        const parts = [];
        for (const key of Object.keys(args.taints)) {
            const taint = args.taints[key];
            parts.push(key + "=" + taint.value + ":" + taint.effect);
        }
        if (parts.length > 0) {
            kubeletExtraArgs.push("--register-with-taints=" + parts.join(","));
        }
    }
    let bootstrapExtraArgs = args.bootstrapExtraArgs ? (" " + args.bootstrapExtraArgs) : "";
    if (kubeletExtraArgs.length === 1) {
        // For backward compatibility with previous versions of this package, don't wrap a single argument with `''`.
        bootstrapExtraArgs += ` --kubelet-extra-args ${kubeletExtraArgs[0]}`;
    }
    else if (kubeletExtraArgs.length > 1) {
        bootstrapExtraArgs += ` --kubelet-extra-args '${kubeletExtraArgs.join(" ")}'`;
    }
    const userdata = pulumi.all([awsRegion, eksCluster.name, eksCluster.endpoint, eksCluster.certificateAuthority, cfnStackName, userDataArg])
        .apply(([region, clusterName, clusterEndpoint, clusterCa, stackName, customUserData]) => {
        if (customUserData !== "") {
            customUserData = `cat >/opt/user-data <<${stackName}-user-data
${customUserData}
${stackName}-user-data
chmod +x /opt/user-data
/opt/user-data
`;
        }
        return `#!/bin/bash

/etc/eks/bootstrap.sh --apiserver-endpoint "${clusterEndpoint}" --b64-cluster-ca "${clusterCa.data}" "${clusterName}"${bootstrapExtraArgs}
${customUserData}
/opt/aws/bin/cfn-signal --exit-code $? --stack ${stackName} --resource NodeGroup --region ${region.name}
`;
    });
    const version = pulumi.output(args.version || core.cluster.version);
    // https://docs.aws.amazon.com/eks/latest/userguide/retrieve-ami-id.html
    let amiId = args.amiId;
    if (!amiId) {
        const amiType = args.gpu ? "amazon-linux-2-gpu" : "amazon-linux-2";
        amiId = version.apply(v => {
            const parameterName = `/aws/service/eks/optimized-ami/${v}/${amiType}/recommended/image_id`;
            return pulumi.output(aws.ssm.getParameter({ name: parameterName }, { parent, async: true })).value;
        });
    }
    // Enable auto-assignment of public IP addresses on worker nodes for
    // backwards compatibility on existing EKS clusters launched with it
    // enabled. Defaults to `true`.
    let nodeAssociatePublicIpAddress = true;
    if (args.nodeAssociatePublicIpAddress !== undefined) {
        nodeAssociatePublicIpAddress = args.nodeAssociatePublicIpAddress;
    }
    const nodeLaunchConfiguration = new aws.ec2.LaunchConfiguration(`${name}-nodeLaunchConfiguration`, {
        associatePublicIpAddress: nodeAssociatePublicIpAddress,
        imageId: amiId,
        instanceType: args.instanceType || "t2.medium",
        iamInstanceProfile: args.instanceProfile || core.nodeGroupOptions.instanceProfile,
        keyName: keyName,
        securityGroups: [nodeSecurityGroupId, ...extraNodeSecurityGroupIds],
        spotPrice: args.spotPrice,
        rootBlockDevice: {
            encrypted: args.encryptRootBlockDevice || args.encryptRootBockDevice,
            volumeSize: args.nodeRootVolumeSize || 20,
            volumeType: "gp2",
            deleteOnTermination: true,
        },
        userData: args.nodeUserDataOverride || userdata,
    }, { parent, provider });
    // Compute the worker node group subnets to use from the various approaches.
    let workerSubnetIds;
    if (args.nodeSubnetIds !== undefined) { // Use the specified override subnetIds.
        workerSubnetIds = pulumi.output(args.nodeSubnetIds);
    }
    else if (core.privateSubnetIds !== undefined) { // Use the specified private subnetIds.
        workerSubnetIds = core.privateSubnetIds;
    }
    else if (core.publicSubnetIds !== undefined) { // Use the specified public subnetIds.
        workerSubnetIds = core.publicSubnetIds;
    }
    else {
        // Use subnetIds from the cluster. Compute / auto-discover the private worker subnetIds from this set.
        workerSubnetIds = pulumi.output(core.subnetIds).apply(ids => computeWorkerSubnets(parent, ids));
    }
    // Configure the settings for the autoscaling group.
    if (args.desiredCapacity === undefined) {
        args.desiredCapacity = 2;
    }
    if (args.minSize === undefined) {
        args.minSize = 1;
    }
    if (args.maxSize === undefined) {
        args.maxSize = 2;
    }
    let minInstancesInService = 1;
    if (args.spotPrice) {
        minInstancesInService = 0;
    }
    const autoScalingGroupTags = pulumi.all([
        eksCluster.name,
        args.autoScalingGroupTags,
    ]).apply(([clusterName, asgTags]) => (Object.assign({ "Name": `${clusterName}-worker`, [`kubernetes.io/cluster/${clusterName}`]: "owned" }, asgTags)));
    const cfnTemplateBody = pulumi.all([
        nodeLaunchConfiguration.id,
        args.desiredCapacity,
        args.minSize,
        args.maxSize,
        tagsToAsgTags(autoScalingGroupTags),
        workerSubnetIds.apply(JSON.stringify),
    ]).apply(([launchConfig, desiredCapacity, minSize, maxSize, asgTags, vpcSubnetIds]) => `
                AWSTemplateFormatVersion: '2010-09-09'
                Outputs:
                    NodeGroup:
                        Value: !Ref NodeGroup
                Resources:
                    NodeGroup:
                        Type: AWS::AutoScaling::AutoScalingGroup
                        Properties:
                          DesiredCapacity: ${desiredCapacity}
                          LaunchConfigurationName: ${launchConfig}
                          MinSize: ${minSize}
                          MaxSize: ${maxSize}
                          VPCZoneIdentifier: ${vpcSubnetIds}
                          Tags:
                          ${asgTags}
                        UpdatePolicy:
                          AutoScalingRollingUpdate:
                            MinInstancesInService: '${minInstancesInService}'
                            MaxBatchSize: '1'
                `);
    const cfnStack = new aws.cloudformation.Stack(`${name}-nodes`, {
        name: cfnStackName,
        templateBody: cfnTemplateBody,
        tags: pulumi.all([
            core.tags,
            args.cloudFormationTags,
        ]).apply(([tags, cloudFormationTags]) => (Object.assign(Object.assign({ "Name": `${name}-nodes` }, cloudFormationTags), tags))),
    }, { parent, dependsOn: cfnStackDeps, provider });
    const autoScalingGroupName = cfnStack.outputs.apply(outputs => {
        if (!("NodeGroup" in outputs)) {
            throw new Error("CloudFormation stack is not ready. Stack output key 'NodeGroup' does not exist.");
        }
        return outputs["NodeGroup"];
    });
    return {
        nodeSecurityGroup: nodeSecurityGroup,
        cfnStack: cfnStack,
        autoScalingGroupName: autoScalingGroupName,
        extraNodeSecurityGroups: args.extraNodeSecurityGroups,
    };
}
exports.createNodeGroup = createNodeGroup;
/** computeWorkerSubnets attempts to determine the subset of the given subnets to use for worker nodes.
 *
 * As per https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html, an EKS cluster that is attached to public
 * and private subnets will only expose its API service to workers on the private subnets. Any workers attached to the
 * public subnets will be unable to communicate with the API server.
 *
 * If all of the given subnet IDs are public, the list of subnet IDs is returned as-is. If any private subnet is given,
 * only the IDs of the private subnets are returned. A subnet is deemed private iff it has no route in its route table
 * that routes directly to an internet gateway. If any such route exists in a subnet's route table, it is treated as
 * public.
 */
function computeWorkerSubnets(parent, subnetIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const publicSubnets = [];
        const privateSubnets = [];
        for (const subnetId of subnetIds) {
            // Fetch the route table for this subnet.
            const routeTable = yield getRouteTableAsync(parent, subnetId);
            // Once we have the route table, check its list of routes for a route to an internet gateway.
            const hasInternetGatewayRoute = routeTable.routes
                .find(r => !!r.gatewayId && !isPrivateCIDRBlock(r.cidrBlock)) !== undefined;
            if (hasInternetGatewayRoute) {
                publicSubnets.push(subnetId);
            }
            else {
                privateSubnets.push(subnetId);
            }
        }
        return privateSubnets.length === 0 ? publicSubnets : privateSubnets;
    });
}
exports.computeWorkerSubnets = computeWorkerSubnets;
function getRouteTableAsync(parent, subnetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const invokeOpts = { parent, async: true };
        try {
            // Attempt to get the explicit route table for this subnet. If there is no explicit rouute table for
            // this subnet, this call will throw.
            return yield aws.ec2.getRouteTable({ subnetId }, invokeOpts);
        }
        catch (_a) {
            // If we reach this point, the subnet may not have an explicitly associated route table. In this case
            // the subnet is associated with its VPC's main route table (see
            // https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html#RouteTables for details).
            const subnet = yield aws.ec2.getSubnet({ id: subnetId }, invokeOpts);
            const mainRouteTableInfo = yield aws.ec2.getRouteTables({
                vpcId: subnet.vpcId,
                filters: [{
                        name: "association.main",
                        values: ["true"],
                    }],
            }, invokeOpts);
            return yield aws.ec2.getRouteTable({ routeTableId: mainRouteTableInfo.ids[0] }, invokeOpts);
        }
    });
}
/**
 * Returns true if the given CIDR block falls within a private range [1].
 * [1] https://en.wikipedia.org/wiki/Private_network
 */
function isPrivateCIDRBlock(cidrBlock) {
    const privateA = new netmask.Netmask("10.0.0.0/8");
    const privateB = new netmask.Netmask("172.16.0.0/12");
    const privateC = new netmask.Netmask("192.168.0.0/16");
    return privateA.contains(cidrBlock) || privateB.contains(cidrBlock) || privateC.contains(cidrBlock);
}
/**
 * Iterates through the tags map creating AWS ASG-style tags
 */
function tagsToAsgTags(tagsInput) {
    return pulumi.output(tagsInput).apply(tags => {
        let output = "";
        for (const tag of Object.keys(tags)) {
            output += `
                          - Key: ${tag}
                            Value: ${tags[tag]}
                            PropagateAtLaunch: 'true'`;
        }
        return output;
    });
}
/**
 * ManagedNodeGroup is a component that wraps creating an AWS managed node group.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
 */
class ManagedNodeGroup extends pulumi.ComponentResource {
    /**
     * Create a new AWS managed node group.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this node group.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name, args, opts) {
        super("eks:index:ManagedNodeGroup", name, args, opts);
        this.nodeGroup = createManagedNodeGroup(name, args, this, opts === null || opts === void 0 ? void 0 : opts.provider);
        this.registerOutputs(undefined);
    }
}
exports.ManagedNodeGroup = ManagedNodeGroup;
/**
 * Create an AWS managed node group.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
 */
function createManagedNodeGroup(name, args, parent, provider) {
    const core = isCoreData(args.cluster) ? args.cluster : args.cluster.core;
    const eksCluster = isCoreData(args.cluster) ? args.cluster.cluster : args.cluster;
    // Compute the nodegroup role.
    if (!args.nodeRole && !args.nodeRoleArn) {
        throw new Error(`An IAM role, or role ARN must be provided to create a managed node group`);
    }
    if (args.nodeRole && args.nodeRoleArn) {
        throw new Error("nodeRole and nodeRoleArn are mutually exclusive to create a managed node group");
    }
    let roleArn;
    if (args.nodeRoleArn) {
        roleArn = args.nodeRoleArn;
    }
    else if (args.nodeRole) {
        roleArn = pulumi.output(args.nodeRole).apply(r => r.arn);
    }
    else {
        throw new Error("The managed node group role provided is undefined");
    }
    // Check that the nodegroup role has been set on the cluster to
    // ensure that the aws-auth configmap was properly formed.
    const nodegroupRole = pulumi.all([
        core.instanceRoles,
        roleArn,
    ]).apply(([roles, rArn]) => {
        // Map out the ARNs of all of the instanceRoles.
        const roleArns = roles.map(role => {
            return role.arn;
        });
        // Try finding the nodeRole in the ARNs array.
        return pulumi.all([
            roleArns,
            rArn,
        ]).apply(([arns, arn]) => {
            return arns.find(a => a === arn);
        });
    });
    nodegroupRole.apply(role => {
        if (!role) {
            throw new Error(`A managed node group cannot be created without first setting its role in the cluster's instanceRoles`);
        }
    });
    // Compute the node group subnets to use.
    let subnetIds = pulumi.output([]);
    if (args.subnetIds !== undefined) {
        subnetIds = pulumi.output(args.subnetIds);
    }
    else if (core.subnetIds !== undefined) {
        subnetIds = core.subnetIds;
    }
    else if (core.privateSubnetIds !== undefined) {
        subnetIds = core.privateSubnetIds;
    }
    else if (core.publicSubnetIds !== undefined) {
        subnetIds = core.publicSubnetIds;
    }
    // Omit the cluster from the args using rest spread, and store in nodeGroupArgs.
    const { cluster } = args, nodeGroupArgs = __rest(args, ["cluster"]);
    // Make the aws-auth configmap a dependency of the node group.
    const ngDeps = [];
    if (core.eksNodeAccess !== undefined) {
        ngDeps.push(core.eksNodeAccess);
    }
    // Create the managed node group.
    const nodeGroup = new aws.eks.NodeGroup(name, Object.assign(Object.assign({}, nodeGroupArgs), { clusterName: args.clusterName || core.cluster.name, nodeRoleArn: roleArn, scalingConfig: pulumi.all([
            args.scalingConfig,
        ]).apply(([config]) => {
            const desiredSize = config && config.desiredSize || 2;
            const minSize = config && config.minSize || 1;
            const maxSize = config && config.maxSize || 2;
            return {
                desiredSize: desiredSize,
                minSize: minSize,
                maxSize: maxSize,
            };
        }), subnetIds: subnetIds }), { parent: parent !== null && parent !== void 0 ? parent : eksCluster, dependsOn: ngDeps, provider });
    return nodeGroup;
}
exports.createManagedNodeGroup = createManagedNodeGroup;
//# sourceMappingURL=nodegroup.js.map