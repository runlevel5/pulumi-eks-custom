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
exports.VpcCni = void 0;
const pulumi = require("@pulumi/pulumi");
// Dynamic providers don't currently work well with multi-language components [1]. To workaround this, the
// dynamic providers in this library have been ported to be custom resources implemented by the new provider
// plugin. An alias is used and care has been taken in the implementation inside the provider to avoid any
// diffs for any existing stacks that were created using the old dynamic provider.
// [1] https://github.com/pulumi/pulumi/issues/5455
/**
 * VpcCni manages the configuration of the Amazon VPC CNI plugin for Kubernetes by applying its YAML chart. Once Pulumi is
 * able to programatically manage existing infrastructure, we can replace this with a real k8s resource.
 */
class VpcCni extends pulumi.CustomResource {
    constructor(name, kubeconfig, args, opts) {
        // This was previously implemented as a dynamic provider, so alias the old type.
        const aliasOpts = { aliases: [{ type: "pulumi-nodejs:dynamic:Resource" }] };
        opts = pulumi.mergeOptions(opts, aliasOpts);
        args = args || {};
        super("eks:index:VpcCni", name, {
            kubeconfig: pulumi.output(kubeconfig).apply(JSON.stringify),
            nodePortSupport: args.nodePortSupport,
            customNetworkConfig: args.customNetworkConfig,
            externalSnat: args.externalSnat,
            warmEniTarget: args.warmEniTarget,
            warmIpTarget: args.warmIpTarget,
            logLevel: args.logLevel,
            logFile: args.logFile,
            image: args.image,
            eniConfigLabelDef: args.eniConfigLabelDef,
        }, opts);
    }
}
exports.VpcCni = VpcCni;
//# sourceMappingURL=cni.js.map