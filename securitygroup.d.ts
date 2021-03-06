import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { InputTags } from "./utils";
/**
 * NodeGroupSecurityGroupOptions describes the configuration options accepted
 * by a security group for use with a NodeGroup.
 */
export interface NodeGroupSecurityGroupOptions {
    /**
     * The VPC in which to create the worker node group.
     */
    vpcId: pulumi.Input<string>;
    /**
     * The security group associated with the EKS cluster.
     */
    clusterSecurityGroup: aws.ec2.SecurityGroup;
    tags?: InputTags;
    /**
     * The EKS cluster associated with the worker node group.
     */
    eksCluster: aws.eks.Cluster;
}
/**
 * NodeGroupSecurityGroup is a component that wraps creating a security group for node groups with the
 * default ingress & egress rules required to connect and work with the EKS cluster security group.
 */
export declare class NodeGroupSecurityGroup extends pulumi.ComponentResource {
    /**
     * The security group for node groups with the default ingress & egress rules required to connect
     * and work with the EKS cluster security group.
     */
    readonly securityGroup: aws.ec2.SecurityGroup;
    /**
     * The EKS cluster ingress rule.
     */
    readonly securityGroupRule: aws.ec2.SecurityGroupRule;
    /**
     * Creates a security group for node groups with the default ingress & egress
     * rules required to connect and work with the EKS cluster security group.
     *
     * @param name The _unique_ name of this component.
     * @param args The arguments for this component.
     * @param opts A bag of options that control this component's behavior.
     */
    constructor(name: string, args: NodeGroupSecurityGroupOptions, opts?: pulumi.ComponentResourceOptions);
}
/**
 * createNodeGroupSecurityGroup creates a security group for node groups with the
 * default ingress & egress rules required to connect and work with the EKS
 * cluster security group.
 */
export declare function createNodeGroupSecurityGroup(name: string, args: NodeGroupSecurityGroupOptions, parent: pulumi.ComponentResource, provider?: pulumi.ProviderResource): [aws.ec2.SecurityGroup, aws.ec2.SecurityGroupRule];
