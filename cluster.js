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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cluster = exports.createCore = exports.getRoleProvider = exports.ClusterCreationRoleProvider = void 0;
const aws = require("@pulumi/aws");
const k8s = require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");
const childProcess = require("child_process");
const fs = require("fs");
const https = require("https");
const HttpsProxyAgent = require("https-proxy-agent");
const jsyaml = require("js-yaml");
const process = require("process");
const tmp = require("tmp");
const url = require("url");
const which = require("which");
const cert_thumprint_1 = require("./cert-thumprint");
const cni_1 = require("./cni");
const dashboard_1 = require("./dashboard");
const nodegroup_1 = require("./nodegroup");
const securitygroup_1 = require("./securitygroup");
const servicerole_1 = require("./servicerole");
const storageclass_1 = require("./storageclass");
function createOrGetInstanceProfile(name, parent, instanceRoleName, instanceProfileName, provider) {
    let instanceProfile;
    if (instanceProfileName) {
        instanceProfile = aws.iam.InstanceProfile.get(`${name}-instanceProfile`, instanceProfileName, undefined, { parent, provider });
    }
    else {
        instanceProfile = new aws.iam.InstanceProfile(`${name}-instanceProfile`, {
            role: instanceRoleName,
        }, { parent, provider });
    }
    return instanceProfile;
}
function generateKubeconfig(clusterName, clusterEndpoint, certData, opts) {
    let args = ["eks", "get-token", "--cluster-name", clusterName];
    let env;
    if (opts === null || opts === void 0 ? void 0 : opts.roleArn) {
        args = [...args, "--role", opts.roleArn];
    }
    if (opts === null || opts === void 0 ? void 0 : opts.profileName) {
        env = [{
                "name": "AWS_PROFILE",
                "value": opts.profileName,
            }];
    }
    return pulumi.all([
        args,
        env,
    ]).apply(([tokenArgs, envvars]) => ({
        apiVersion: "v1",
        clusters: [{
                cluster: {
                    server: clusterEndpoint,
                    "certificate-authority-data": certData,
                },
                name: "kubernetes",
            }],
        contexts: [{
                context: {
                    cluster: "kubernetes",
                    user: "aws",
                },
                name: "aws",
            }],
        "current-context": "aws",
        kind: "Config",
        users: [{
                name: "aws",
                user: {
                    exec: {
                        apiVersion: "client.authentication.k8s.io/v1alpha1",
                        command: "aws",
                        args: tokenArgs,
                        env: envvars,
                    },
                },
            }],
    }));
}
/**
 * ClusterCreationRoleProvider is a component that wraps creating a role provider that can be passed to
 * `new eks.Cluster("test", { creationRoleProvider: ... })`. This can be used to provide a
 * specific role to use for the creation of the EKS cluster different from the role being used
 * to run the Pulumi deployment.
 */
class ClusterCreationRoleProvider extends pulumi.ComponentResource {
    /**
     * Creates a role provider that can be passed to `new eks.Cluster("test", { creationRoleProvider: ... })`.
     * This can be used to provide a specific role to use for the creation of the EKS cluster different from
     * the role being used to run the Pulumi deployment.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this component.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name, args, opts) {
        super("eks:index:ClusterCreationRoleProvider", name, args, opts);
        const result = getRoleProvider(name, args === null || args === void 0 ? void 0 : args.region, args === null || args === void 0 ? void 0 : args.profile, this, opts === null || opts === void 0 ? void 0 : opts.provider);
        this.role = result.role;
        this.provider = result.provider;
        this.registerOutputs(undefined);
    }
}
exports.ClusterCreationRoleProvider = ClusterCreationRoleProvider;
/**
 * getRoleProvider creates a role provider that can be passed to `new eks.Cluster("test", {
 * creationRoleProvider: ... })`.  This can be used to provide a specific role to use for the
 * creation of the EKS cluster different from the role being used to run the Pulumi deployment.
 */
function getRoleProvider(name, region, profile, parent, provider) {
    const iamRole = new aws.iam.Role(`${name}-eksClusterCreatorRole`, {
        assumeRolePolicy: aws.getCallerIdentity({ parent, async: true }).then(id => `{
            "Version": "2012-10-17",
            "Statement": [
                {
                "Effect": "Allow",
                "Principal": {
                    "AWS": "arn:aws:iam::${id.accountId}:root"
                },
                "Action": "sts:AssumeRole"
                }
            ]
            }`),
        description: `Admin access to eks-${name}`,
    }, { parent, provider });
    // `eks:*` is needed to create/read/update/delete the EKS cluster, `iam:PassRole` is needed to pass the EKS service role to the cluster
    // https://docs.aws.amazon.com/eks/latest/userguide/service_IAM_role.html
    const rolePolicy = new aws.iam.RolePolicy(`${name}-eksClusterCreatorPolicy`, {
        role: iamRole,
        policy: {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: "eks:*",
                    Resource: "*",
                },
                {
                    Effect: "Allow",
                    Action: "iam:PassRole",
                    Resource: "*",
                },
            ],
        },
    }, { parent: iamRole, provider });
    const creatorProvider = new aws.Provider(`${name}-eksClusterCreatorEntity`, {
        region: region,
        profile: profile,
        assumeRole: {
            roleArn: iamRole.arn.apply((arn) => __awaiter(this, void 0, void 0, function* () {
                // wait 30 seconds to assume the IAM Role https://github.com/pulumi/pulumi-aws/issues/673
                if (!pulumi.runtime.isDryRun()) {
                    yield new Promise(resolve => setTimeout(resolve, 30 * 1000));
                }
                return arn;
            })),
        },
    }, { parent: iamRole, provider });
    return {
        role: iamRole,
        provider: creatorProvider,
    };
}
exports.getRoleProvider = getRoleProvider;
/**
 * Create the core components and settings required for the EKS cluster.
 */
function createCore(name, args, parent, provider) {
    // Check to ensure that aws CLI is installed, as we'll need it in order to deploy k8s resources
    // to the EKS cluster.
    try {
        which.sync("aws");
    }
    catch (err) {
        throw new Error("Could not find aws CLI for EKS. See https://github.com/pulumi/pulumi-eks for installation instructions.");
    }
    if (args.instanceRole && args.instanceRoles) {
        throw new Error("instanceRole and instanceRoles are mutually exclusive, and cannot both be set.");
    }
    if (args.subnetIds && (args.publicSubnetIds || args.privateSubnetIds)) {
        throw new Error("subnetIds, and the use of publicSubnetIds and/or privateSubnetIds are mutually exclusive. Choose a single approach.");
    }
    if (args.nodeGroupOptions && (args.nodeSubnetIds ||
        args.nodeAssociatePublicIpAddress ||
        args.instanceType ||
        args.instanceProfileName ||
        args.nodePublicKey ||
        args.nodeRootVolumeSize ||
        args.nodeUserData ||
        args.minSize ||
        args.maxSize ||
        args.desiredCapacity ||
        args.nodeAmiId ||
        args.gpu)) {
        throw new Error("Setting nodeGroupOptions, and any set of singular node group option(s) on the cluster, is mutually exclusive. Choose a single approach.");
    }
    // Configure the node group options.
    const nodeGroupOptions = args.nodeGroupOptions || {
        nodeSubnetIds: args.nodeSubnetIds,
        nodeAssociatePublicIpAddress: args.nodeAssociatePublicIpAddress,
        instanceType: args.instanceType,
        nodePublicKey: args.nodePublicKey,
        encryptRootBlockDevice: args.encryptRootBlockDevice || args.encryptRootBockDevice,
        nodeRootVolumeSize: args.nodeRootVolumeSize,
        nodeUserData: args.nodeUserData,
        minSize: args.minSize,
        maxSize: args.maxSize,
        desiredCapacity: args.desiredCapacity,
        amiId: args.nodeAmiId,
        gpu: args.gpu,
        version: args.version,
    };
    // Configure default networking architecture.
    let vpcId = args.vpcId;
    let clusterSubnetIds = [];
    // If no VPC is set, use the default VPC's subnets.
    if (!args.vpcId) {
        const invokeOpts = { parent, async: true };
        const vpc = aws.ec2.getVpc({ default: true }, invokeOpts);
        vpcId = vpc.then(v => v.id);
        clusterSubnetIds = vpc.then(v => aws.ec2.getSubnetIds({ vpcId: v.id }, invokeOpts)).then(subnets => subnets.ids);
    }
    // Form the subnetIds to use on the cluster from either:
    //  - subnetIds
    //  - A combination of privateSubnetIds and/or publicSubnetIds.
    if (args.subnetIds !== undefined) {
        clusterSubnetIds = args.subnetIds;
    }
    else if (args.publicSubnetIds !== undefined || args.privateSubnetIds !== undefined) {
        clusterSubnetIds = pulumi.all([
            args.publicSubnetIds || [],
            args.privateSubnetIds || [],
        ]).apply(([publicIds, privateIds]) => {
            return [...publicIds, ...privateIds];
        });
    }
    // Create the EKS service role
    let eksRole;
    if (args.serviceRole) {
        eksRole = pulumi.output(args.serviceRole);
    }
    else {
        eksRole = (new servicerole_1.ServiceRole(`${name}-eksRole`, {
            service: "eks.amazonaws.com",
            description: "Allows EKS to manage clusters on your behalf.",
            managedPolicyArns: [
                "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
                "arn:aws:iam::aws:policy/AmazonEKSServicePolicy",
            ],
        }, { parent, provider })).role;
    }
    // Create the EKS cluster security group
    let eksClusterSecurityGroup;
    if (args.clusterSecurityGroup) {
        eksClusterSecurityGroup = args.clusterSecurityGroup;
    }
    else {
        eksClusterSecurityGroup = new aws.ec2.SecurityGroup(`${name}-eksClusterSecurityGroup`, {
            vpcId: vpcId,
            revokeRulesOnDelete: true,
            tags: pulumi.all([
                args.tags,
                args.clusterSecurityGroupTags,
            ]).apply(([tags, clusterSecurityGroupTags]) => (Object.assign(Object.assign({ "Name": `${name}-eksClusterSecurityGroup` }, clusterSecurityGroupTags), tags))),
        }, { parent, provider });
        const eksClusterInternetEgressRule = new aws.ec2.SecurityGroupRule(`${name}-eksClusterInternetEgressRule`, {
            description: "Allow internet access.",
            type: "egress",
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
            securityGroupId: eksClusterSecurityGroup.id,
        }, { parent, provider });
    }
    // Create the cluster encryption provider for using envelope encryption on
    // Kubernetes secrets.
    let encryptionProvider;
    let encryptionConfig;
    if (args.encryptionConfigKeyArn) {
        encryptionProvider = pulumi.output(args.encryptionConfigKeyArn).apply(keyArn => ({ keyArn }));
        encryptionConfig = encryptionProvider.apply(ep => ({
            provider: ep,
            resources: ["secrets"],
        }));
    }
    let kubernetesNetworkConfig;
    if (args.kubernetesServiceIpAddressRange) {
        kubernetesNetworkConfig = pulumi.output(args.kubernetesServiceIpAddressRange).apply(serviceIpv4Cidr => ({ serviceIpv4Cidr }));
    }
    // Create the EKS cluster
    const eksCluster = new aws.eks.Cluster(`${name}-eksCluster`, {
        name: args.name,
        roleArn: eksRole.apply(r => r.arn),
        vpcConfig: {
            securityGroupIds: [eksClusterSecurityGroup.id],
            subnetIds: clusterSubnetIds,
            endpointPrivateAccess: args.endpointPrivateAccess,
            endpointPublicAccess: args.endpointPublicAccess,
            publicAccessCidrs: args.publicAccessCidrs,
        },
        version: args.version,
        enabledClusterLogTypes: args.enabledClusterLogTypes,
        tags: pulumi.all([
            args.tags,
            args.clusterTags,
        ]).apply(([tags, clusterTags]) => (Object.assign(Object.assign({ "Name": `${name}-eksCluster` }, clusterTags), tags))),
        encryptionConfig,
        kubernetesNetworkConfig,
    }, {
        parent,
        provider: args.creationRoleProvider ? args.creationRoleProvider.provider : provider,
    });
    // Instead of using the kubeconfig directly, we also add a wait of up to 5 minutes or until we
    // can reach the API server for the Output that provides access to the kubeconfig string so that
    // there is time for the cluster API server to become completely available.  Ideally we
    // would rely on the EKS API only returning once this was available, but we have seen frequent
    // cases where it is not yet available immediately after provisioning - possibly due to DNS
    // propagation delay or other non-deterministic factors.
    const endpoint = eksCluster.endpoint.apply((clusterEndpoint) => __awaiter(this, void 0, void 0, function* () {
        if (!pulumi.runtime.isDryRun()) {
            // For up to 300 seconds, try to contact the API cluster healthz
            // endpoint, and verify that it is reachable.
            const healthz = `${clusterEndpoint}/healthz`;
            const agent = createHttpAgent(args.proxy);
            const maxRetries = 60;
            const reqTimeoutMilliseconds = 1000; // HTTPS request timeout
            const timeoutMilliseconds = 5000; // Retry timeout
            for (let i = 0; i < maxRetries; i++) {
                try {
                    yield new Promise((resolve, reject) => {
                        const options = Object.assign(Object.assign({}, url.parse(healthz)), { rejectUnauthorized: false, agent: agent, timeout: reqTimeoutMilliseconds });
                        const req = https
                            .request(options, res => {
                            res.statusCode === 200 ? resolve() : reject(); // Verify healthz returns 200
                        });
                        req.on("timeout", reject);
                        req.on("error", reject);
                        req.end();
                    });
                    pulumi.log.info(`Cluster is ready`, eksCluster, undefined, true);
                    break;
                }
                catch (e) {
                    const retrySecondsLeft = (maxRetries - i) * timeoutMilliseconds / 1000;
                    pulumi.log.info(`Waiting up to (${retrySecondsLeft}) more seconds for cluster readiness...`, eksCluster, undefined, true);
                }
                yield new Promise(resolve => setTimeout(resolve, timeoutMilliseconds));
            }
        }
        return clusterEndpoint;
    }));
    // Compute the required kubeconfig. Note that we do not export this value: we want the exported config to
    // depend on the autoscaling group we'll create later so that nothing attempts to use the EKS cluster before
    // its worker nodes have come up.
    const kubeconfig = pulumi.all([eksCluster.name, endpoint, eksCluster.certificateAuthority, args.providerCredentialOpts])
        .apply(([clusterName, clusterEndpoint, clusterCertificateAuthority, providerCredentialOpts]) => {
        let config = {};
        if (args.creationRoleProvider) {
            config = args.creationRoleProvider.role.arn.apply(arn => {
                const opts = { roleArn: arn };
                return generateKubeconfig(clusterName, clusterEndpoint, clusterCertificateAuthority.data, opts);
            });
        }
        else if (providerCredentialOpts) {
            config = generateKubeconfig(clusterName, clusterEndpoint, clusterCertificateAuthority.data, providerCredentialOpts);
        }
        else {
            config = generateKubeconfig(clusterName, clusterEndpoint, clusterCertificateAuthority.data);
        }
        return config;
    });
    const k8sProvider = new k8s.Provider(`${name}-eks-k8s`, {
        kubeconfig: kubeconfig.apply(JSON.stringify),
    }, { parent });
    // Add any requested StorageClasses.
    const storageClasses = args.storageClasses || {};
    const userStorageClasses = {};
    if (typeof storageClasses === "string") {
        const storageClass = { type: storageClasses, default: true };
        userStorageClasses[storageClasses] = pulumi.output(storageclass_1.createStorageClass(`${name.toLowerCase()}-${storageClasses}`, storageClass, { parent, provider: k8sProvider }));
    }
    else {
        for (const key of Object.keys(storageClasses)) {
            userStorageClasses[key] = pulumi.output(storageclass_1.createStorageClass(`${name.toLowerCase()}-${key}`, storageClasses[key], { parent, provider: k8sProvider }));
        }
    }
    const skipDefaultNodeGroup = args.skipDefaultNodeGroup || args.fargate;
    // Create the VPC CNI management resource.
    let vpcCni;
    if (!args.useDefaultVpcCni) {
        vpcCni = new cni_1.VpcCni(`${name}-vpc-cni`, kubeconfig, args.vpcCniOptions, { parent });
    }
    let instanceRoleMappings;
    let instanceRoles;
    // Create role mappings of the instance roles specified for aws-auth.
    if (args.instanceRoles) {
        instanceRoleMappings = pulumi.output(args.instanceRoles).apply(roles => roles.map(role => createInstanceRoleMapping(role.arn)));
        instanceRoles = pulumi.output(args.instanceRoles);
    }
    else if (args.instanceRole) {
        // Create an instance profile if using a default node group
        if (!skipDefaultNodeGroup) {
            nodeGroupOptions.instanceProfile = createOrGetInstanceProfile(name, parent, args.instanceRole, args.instanceProfileName);
        }
        instanceRoleMappings = pulumi.output(args.instanceRole).apply(instanceRole => [createInstanceRoleMapping(instanceRole.arn)]);
        instanceRoles = pulumi.output([args.instanceRole]);
    }
    else {
        const instanceRole = (new servicerole_1.ServiceRole(`${name}-instanceRole`, {
            service: "ec2.amazonaws.com",
            managedPolicyArns: [
                "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
                "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
                "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
            ],
        }, { parent, provider })).role;
        instanceRoles = pulumi.output([instanceRole]);
        // Create a new policy for the role, if specified.
        if (args.customInstanceRolePolicy) {
            pulumi.log.warn("Option `customInstanceRolePolicy` has been deprecated. Please use `instanceRole` or `instanceRoles`. The role provided to either option should already include all required policies.", eksCluster);
            const customRolePolicy = new aws.iam.RolePolicy(`${name}-EKSWorkerCustomPolicy`, {
                role: instanceRole,
                policy: args.customInstanceRolePolicy,
            }, { parent, provider });
        }
        // Create an instance profile if using a default node group
        if (!skipDefaultNodeGroup) {
            nodeGroupOptions.instanceProfile = createOrGetInstanceProfile(name, parent, instanceRole, args.instanceProfileName);
        }
        instanceRoleMappings = pulumi.output(instanceRole).apply(role => [createInstanceRoleMapping(role.arn)]);
    }
    const roleMappings = pulumi.all([pulumi.output(args.roleMappings || []), instanceRoleMappings])
        .apply(([mappings, instanceMappings]) => {
        let mappingYaml = "";
        try {
            mappingYaml = jsyaml.safeDump([...mappings, ...instanceMappings].map(m => ({
                rolearn: m.roleArn,
                username: m.username,
                groups: m.groups,
            })));
        }
        catch (e) {
            throw new Error(`The IAM role mappings provided could not be properly serialized to YAML for the aws-auth ConfigMap`);
        }
        return mappingYaml;
    });
    const nodeAccessData = {
        mapRoles: roleMappings,
    };
    if (args.userMappings) {
        nodeAccessData.mapUsers = pulumi.output(args.userMappings).apply(mappings => {
            let mappingYaml = "";
            try {
                mappingYaml = jsyaml.safeDump(mappings.map(m => ({
                    userarn: m.userArn,
                    username: m.username,
                    groups: m.groups,
                })));
            }
            catch (e) {
                throw new Error(`The IAM user mappings provided could not be properly serialized to YAML for the aws-auth ConfigMap`);
            }
            return mappingYaml;
        });
    }
    const eksNodeAccess = new k8s.core.v1.ConfigMap(`${name}-nodeAccess`, {
        apiVersion: "v1",
        metadata: {
            name: `aws-auth`,
            namespace: "kube-system",
        },
        data: nodeAccessData,
    }, { parent, provider: k8sProvider });
    const fargateProfile = pulumi.output(args.fargate).apply(argsFargate => {
        let result;
        if (argsFargate) {
            const fargate = argsFargate !== true ? argsFargate : {};
            const podExecutionRoleArn = fargate.podExecutionRoleArn || (new servicerole_1.ServiceRole(`${name}-podExecutionRole`, {
                service: "eks-fargate-pods.amazonaws.com",
                managedPolicyArns: [
                    "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy",
                ],
            }, { parent, provider })).role.apply(r => r.arn);
            const selectors = fargate.selectors || [
                // For `fargate: true`, default to including the `default` namespaces and
                // `kube-system` namespaces so that all pods by default run in Fargate.
                { namespace: "default" },
                { namespace: "kube-system" },
            ];
            const reservedAwsPrefix = "eks";
            let fargateProfileName = name;
            const profileNameRegex = new RegExp("^" + reservedAwsPrefix + "-", "i"); // starts with (^) 'eks-', (i)gnore casing
            if (fargateProfileName === reservedAwsPrefix || profileNameRegex.test(name)) {
                fargateProfileName = fargateProfileName.replace("-", "_");
                fargateProfileName = `${fargateProfileName}fargateProfile`;
            }
            else {
                // default, and to maintain backwards compat for existing cluster fargate profiles.
                fargateProfileName = `${fargateProfileName}-fargateProfile`;
            }
            result = new aws.eks.FargateProfile(fargateProfileName, {
                clusterName: eksCluster.name,
                podExecutionRoleArn: podExecutionRoleArn,
                selectors: selectors,
                subnetIds: pulumi.output(clusterSubnetIds).apply(subnets => nodegroup_1.computeWorkerSubnets(parent, subnets)),
            }, { parent, dependsOn: [eksNodeAccess], provider });
            // Once the FargateProfile has been created, try to patch CoreDNS if needed.  See
            // https://docs.aws.amazon.com/eks/latest/userguide/fargate-getting-started.html#fargate-gs-coredns.
            pulumi.all([result.id, selectors, kubeconfig]).apply(([_, sels, kconfig]) => {
                // Only patch CoreDNS if there is a selector in the FargateProfile which causes
                // `kube-system` pods to launch in Fargate.
                if (sels.findIndex(s => s.namespace === "kube-system") !== -1) {
                    // Only do the imperative patching during deployments, not previews.
                    if (!pulumi.runtime.isDryRun()) {
                        // Write the kubeconfig to a tmp file and use it to patch the `coredns`
                        // deployment that AWS deployed already as part of cluster creation.
                        const tmpKubeconfig = tmp.fileSync();
                        fs.writeFileSync(tmpKubeconfig.fd, JSON.stringify(kconfig));
                        const patch = [{
                                op: "replace",
                                path: "/spec/template/metadata/annotations/eks.amazonaws.com~1compute-type",
                                value: "fargate",
                            }];
                        const cmd = `kubectl patch deployment coredns -n kube-system --type json -p='${JSON.stringify(patch)}'`;
                        childProcess.execSync(cmd, {
                            env: Object.assign(Object.assign({}, process.env), { "KUBECONFIG": tmpKubeconfig.name }),
                        });
                    }
                }
            });
        }
        return result;
    });
    // Setup OIDC provider to leverage IAM roles for k8s service accounts.
    let oidcProvider;
    if (args.createOidcProvider) {
        // Retrieve the OIDC provider URL's intermediate root CA fingerprint.
        const awsRegionName = pulumi.output(aws.getRegion({}, { parent, async: true })).name;
        const eksOidcProviderUrl = pulumi.interpolate `https://oidc.eks.${awsRegionName}.amazonaws.com`;
        const agent = createHttpAgent(args.proxy);
        const fingerprint = cert_thumprint_1.getIssuerCAThumbprint(eksOidcProviderUrl, agent);
        // Create the OIDC provider for the cluster.
        oidcProvider = new aws.iam.OpenIdConnectProvider(`${name}-oidcProvider`, {
            clientIdLists: ["sts.amazonaws.com"],
            url: eksCluster.identities[0].oidcs[0].issuer,
            thumbprintLists: [fingerprint],
        }, { parent, provider });
    }
    return {
        vpcId: pulumi.output(vpcId),
        subnetIds: args.subnetIds ? pulumi.output(args.subnetIds) : pulumi.output(clusterSubnetIds),
        publicSubnetIds: args.publicSubnetIds ? pulumi.output(args.publicSubnetIds) : undefined,
        privateSubnetIds: args.privateSubnetIds ? pulumi.output(args.privateSubnetIds) : undefined,
        clusterSecurityGroup: eksClusterSecurityGroup,
        cluster: eksCluster,
        endpoint: endpoint,
        nodeGroupOptions: nodeGroupOptions,
        kubeconfig: kubeconfig,
        provider: k8sProvider,
        awsProvider: provider,
        vpcCni: vpcCni,
        instanceRoles: instanceRoles,
        eksNodeAccess: eksNodeAccess,
        tags: args.tags,
        nodeSecurityGroupTags: args.nodeSecurityGroupTags,
        storageClasses: userStorageClasses,
        fargateProfile: fargateProfile,
        oidcProvider: oidcProvider,
        encryptionConfig: encryptionConfig,
    };
}
exports.createCore = createCore;
/**
 * Enable access to the EKS cluster for worker nodes, by creating an
 * instance role mapping to the k8s username and groups of aws-auth.
 */
function createInstanceRoleMapping(arn) {
    return {
        roleArn: arn,
        username: "system:node:{{EC2PrivateDNSName}}",
        groups: ["system:bootstrappers", "system:nodes"],
    };
}
/**
 * Create an HTTP Agent for use with HTTP(S) requests.
 * Using a proxy is supported.
 */
function createHttpAgent(proxy) {
    if (!proxy) {
        // Attempt to default to the proxy env vars.
        //
        // Note: Envars used are a convention that were based on:
        // - curl: https://curl.haxx.se/docs/manual.html
        // - wget: https://www.gnu.org/software/wget/manual/html_node/Proxies.html
        proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
            process.env.HTTP_PROXY || process.env.http_proxy;
    }
    if (proxy) {
        /**
         * Create an HTTP(s) proxy agent with the given options.
         *
         * The agent connects to the proxy and issues a HTTP CONNECT
         * method to the proxy, which connects to the dest.
         *
         * Note: CONNECT is not cacheable.
         *
         * See for more details:
         *  - https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/CONNECT
         *  - https://www.npmjs.com/package/https-proxy-agent
         */
        return HttpsProxyAgent(Object.assign(Object.assign({}, url.parse(proxy)), { rejectUnauthorized: false }));
    }
    return new https.Agent({
        // Cached sessions can result in the certificate not being
        // available since its already been "accepted." Disable caching.
        maxCachedSessions: 0,
    });
}
/**
 * Cluster is a component that wraps the AWS and Kubernetes resources necessary to run an EKS cluster, its worker
 * nodes, its optional StorageClasses, and an optional deployment of the Kubernetes Dashboard.
 */
class Cluster extends pulumi.ComponentResource {
    /**
     * Create a new EKS cluster with worker nodes, optional storage classes, and deploy the Kubernetes Dashboard if
     * requested.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this cluster.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name, args, opts) {
        super("eks:index:Cluster", name, args, opts);
        args = args || {};
        // Check that AWS provider credential options are set for the kubeconfig
        // to use with the given auth method.
        if ((opts === null || opts === void 0 ? void 0 : opts.provider) && !args.providerCredentialOpts) {
            throw new Error("providerCredentialOpts and an AWS provider instance must be set together");
        }
        if (process.env.AWS_PROFILE && !args.providerCredentialOpts) {
            throw new Error("providerCredentialOpts and AWS_PROFILE must be set together");
        }
        const awsConfig = new pulumi.Config("aws");
        const awsProfile = awsConfig.get("profile");
        if (awsProfile && !args.providerCredentialOpts) {
            throw new Error("providerCredentialOpts and AWS config setting aws:profile must be set together");
        }
        // Create the core resources required by the cluster.
        const core = createCore(name, args, this, opts === null || opts === void 0 ? void 0 : opts.provider);
        this.core = core;
        this.clusterSecurityGroup = core.clusterSecurityGroup;
        this.eksCluster = core.cluster;
        this.instanceRoles = core.instanceRoles;
        // Create default node group security group and cluster ingress rule.
        [this.nodeSecurityGroup, this.eksClusterIngressRule] = securitygroup_1.createNodeGroupSecurityGroup(name, {
            vpcId: core.vpcId,
            clusterSecurityGroup: core.clusterSecurityGroup,
            eksCluster: core.cluster,
            tags: pulumi.all([
                args.tags,
                args.nodeSecurityGroupTags,
            ]).apply(([tags, nodeSecurityGroupTags]) => (Object.assign(Object.assign({}, nodeSecurityGroupTags), tags))),
        }, this);
        core.nodeGroupOptions.nodeSecurityGroup = this.nodeSecurityGroup;
        core.nodeGroupOptions.clusterIngressRule = this.eksClusterIngressRule;
        const skipDefaultNodeGroup = args.skipDefaultNodeGroup || args.fargate;
        // Create the default worker node group and grant the workers access to the API server.
        const configDeps = [core.kubeconfig];
        if (!skipDefaultNodeGroup) {
            this.defaultNodeGroup = nodegroup_1.createNodeGroup(name, Object.assign({ cluster: core }, core.nodeGroupOptions), this);
            configDeps.push(this.defaultNodeGroup.cfnStack.id);
        }
        // Export the cluster's kubeconfig with a dependency upon the cluster's autoscaling group. This will help
        // ensure that the cluster's consumers do not attempt to use the cluster until its workers are attached.
        this.kubeconfig = pulumi.all(configDeps).apply(([kubeconfig]) => kubeconfig);
        // Export a k8s provider with the above kubeconfig. Note that we do not export the provider we created earlier
        // in order to help ensure that worker nodes are available before the provider can be used.
        this.provider = new k8s.Provider(`${name}-provider`, {
            kubeconfig: this.kubeconfig.apply(JSON.stringify),
        }, { parent: this });
        // If we need to deploy the Kubernetes dashboard, do so now.
        if (args.deployDashboard) {
            pulumi.log.warn("Option `deployDashboard` has been deprecated. Please consider using the Helm chart, or writing the dashboard directly in Pulumi.", this.eksCluster);
            dashboard_1.createDashboard(name, {}, this, this.provider);
        }
        this.registerOutputs({ kubeconfig: this.kubeconfig });
    }
    /**
     * Create a self-managed node group using CloudFormation and an ASG.
     *
     * See for more details:
     * https://docs.aws.amazon.com/eks/latest/userguide/worker.html
     */
    createNodeGroup(name, args) {
        const awsProvider = this.core.awsProvider ? { aws: this.core.awsProvider } : undefined;
        return new nodegroup_1.NodeGroup(name, Object.assign(Object.assign({}, args), { cluster: this.core, nodeSecurityGroup: this.core.nodeGroupOptions.nodeSecurityGroup, clusterIngressRule: this.core.nodeGroupOptions.clusterIngressRule }), {
            parent: this,
            providers: Object.assign(Object.assign({}, awsProvider), { kubernetes: this.provider }),
        });
    }
    /**
     * Generate a kubeconfig for cluster authentication that does not use the
     * default AWS credential provider chain, and instead is scoped to
     * the supported options in `KubeconfigOptions`.
     *
     * The kubeconfig generated is automatically stringified for ease of use
     * with the pulumi/kubernetes provider.
     *
     * See for more details:
     * - https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html
     * - https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html
     * - https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html
     */
    getKubeconfig(args) {
        const kc = generateKubeconfig(this.eksCluster.name, this.eksCluster.endpoint, this.eksCluster.certificateAuthority.data, args);
        return pulumi.output(kc).apply(JSON.stringify);
    }
}
exports.Cluster = Cluster;
//# sourceMappingURL=cluster.js.map