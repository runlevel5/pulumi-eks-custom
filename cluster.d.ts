import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { VpcCni, VpcCniOptions } from "./cni";
import { NodeGroup, NodeGroupBaseOptions, NodeGroupData } from "./nodegroup";
import { EBSVolumeType, StorageClass } from "./storageclass";
import { InputTags, UserStorageClasses } from "./utils";
/**
 * RoleMapping describes a mapping from an AWS IAM role to a Kubernetes user and groups.
 */
export interface RoleMapping {
    /**
     * The ARN of the IAM role to add.
     */
    roleArn: pulumi.Input<aws.ARN>;
    /**
     * The user name within Kubernetes to map to the IAM role. By default, the user name is the ARN of the IAM role.
     */
    username: pulumi.Input<string>;
    /**
     * A list of groups within Kubernetes to which the role is mapped.
     */
    groups: pulumi.Input<pulumi.Input<string>[]>;
}
/**
 * UserMapping describes a mapping from an AWS IAM user to a Kubernetes user and groups.
 */
export interface UserMapping {
    /**
     * The ARN of the IAM user to add.
     */
    userArn: pulumi.Input<aws.ARN>;
    /**
     * The user name within Kubernetes to map to the IAM user. By default, the user name is the ARN of the IAM user.
     */
    username: pulumi.Input<string>;
    /**
     * A list of groups within Kubernetes to which the user is mapped to.
     */
    groups: pulumi.Input<pulumi.Input<string>[]>;
}
/**
 * CreationRoleProvider is a component containing the AWS Role and Provider necessary to override the `[system:master]`
 * entity ARN. This is an optional argument used in `ClusterOptions`. Read more: https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html
 */
export interface CreationRoleProvider {
    role: aws.iam.Role;
    provider: pulumi.ProviderResource;
}
/**
 * KubeconfigOptions represents the AWS credentials to scope a given kubeconfig
 * when using a non-default credential chain.
 *
 * The options can be used independently, or additively.
 *
 * A scoped kubeconfig is necessary for certain auth scenarios. For example:
 *   1. Assume a role on the default account caller,
 *   2. Use an AWS creds profile instead of the default account caller,
 *   3. Use an AWS creds creds profile instead of the default account caller,
 *      and then assume a given role on the profile. This scenario is also
 *      possible by only using a profile, iff the profile includes a role to
 *      assume in its settings.
 *
 * See for more details:
 * - https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html
 * - https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html
 * - https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html
 */
export interface KubeconfigOptions {
    /**
     * Role ARN to assume instead of the default AWS credential provider chain.
     *
     * The role is passed to kubeconfig as an authentication exec argument.
     */
    roleArn?: pulumi.Input<aws.ARN>;
    /**
     * AWS credential profile name to always use instead of the
     * default AWS credential provider chain.
     *
     * The profile is passed to kubeconfig as an authentication environment
     * setting.
     */
    profileName?: pulumi.Input<string>;
}
/**
 * CoreData defines the core set of data associated with an EKS cluster, including the network in which it runs.
 */
export interface CoreData {
    cluster: aws.eks.Cluster;
    vpcId: pulumi.Output<string>;
    subnetIds: pulumi.Output<string[]>;
    endpoint: pulumi.Output<string>;
    clusterSecurityGroup: aws.ec2.SecurityGroup;
    provider: k8s.Provider;
    instanceRoles: pulumi.Output<aws.iam.Role[]>;
    nodeGroupOptions: ClusterNodeGroupOptions;
    awsProvider?: pulumi.ProviderResource;
    publicSubnetIds?: pulumi.Output<string[]>;
    privateSubnetIds?: pulumi.Output<string[]>;
    eksNodeAccess?: k8s.core.v1.ConfigMap;
    storageClasses?: UserStorageClasses;
    kubeconfig?: pulumi.Output<any>;
    vpcCni?: VpcCni;
    tags?: InputTags;
    nodeSecurityGroupTags?: InputTags;
    fargateProfile: pulumi.Output<aws.eks.FargateProfile | undefined>;
    oidcProvider?: aws.iam.OpenIdConnectProvider;
    encryptionConfig?: pulumi.Output<aws.types.output.eks.ClusterEncryptionConfig>;
}
export interface ClusterCreationRoleProviderOptions {
    region?: aws.Region;
    profile?: string;
}
/**
 * ClusterCreationRoleProvider is a component that wraps creating a role provider that can be passed to
 * `new eks.Cluster("test", { creationRoleProvider: ... })`. This can be used to provide a
 * specific role to use for the creation of the EKS cluster different from the role being used
 * to run the Pulumi deployment.
 */
export declare class ClusterCreationRoleProvider extends pulumi.ComponentResource implements CreationRoleProvider {
    readonly role: aws.iam.Role;
    readonly provider: pulumi.ProviderResource;
    /**
     * Creates a role provider that can be passed to `new eks.Cluster("test", { creationRoleProvider: ... })`.
     * This can be used to provide a specific role to use for the creation of the EKS cluster different from
     * the role being used to run the Pulumi deployment.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this component.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name: string, args: ClusterCreationRoleProviderOptions, opts?: pulumi.ComponentResourceOptions);
}
/**
 * getRoleProvider creates a role provider that can be passed to `new eks.Cluster("test", {
 * creationRoleProvider: ... })`.  This can be used to provide a specific role to use for the
 * creation of the EKS cluster different from the role being used to run the Pulumi deployment.
 */
export declare function getRoleProvider(name: string, region?: aws.Region, profile?: string, parent?: pulumi.ComponentResource, provider?: pulumi.ProviderResource): CreationRoleProvider;
/**
 * Create the core components and settings required for the EKS cluster.
 */
export declare function createCore(name: string, args: ClusterOptions, parent: pulumi.ComponentResource, provider?: pulumi.ProviderResource): CoreData;
/**
 * ClusterOptions describes the configuration options accepted by an EKSCluster component.
 */
export interface ClusterOptions {
    /**
     * The VPC in which to create the cluster and its worker nodes. If unset, the cluster will be created in the
     * default VPC.
     */
    vpcId?: pulumi.Input<string>;
    /**
     * The set of all subnets, public and private, to use for the worker node
     * groups on the EKS cluster. These subnets are automatically tagged by EKS
     * for Kubernetes purposes.
     *
     * If `vpcId` is not set, the cluster will use the AWS account's default VPC subnets.
     *
     * If the list of subnets includes both public and private subnets, the worker
     * nodes will only be attached to the private subnets, and the public
     * subnets will be used for internet-facing load balancers.
     *
     * See for more details: https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html.
     *
     * Note: The use of `subnetIds`, along with `publicSubnetIds`
     * and/or `privateSubnetIds` is mutually exclusive. The use of
     * `publicSubnetIds` and `privateSubnetIds` is encouraged.
     */
    subnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * The set of public subnets to use for the worker node groups on the EKS cluster.
     * These subnets are automatically tagged by EKS for Kubernetes purposes.
     *
     * If `vpcId` is not set, the cluster will use the AWS account's default VPC subnets.
     *
     * Worker network architecture options:
     *  - Private-only: Only set `privateSubnetIds`.
     *    - Default workers to run in a private subnet. In this setting, Kubernetes
     *    cannot create public, internet-facing load balancers for your pods.
     *  - Public-only: Only set `publicSubnetIds`.
     *    - Default workers to run in a public subnet.
     *  - Mixed (recommended): Set both `privateSubnetIds` and `publicSubnetIds`.
     *    - Default all worker nodes to run in private subnets, and use the public subnets
     *  for internet-facing load balancers.
     *
     * See for more details: https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html.
     *
     * Note: The use of `subnetIds`, along with `publicSubnetIds`
     * and/or `privateSubnetIds` is mutually exclusive. The use of
     * `publicSubnetIds` and `privateSubnetIds` is encouraged.
     */
    publicSubnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * The set of private subnets to use for the worker node groups on the EKS cluster.
     * These subnets are automatically tagged by EKS for Kubernetes purposes.
     *
     * If `vpcId` is not set, the cluster will use the AWS account's default VPC subnets.
     *
     * Worker network architecture options:
     *  - Private-only: Only set `privateSubnetIds`.
     *    - Default workers to run in a private subnet. In this setting, Kubernetes
     *    cannot create public, internet-facing load balancers for your pods.
     *  - Public-only: Only set `publicSubnetIds`.
     *    - Default workers to run in a public subnet.
     *  - Mixed (recommended): Set both `privateSubnetIds` and `publicSubnetIds`.
     *    - Default all worker nodes to run in private subnets, and use the public subnets
     *  for internet-facing load balancers.
     *
     * See for more details: https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html.
     *
     * Note: The use of `subnetIds`, along with `publicSubnetIds`
     * and/or `privateSubnetIds` is mutually exclusive. The use of
     * `publicSubnetIds` and `privateSubnetIds` is encouraged.
     *
     * Also consider setting `nodeAssociatePublicIpAddress: true` for
     * fully private workers.
     */
    privateSubnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * The common configuration settings for NodeGroups.
     */
    nodeGroupOptions?: ClusterNodeGroupOptions;
    /**
     * Whether or not to auto-assign the EKS worker nodes public IP addresses.
     * If this toggle is set to true, the EKS workers will be
     * auto-assigned public IPs. If false, they will not be auto-assigned
     * public IPs.
     */
    nodeAssociatePublicIpAddress?: boolean;
    /**
     * Optional mappings from AWS IAM roles to Kubernetes users and groups.
     */
    roleMappings?: pulumi.Input<pulumi.Input<RoleMapping>[]>;
    /**
     * Optional mappings from AWS IAM users to Kubernetes users and groups.
     */
    userMappings?: pulumi.Input<pulumi.Input<UserMapping>[]>;
    /**
     * The configuration of the Amazon VPC CNI plugin for this instance. Defaults are described in the documentation
     * for the VpcCniOptions type.
     */
    vpcCniOptions?: VpcCniOptions;
    /**
     * Use the default VPC CNI instead of creating a custom one. Should not be used in conjunction with `vpcCniOptions`.
     */
    useDefaultVpcCni?: boolean;
    /**
     * The instance type to use for the cluster's nodes. Defaults to "t2.medium".
     */
    instanceType?: pulumi.Input<aws.ec2.InstanceType>;
    /**
     * This enables the simple case of only registering a *single* IAM
     * instance role with the cluster, that is required to be shared by
     * *all* node groups in their instance profiles.
     *
     * Note: options `instanceRole` and `instanceRoles` are mutually exclusive.
     */
    instanceRole?: pulumi.Input<aws.iam.Role>;
    /**
     * The default IAM InstanceProfile to use on the Worker NodeGroups, if one is not already set in the NodeGroup.
     */
    instanceProfileName?: pulumi.Input<string>;
    /**
     * IAM Service Role for EKS to use to manage the cluster.
     */
    serviceRole?: pulumi.Input<aws.iam.Role>;
    /**
     * The IAM Role Provider used to create & authenticate against the EKS cluster. This role is given `[system:masters]`
     * permission in K8S, See: https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html
     */
    creationRoleProvider?: CreationRoleProvider;
    /**
     * This enables the advanced case of registering *many* IAM instance roles
     * with the cluster for per node group IAM, instead of the simpler, shared case of `instanceRole`.
     *
     * Note: options `instanceRole` and `instanceRoles` are mutually exclusive.
     */
    instanceRoles?: pulumi.Input<pulumi.Input<aws.iam.Role>[]>;
    /**
     * Attach a custom role policy to worker node instance role
     *
     * @deprecated This option has been replaced with the use of
     * `instanceRole` or `instanceRoles`. The role provided to either option
     * should already include all required policies.
     */
    customInstanceRolePolicy?: pulumi.Input<string>;
    /**
     * The AMI ID to use for the worker nodes.
     *
     * Defaults to the latest recommended EKS Optimized Linux AMI from the
     * AWS Systems Manager Parameter Store.
     *
     * Note: `nodeAmiId` and `gpu` are mutually exclusive.
     *
     * See for more details:
     * - https://docs.aws.amazon.com/eks/latest/userguide/eks-optimized-ami.html.
     */
    nodeAmiId?: pulumi.Input<string>;
    /**
     * Use the latest recommended EKS Optimized Linux AMI with GPU support for
     * the worker nodes from the AWS Systems Manager Parameter Store.
     *
     * Defaults to false.
     *
     * Note: `gpu` and `nodeAmiId` are mutually exclusive.
     *
     * See for more details:
     * - https://docs.aws.amazon.com/eks/latest/userguide/eks-optimized-ami.html.
     * - https://docs.aws.amazon.com/eks/latest/userguide/retrieve-ami-id.html
     */
    gpu?: pulumi.Input<boolean>;
    /**
     * Public key material for SSH access to worker nodes. See allowed formats at:
     * https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html
     * If not provided, no SSH access is enabled on VMs.
     */
    nodePublicKey?: pulumi.Input<string>;
    /**
     * The subnets to use for worker nodes. Defaults to the value of subnetIds.
     */
    nodeSubnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * The security group to use for the cluster API endpoint.  If not provided, a new security group will be created
     * with full internet egress and ingress from node groups.
     */
    clusterSecurityGroup?: aws.ec2.SecurityGroup;
    /**
     * The tags to apply to the cluster security group.
     */
    clusterSecurityGroupTags?: InputTags;
    /**
     * Encrypt the root block device of the nodes in the node group.
     *
     * @deprecated This option has been deprecated due to a misspelling.
     * Use the correct encryptRootBlockDevice option instead.
     */
    encryptRootBockDevice?: pulumi.Input<boolean>;
    /**
     * Encrypt the root block device of the nodes in the node group.
     */
    encryptRootBlockDevice?: pulumi.Input<boolean>;
    /**
     * The tags to apply to the default `nodeSecurityGroup` created by the cluster.
     *
     * Note: The `nodeSecurityGroupTags` option and the node group option
     * `nodeSecurityGroup` are mutually exclusive.
     */
    nodeSecurityGroupTags?: InputTags;
    /**
     * The size in GiB of a cluster node's root volume. Defaults to 20.
     */
    nodeRootVolumeSize?: pulumi.Input<number>;
    /**
     * Extra code to run on node startup. This code will run after the AWS EKS bootstrapping code and before the node
     * signals its readiness to the managing CloudFormation stack. This code must be a typical user data script:
     * critically it must begin with an interpreter directive (i.e. a `#!`).
     */
    nodeUserData?: pulumi.Input<string>;
    /**
     * The number of worker nodes that should be running in the cluster. Defaults to 2.
     */
    desiredCapacity?: pulumi.Input<number>;
    /**
     * The minimum number of worker nodes running in the cluster. Defaults to 1.
     */
    minSize?: pulumi.Input<number>;
    /**
     * The maximum number of worker nodes running in the cluster. Defaults to 2.
     */
    maxSize?: pulumi.Input<number>;
    /**
     * An optional set of StorageClasses to enable for the cluster. If this is a single volume type rather than a map,
     * a single StorageClass will be created for that volume type.
     *
     * Note: As of Kubernetes v1.11+ on EKS, a default `gp2` storage class will
     * always be created automatically for the cluster by the EKS service. See
     * https://docs.aws.amazon.com/eks/latest/userguide/storage-classes.html
     */
    storageClasses?: {
        [name: string]: StorageClass;
    } | EBSVolumeType;
    /**
     * If this toggle is set to true, the EKS cluster will be created without node group attached.
     * Defaults to false, unless `fargate` input is provided.
     */
    skipDefaultNodeGroup?: boolean;
    /**
     * Whether or not to deploy the Kubernetes dashboard to the cluster. If the dashboard is deployed, it can be
     * accessed as follows:
     *
     * 1. Retrieve an authentication token for the dashboard by running the following and copying the value of `token`
     *   from the output of the last command:
     *
     *     $ kubectl -n kube-system get secret | grep eks-admin | awk '{print $1}'
     *     $ kubectl -n kube-system describe secret <output from previous command>
     *
     * 2. Start the kubectl proxy:
     *
     *     $ kubectl proxy
     *
     * 3. Open `http://localhost:8001/api/v1/namespaces/kube-system/services/https:kubernetes-dashboard:/proxy/` in a
     *    web browser.
     * 4. Choose `Token` authentication, paste the token retrieved earlier into the `Token` field, and sign in.
     *
     * Defaults to `false`.
     *
     * @deprecated This option has been deprecated due to a lack of
     * support for it on EKS, and the general community recommendation to avoid
     * using it for security concerns. If you'd like alternatives to deploy the
     * dashboard, consider writing it in Pulumi, or using the Helm chart.
     */
    deployDashboard?: boolean;
    /**
     * Key-value mapping of tags that are automatically applied to all AWS
     * resources directly under management with this cluster, which support tagging.
    */
    tags?: InputTags;
    /**
     * Desired Kubernetes master / control plane version. If you do not specify a value, the latest available version is used.
     */
    version?: pulumi.Input<string>;
    /**
     * Enable EKS control plane logging. This sends logs to cloudwatch.
     * Possible list of values are: ["api", "audit", "authenticator", "controllerManager", "scheduler"].
     * By default it is off.
     */
    enabledClusterLogTypes?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * Indicates whether or not the Amazon EKS public API server endpoint is enabled. Default is `true`.
     */
    endpointPublicAccess?: pulumi.Input<boolean>;
    /**
     * Indicates whether or not the Amazon EKS private API server endpoint is enabled.  The default is `false`.
     */
    endpointPrivateAccess?: pulumi.Input<boolean>;
    /**
     * Indicates which CIDR blocks can access the Amazon EKS public API server endpoint.
     */
    publicAccessCidrs?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * Add support for launching pods in Fargate.  Defaults to launching pods in the `default`
     * namespace.  If specified, the default node group is skipped as though `skipDefaultNodeGroup:
     * true` had been passed.
     */
    fargate?: pulumi.Input<boolean | FargateProfile>;
    /**
     * The tags to apply to the EKS cluster.
     */
    clusterTags?: InputTags;
    /**
     * Indicates whether an IAM OIDC Provider is created for the EKS cluster.
     *
     * The OIDC provider is used in the cluster in combination with k8s
     * Service Account annotations to provide IAM roles at the k8s Pod level.
     *
     * See for more details:
     * - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html
     * - https://docs.aws.amazon.com/eks/latest/userguide/enable-iam-roles-for-service-accounts.html
     * - https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/
     * - https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/aws/eks/#enabling-iam-roles-for-service-accounts
     */
    createOidcProvider?: pulumi.Input<boolean>;
    /**
     * The cluster's physical resource name.
     *
     * If not specified, the default is to use auto-naming for the cluster's
     * name, resulting in a physical name with the format `${name}-eksCluster-0123abcd`.
     *
     * See for more details:
     * https://www.pulumi.com/docs/intro/concepts/programming-model/#autonaming
     */
    name?: pulumi.Input<string>;
    /**
     * The HTTP(S) proxy to use within a proxied environment.
     *
     * The proxy is used during cluster creation, and OIDC configuration.
     *
     * This is an alternative option to setting the proxy environment variables:
     * HTTP(S)_PROXY and/or http(s)_proxy.
     *
     * This option is required iff the proxy environment variables are not set.
     *
     * Format:      <protocol>://<host>:<port>
     * Auth Format: <protocol>://<username>:<password>@<host>:<port>
     *
     * Ex:
     *   - "http://proxy.example.com:3128"
     *   - "https://proxy.example.com"
     *   - "http://username:password@proxy.example.com:3128"
     */
    proxy?: string;
    /**
     * The AWS provider credential options to scope the cluster's kubeconfig
     * authentication when using a non-default credential chain.
     *
     * This is required for certain auth scenarios. For example:
     * - Creating and using a new AWS provider instance, or
     * - Setting the AWS_PROFILE environment variable, or
     * - Using a named profile configured on the AWS provider via:
     * `pulumi config set aws:profile <profileName>`
     *
     * See for more details:
     * - https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/aws/#Provider
     * - https://www.pulumi.com/docs/intro/cloud-providers/aws/setup/
     * - https://www.pulumi.com/docs/intro/cloud-providers/aws/#configuration
     * - https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html
     */
    providerCredentialOpts?: pulumi.Input<KubeconfigOptions>;
    /**
     * KMS Key ARN to use with the encryption configuration for the cluster.
     *
     * Only available on Kubernetes 1.13+ clusters created after March 6, 2020.
     * See for more details:
     * - https://aws.amazon.com/about-aws/whats-new/2020/03/amazon-eks-adds-envelope-encryption-for-secrets-with-aws-kms/
     */
    encryptionConfigKeyArn?: pulumi.Input<string>;
    /**
     * The CIDR block to assign Kubernetes service IP addresses from. If you don't specify a block, Kubernetes assigns
     * addresses from either the 10.100.0.0/16 or 172.20.0.0/16 CIDR blocks. We recommend that you specify a block that
     * does not overlap with resources in other networks that are peered or connected to your VPC. You can only specify
     * a custom CIDR block when you create a cluster, changing this value will force a new cluster to be created.
     *
     * The block must meet the following requirements:
     * - Within one of the following private IP address blocks: 10.0.0.0/8, 172.16.0.0.0/12, or 192.168.0.0/16.
     * - Doesn't overlap with any CIDR block assigned to the VPC that you selected for VPC.
     * - Between /24 and /12.
     */
    kubernetesServiceIpAddressRange?: pulumi.Input<string>;
}
/**
 * FargateProfile defines how Kubernetes pods are executed in Fargate. See
 * aws.eks.FargateProfileArgs for reference.
 */
export interface FargateProfile {
    /**
     * Specify a custom role to use for executing pods in Fargate. Defaults to creating a new role
     * with the `arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy` policy attached.
     */
    podExecutionRoleArn?: pulumi.Input<string>;
    /**
     * Specify the subnets in which to execute Fargate tasks for pods.  Defaults to the private
     * subnets associated with the cluster.
     */
    subnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * Specify the namespace and label selectors to use for launching pods into Fargate.
     */
    selectors?: pulumi.Input<pulumi.Input<aws.types.input.eks.FargateProfileSelector>[]>;
}
/**
 * ClusterNodeGroupOptions describes the configuration options accepted by a cluster
 * to create its own node groups. It's a subset of NodeGroupOptions.
 */
export interface ClusterNodeGroupOptions extends NodeGroupBaseOptions {
}
/**
 * Cluster is a component that wraps the AWS and Kubernetes resources necessary to run an EKS cluster, its worker
 * nodes, its optional StorageClasses, and an optional deployment of the Kubernetes Dashboard.
 */
export declare class Cluster extends pulumi.ComponentResource {
    /**
     * A kubeconfig that can be used to connect to the EKS cluster.
     */
    readonly kubeconfig: pulumi.Output<any>;
    /**
     * The AWS resource provider.
     */
    readonly awsProvider: pulumi.ProviderResource;
    /**
     * A Kubernetes resource provider that can be used to deploy into this cluster. For example, the code below will
     * create a new Pod in the EKS cluster.
     *
     *     let eks = new Cluster("eks");
     *     let pod = new kubernetes.core.v1.Pod("pod", { ... }, { provider: eks.provider });
     *
     */
    readonly provider: k8s.Provider;
    /**
     * The security group for the EKS cluster.
     */
    readonly clusterSecurityGroup: aws.ec2.SecurityGroup;
    /**
     * The service roles used by the EKS cluster.
     */
    readonly instanceRoles: pulumi.Output<aws.iam.Role[]>;
    /**
     * The security group for the cluster's nodes.
     */
    readonly nodeSecurityGroup: aws.ec2.SecurityGroup;
    /**
     * The ingress rule that gives node group access to cluster API server
     */
    readonly eksClusterIngressRule: aws.ec2.SecurityGroupRule;
    /**
     * The default Node Group configuration, or undefined if `skipDefaultNodeGroup` was specified.
     */
    readonly defaultNodeGroup: NodeGroupData | undefined;
    /**
     * The EKS cluster.
     */
    readonly eksCluster: aws.eks.Cluster;
    /**
     * The EKS cluster and its dependencies.
     */
    readonly core: CoreData;
    /**
     * Create a new EKS cluster with worker nodes, optional storage classes, and deploy the Kubernetes Dashboard if
     * requested.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this cluster.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name: string, args?: ClusterOptions, opts?: pulumi.ComponentResourceOptions);
    /**
     * Create a self-managed node group using CloudFormation and an ASG.
     *
     * See for more details:
     * https://docs.aws.amazon.com/eks/latest/userguide/worker.html
     */
    createNodeGroup(name: string, args: ClusterNodeGroupOptions): NodeGroup;
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
    getKubeconfig(args: KubeconfigOptions): pulumi.Output<string>;
}
