import * as aws from "@pulumi/aws";
import * as awsInputs from "@pulumi/aws/types/input";
import * as pulumi from "@pulumi/pulumi";
import { Cluster, CoreData } from "./cluster";
import { InputTags } from "./utils";
/**
 * Taint represents a Kubernetes `taint` to apply to all Nodes in a NodeGroup.  See
 * https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/.
 */
export interface Taint {
    /**
     * The value of the taint.
     */
    value: string;
    /**
     * The effect of the taint.
     */
    effect: "NoSchedule" | "NoExecute" | "PreferNoSchedule";
}
/**
 * NodeGroupArgs represents the common configuration settings for NodeGroups.
 */
export interface NodeGroupBaseOptions {
    /**
     * The set of subnets to override and use for the worker node group.
     *
     * Setting this option overrides which subnets to use for the worker node
     * group, regardless if the cluster's `subnetIds` is set, or if
     * `publicSubnetIds` and/or `privateSubnetIds` were set.
     */
    nodeSubnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * The instance type to use for the cluster's nodes. Defaults to "t2.medium".
     */
    instanceType?: pulumi.Input<aws.ec2.InstanceType>;
    /**
     * Bidding price for spot instance. If set, only spot instances will be added as worker node
     */
    spotPrice?: pulumi.Input<string>;
    /**
     * The security group for the worker node group to communicate with the cluster.
     *
     * This security group requires specific inbound and outbound rules.
     *
     * See for more details:
     * https://docs.aws.amazon.com/eks/latest/userguide/sec-group-reqs.html
     *
     * Note: The `nodeSecurityGroup` option and the cluster option
     * `nodeSecurityGroupTags` are mutually exclusive.
     */
    nodeSecurityGroup?: aws.ec2.SecurityGroup;
    /**
     * The ingress rule that gives node group access.
     */
    clusterIngressRule?: aws.ec2.SecurityGroupRule;
    /**
     * Extra security groups to attach on all nodes in this worker node group.
     *
     * This additional set of security groups captures any user application rules
     * that will be needed for the nodes.
     */
    extraNodeSecurityGroups?: aws.ec2.SecurityGroup[];
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
     * Public key material for SSH access to worker nodes. See allowed formats at:
     * https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html
     * If not provided, no SSH access is enabled on VMs.
     */
    nodePublicKey?: pulumi.Input<string>;
    /**
     * Name of the key pair to use for SSH access to worker nodes.
     */
    keyName?: pulumi.Input<string>;
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
     * User specified code to run on node startup. This code is expected to
     * handle the full AWS EKS bootstrapping code and signal node readiness
     * to the managing CloudFormation stack. This code must be a complete
     * and executable user data script in bash (Linux) or powershell (Windows).
     *
     * See for more details: https://docs.aws.amazon.com/eks/latest/userguide/worker.html
     */
    nodeUserDataOverride?: pulumi.Input<string>;
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
     * The AMI ID to use for the worker nodes.
     *
     * Defaults to the latest recommended EKS Optimized Linux AMI from the
     * AWS Systems Manager Parameter Store.
     *
     * Note: `amiId` and `gpu` are mutually exclusive.
     *
     * See for more details:
     * - https://docs.aws.amazon.com/eks/latest/userguide/eks-optimized-ami.html.
     */
    amiId?: pulumi.Input<string>;
    /**
     * Use the latest recommended EKS Optimized Linux AMI with GPU support for
     * the worker nodes from the AWS Systems Manager Parameter Store.
     *
     * Defaults to false.
     *
     * Note: `gpu` and `amiId` are mutually exclusive.
     *
     * See for more details:
     * - https://docs.aws.amazon.com/eks/latest/userguide/eks-optimized-ami.html.
     * - https://docs.aws.amazon.com/eks/latest/userguide/retrieve-ami-id.html
     */
    gpu?: pulumi.Input<boolean>;
    /**
     * Custom k8s node labels to be attached to each woker node.  Adds the given key/value pairs to the `--node-labels`
     * kubelet argument.
     */
    labels?: {
        [key: string]: string;
    };
    /**
     * Custom k8s node taints to be attached to each worker node.  Adds the given taints to the `--register-with-taints`
     * kubelet argument.
     */
    taints?: {
        [key: string]: Taint;
    };
    /**
     * Extra args to pass to the Kubelet.  Corresponds to the options passed in the `--kubeletExtraArgs` flag to
     * `/etc/eks/bootstrap.sh`.  For example, '--port=10251 --address=0.0.0.0'. Note that the `labels` and `taints`
     * properties will be applied to this list (using `--node-labels` and `--register-with-taints` respectively) after
     * to the expicit `kubeletExtraArgs`.
     */
    kubeletExtraArgs?: string;
    /**
     * Additional args to pass directly to `/etc/eks/bootstrap.sh`.  Fror details on available options, see:
     * https://github.com/awslabs/amazon-eks-ami/blob/master/files/bootstrap.sh.  Note that the `--apiserver-endpoint`,
     * `--b64-cluster-ca` and `--kubelet-extra-args` flags are included automatically based on other configuration
     * parameters.
     */
    bootstrapExtraArgs?: string;
    /**
     * Whether or not to auto-assign public IP addresses on the EKS worker nodes.
     * If this toggle is set to true, the EKS workers will be
     * auto-assigned public IPs. If false, they will not be auto-assigned
     * public IPs.
     */
    nodeAssociatePublicIpAddress?: boolean;
    /**
     * Desired Kubernetes master / control plane version. If you do not specify a value, the latest available version is used.
     */
    version?: pulumi.Input<string>;
    /**
     * The instance profile to use for this node group. Note, the role for the instance profile
     * must be supplied in the ClusterOptions as either: 'instanceRole', or as a role of 'instanceRoles'.
     */
    instanceProfile?: aws.iam.InstanceProfile;
    /**
     * The tags to apply to the NodeGroup's AutoScalingGroup in the
     * CloudFormation Stack.
     *
     * Per AWS, all stack-level tags, including automatically created tags, and
     * the `cloudFormationTags` option are propagated to resources that AWS
     * CloudFormation supports, including the AutoScalingGroup. See
     * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html
     *
     * Note: Given the inheritance of auto-generated CF tags and
     * `cloudFormationTags`, you should either supply the tag in
     * `autoScalingGroupTags` or `cloudFormationTags`, but not both.
     */
    autoScalingGroupTags?: InputTags;
    /**
     * The tags to apply to the CloudFormation Stack of the Worker NodeGroup.
     *
     * Note: Given the inheritance of auto-generated CF tags and
     * `cloudFormationTags`, you should either supply the tag in
     * `autoScalingGroupTags` or `cloudFormationTags`, but not both.
     */
    cloudFormationTags?: InputTags;
}
/**
 * NodeGroupOptions describes the configuration options accepted by a NodeGroup component.
 */
export interface NodeGroupOptions extends NodeGroupBaseOptions {
    /**
     * The target EKS cluster.
     */
    cluster: Cluster | CoreData;
}
/**
 * NodeGroupData describes the resources created for the given NodeGroup.
 */
export interface NodeGroupData {
    /**
     * The security group for the node group to communicate with the cluster.
     */
    nodeSecurityGroup: aws.ec2.SecurityGroup;
    /**
     * The CloudFormation Stack which defines the node group's AutoScalingGroup.
     */
    cfnStack: aws.cloudformation.Stack;
    /**
     * The AutoScalingGroup name for the node group.
     */
    autoScalingGroupName: pulumi.Output<string>;
    /**
     * The additional security groups for the node group that captures user-specific rules.
     */
    extraNodeSecurityGroups?: aws.ec2.SecurityGroup[];
}
/**
 * NodeGroup is a component that wraps the AWS EC2 instances that provide compute capacity for an EKS cluster.
 */
export declare class NodeGroup extends pulumi.ComponentResource implements NodeGroupData {
    /**
     * The security group for the node group to communicate with the cluster.
     */
    readonly nodeSecurityGroup: aws.ec2.SecurityGroup;
    /**
     * The additional security groups for the node group that captures user-specific rules.
     */
    readonly extraNodeSecurityGroups: aws.ec2.SecurityGroup[];
    /**
     * The CloudFormation Stack which defines the Node AutoScalingGroup.
     */
    cfnStack: aws.cloudformation.Stack;
    /**
     * The AutoScalingGroup name for the Node group.
     */
    autoScalingGroupName: pulumi.Output<string>;
    /**
     * Create a new EKS cluster with worker nodes, optional storage classes, and deploy the Kubernetes Dashboard if
     * requested.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this cluster.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name: string, args: NodeGroupOptions, opts?: pulumi.ComponentResourceOptions);
}
/**
 * Create a self-managed node group using CloudFormation and an ASG.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/worker.html
 */
export declare function createNodeGroup(name: string, args: NodeGroupOptions, parent: pulumi.ComponentResource, provider?: pulumi.ProviderResource): NodeGroupData;
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
export declare function computeWorkerSubnets(parent: pulumi.Resource, subnetIds: string[]): Promise<string[]>;
/**
 * ManagedNodeGroupOptions describes the configuration options accepted by an
 * AWS Managed NodeGroup.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
 */
export declare type ManagedNodeGroupOptions = Omit<aws.eks.NodeGroupArgs, "clusterName" | "nodeRoleArn" | "subnetIds" | "scalingConfig"> & {
    /**
     * The target EKS cluster.
     */
    cluster: Cluster | CoreData;
    /**
     * Make clusterName optional, since the cluster is required and it contains it.
     */
    clusterName?: pulumi.Output<string>;
    /**
     * Make nodeGroupName optional, since the NodeGroup resource name can be
     * used as a default.
     */
    nodeGroupName?: pulumi.Input<string>;
    /**
     * Make nodeRoleArn optional, since users may prefer to provide the
     * nodegroup role directly using nodeRole.
     *
     * Note, nodeRoleArn and nodeRole are mutually exclusive, and a single option
     * must be used.
     */
    nodeRoleArn?: pulumi.Input<string>;
    /**
     * Make nodeRole optional, since users may prefer to provide the
     * nodeRoleArn.
     *
     * Note, nodeRole and nodeRoleArn are mutually exclusive, and a single
     * option must be used.
     */
    nodeRole?: pulumi.Input<aws.iam.Role>;
    /**
     * Make subnetIds optional, since the cluster is required and it contains it.
     *
     * Default subnetIds is chosen from the following list, in order, if
     * subnetIds arg is not set:
     *   - core.subnetIds
     *   - core.privateIds
     *   - core.publicSublicSubnetIds
     *
     * This default logic is based on the existing subnet IDs logic of this
     * package: https://git.io/JeM11
     */
    subnetIds?: pulumi.Input<pulumi.Input<string>[]>;
    /**
     * Make scalingConfig optional, since defaults can be computed.
     *
     * Default scaling amounts of the node group autoscaling group are:
     *   - desiredSize: 2
     *   - minSize: 1
     *   - maxSize: 2
     */
    scalingConfig?: pulumi.Input<awsInputs.eks.NodeGroupScalingConfig>;
};
/**
 * ManagedNodeGroup is a component that wraps creating an AWS managed node group.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
 */
export declare class ManagedNodeGroup extends pulumi.ComponentResource {
    /**
     * The AWS managed node group.
     */
    readonly nodeGroup: aws.eks.NodeGroup;
    /**
     * Create a new AWS managed node group.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this node group.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name: string, args: ManagedNodeGroupOptions, opts?: pulumi.ComponentResourceOptions);
}
/**
 * Create an AWS managed node group.
 *
 * See for more details:
 * https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
 */
export declare function createManagedNodeGroup(name: string, args: ManagedNodeGroupOptions, parent?: pulumi.ComponentResource, provider?: pulumi.ProviderResource): aws.eks.NodeGroup;
