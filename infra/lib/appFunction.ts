import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

/** Bundling for functions that use sharp, whose native parts must be the Linux ARM build whatever machine deploys. */
export const SHARP_BUNDLING: lambdaNodejs.BundlingOptions = {
  target: "node22",
  nodeModules: ["sharp"],
  environment: { npm_config_os: "linux", npm_config_cpu: "arm64", npm_config_libc: "glibc" },
};

export interface AppFunctionProps {
  entry: string;
  description: string;
  timeout: cdk.Duration;
  memorySize: number;
  reservedConcurrentExecutions: number;
  environment?: Record<string, string>;
  bundling: lambdaNodejs.BundlingOptions;
}

/**
 * One of the app's functions: Node 24 on ARM, handler "handler", logs kept two weeks and removed
 * with the stack. Creates `<name>Function` and its log group `<name>Logs` in `scope`.
 */
export function appFunction(
  scope: Construct,
  name: string,
  props: AppFunctionProps
): lambdaNodejs.NodejsFunction {
  return new lambdaNodejs.NodejsFunction(scope, `${name}Function`, {
    runtime: lambda.Runtime.NODEJS_24_X,
    architecture: lambda.Architecture.ARM_64,
    logGroup: new logs.LogGroup(scope, `${name}Logs`, {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
    entry: props.entry,
    handler: "handler",
    description: props.description,
    timeout: props.timeout,
    memorySize: props.memorySize,
    reservedConcurrentExecutions: props.reservedConcurrentExecutions,
    bundling: props.bundling,
    ...(props.environment ? { environment: props.environment } : {}),
  });
}
