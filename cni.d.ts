import * as pulumi from "@pulumi/pulumi";
/**
 * VpcCniOptions describes the configuration options available for the Amazon VPC CNI plugin for Kubernetes.
 */
export interface VpcCniOptions {
    /**
     * Specifies whether NodePort services are enabled on a worker node's primary network interface. This requires
     * additional iptables rules and that the kernel's reverse path filter on the primary interface is set to loose.
     *
     * Defaults to true.
     */
    nodePortSupport?: pulumi.Input<boolean>;
    /**
     * Specifies that your pods may use subnets and security groups (within the same VPC as your control plane
     * resources) that are independent of your cluster's `resourcesVpcConfig`.
     *
     * Defaults to false.
     */
    customNetworkConfig?: pulumi.Input<boolean>;
    /**
     * Specifies whether an external NAT gateway should be used to provide SNAT of secondary ENI IP addresses. If set
     * to true, the SNAT iptables rule and off-VPC IP rule are not applied, and these rules are removed if they have
     * already been applied.
     *
     * Defaults to false.
     */
    externalSnat?: pulumi.Input<boolean>;
    /**
     * Specifies the number of free elastic network interfaces (and all of their available IP addresses) that the ipamD
     * daemon should attempt to keep available for pod assignment on the node.
     *
     * Defaults to 1.
     */
    warmEniTarget?: pulumi.Input<number>;
    /**
     * Specifies the number of free IP addresses that the ipamD daemon should attempt to keep available for pod
     * assignment on the node.
     */
    warmIpTarget?: pulumi.Input<number>;
    /**
     * Specifies the log level used for logs.
     *
     * Defaults to "DEBUG".
     * See more options: https://git.io/fj92K
     */
    logLevel?: pulumi.Input<string>;
    /**
     * Specifies the file path used for logs.
     *
     * Defaults to "stdout" to emit Pod logs for `kubectl logs`.
     */
    logFile?: pulumi.Input<string>;
    /**
     * Specifies the container image to use in the AWS CNI cluster DaemonSet.
     *
     * Defaults to the official AWS CNI image in ECR.
     */
    image?: pulumi.Input<string>;
    /**
     * Specifies the veth prefix used to generate the host-side veth device
     * name for the CNI.
     *
     * The prefix can be at most 4 characters long.
     *
     * Defaults to "eni".
     */
    vethPrefix?: pulumi.Input<string>;
    /**
     * Used to configure the MTU size for attached ENIs. The valid range is
     * from 576 to 9001.
     *
     * Defaults to 9001.
     */
    eniMtu?: pulumi.Input<number>;
    eniConfigLabelDef?: pulumi.Input<string>;
}
/**
 * VpcCni manages the configuration of the Amazon VPC CNI plugin for Kubernetes by applying its YAML chart. Once Pulumi is
 * able to programatically manage existing infrastructure, we can replace this with a real k8s resource.
 */
export declare class VpcCni extends pulumi.CustomResource {
    constructor(name: string, kubeconfig: pulumi.Input<any>, args?: VpcCniOptions, opts?: pulumi.CustomResourceOptions);
}
