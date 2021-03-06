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
exports.main = void 0;
const pulumi = require("@pulumi/pulumi");
const cluster_1 = require("./cluster");
const cni_1 = require("./cni");
const nodegroup_1 = require("./nodegroup");
const randomSuffix_1 = require("./randomSuffix");
const securitygroup_1 = require("./securitygroup");
class Provider {
    constructor() {
        this.version = getVersion();
        // A map of types to provider factories. Calling a factory may return a new instance each
        // time or return the same provider instance.
        this.typeToProviderFactoryMap = {
            "eks:index:Cluster": cluster_1.clusterProviderFactory,
            "eks:index:ClusterCreationRoleProvider": cluster_1.clusterCreationRoleProviderProviderFactory,
            "eks:index:ManagedNodeGroup": nodegroup_1.managedNodeGroupProviderFactory,
            "eks:index:NodeGroup": nodegroup_1.nodeGroupProviderFactory,
            "eks:index:NodeGroupSecurityGroup": securitygroup_1.nodeGroupSecurityGroupProviderFactory,
            "eks:index:RandomSuffix": randomSuffix_1.randomSuffixProviderFactory,
            "eks:index:VpcCni": cni_1.vpcCniProviderFactory,
        };
    }
    check(urn, olds, news) {
        const provider = this.getProviderForURN(urn);
        if (!provider) {
            return unknownResourceRejectedPromise(urn);
        }
        return provider.check
            ? provider.check(urn, olds, news)
            : Promise.resolve({ inputs: news, failures: [] });
    }
    diff(id, urn, olds, news) {
        const provider = this.getProviderForURN(urn);
        if (!provider) {
            return unknownResourceRejectedPromise(urn);
        }
        return provider.diff
            ? provider.diff(id, urn, olds, news)
            : Promise.resolve({});
    }
    create(urn, inputs) {
        const provider = this.getProviderForURN(urn);
        return (provider === null || provider === void 0 ? void 0 : provider.create) ? provider.create(urn, inputs)
            : unknownResourceRejectedPromise(urn);
    }
    read(id, urn, props) {
        const provider = this.getProviderForURN(urn);
        if (!provider) {
            return unknownResourceRejectedPromise(urn);
        }
        return provider.read
            ? provider.read(id, urn, props)
            : Promise.resolve({ id, props });
    }
    update(id, urn, olds, news) {
        const provider = this.getProviderForURN(urn);
        if (!provider) {
            return unknownResourceRejectedPromise(urn);
        }
        return provider.update
            ? provider.update(id, urn, olds, news)
            : Promise.resolve({ outs: news });
    }
    delete(id, urn, props) {
        const provider = this.getProviderForURN(urn);
        if (!provider) {
            return unknownResourceRejectedPromise(urn);
        }
        return provider.delete
            ? provider.delete(id, urn, props)
            : Promise.resolve();
    }
    construct(name, type, inputs, options) {
        const provider = this.getProviderForType(type);
        return (provider === null || provider === void 0 ? void 0 : provider.construct) ? provider.construct(name, type, inputs, options)
            : unknownResourceRejectedPromise(type);
    }
    /**
     * Returns a provider for the URN or undefined if not found.
     */
    getProviderForURN(urn) {
        const type = getType(urn);
        return this.getProviderForType(type);
    }
    /**
     * Returns a provider for the type or undefined if not found.
     */
    getProviderForType(type) {
        const factory = this.typeToProviderFactoryMap[type];
        return factory ? factory() : undefined;
    }
}
function unknownResourceRejectedPromise(type) {
    return Promise.reject(new Error(`unknown resource type ${type}`));
}
function getType(urn) {
    const qualifiedType = urn.split("::")[2];
    const types = qualifiedType.split("$");
    const lastType = types[types.length - 1];
    return lastType;
}
function getVersion() {
    const version = require("../../package.json").version;
    // Node allows for the version to be prefixed by a "v", while semver doesn't.
    // If there is a v, strip it off.
    return version.startsWith("v") ? version.slice(1) : version;
}
/** @internal */
function main(args) {
    return pulumi.provider.main(new Provider(), args);
}
exports.main = main;
main(process.argv.slice(2));
//# sourceMappingURL=index.js.map