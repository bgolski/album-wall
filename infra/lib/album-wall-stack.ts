import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const DISCOGS_TOKEN_PARAMETER_NAME = "/album-wall/discogs-token";
const DISCOGS_CONSUMER_KEY_PARAMETER_NAME = "/album-wall/discogs-consumer-key";
const DISCOGS_CONSUMER_SECRET_PARAMETER_NAME = "/album-wall/discogs-consumer-secret";
const ALLOWED_FRONTEND_ORIGINS = [
  "https://bradleygolski.com",
  "https://bgolski.github.io",
  "http://localhost:3000",
  "http://localhost:3001",
];
const APPLICATION_TAG_VALUE = "album-wall";

/**
 * Root infrastructure stack for album-wall AWS resources.
 * Additional resources for the Discogs proxy will be added here incrementally.
 */
export class AlbumWallStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("application", APPLICATION_TAG_VALUE);

    const discogsTokenParameter = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "DiscogsTokenParameter",
      {
        parameterName: DISCOGS_TOKEN_PARAMETER_NAME,
      }
    );

    const discogsConsumerKeyParameter = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "DiscogsConsumerKeyParameter",
      {
        parameterName: DISCOGS_CONSUMER_KEY_PARAMETER_NAME,
      }
    );

    const discogsConsumerSecretParameter = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "DiscogsConsumerSecret",
      {
        parameterName: DISCOGS_CONSUMER_SECRET_PARAMETER_NAME,
      }
    );

    const discogsProxyFunction = new lambdaNodejs.NodejsFunction(this, "DiscogsProxyFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: "lambda/discogs-proxy/index.ts",
      handler: "handler",
      description: "Discogs proxy for the album-wall static frontend.",
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      reservedConcurrentExecutions: 5,
      environment: {
        DISCOGS_TOKEN_PARAMETER_NAME,
        DISCOGS_CONSUMER_KEY_PARAMETER_NAME,
        DISCOGS_CONSUMER_SECRET_PARAMETER_NAME,
      },
      bundling: {
        target: "node20",
      },
    });

    discogsTokenParameter.grantRead(discogsProxyFunction);
    discogsConsumerKeyParameter.grantRead(discogsProxyFunction);
    discogsConsumerSecretParameter.grantRead(discogsProxyFunction);

    const functionUrl = discogsProxyFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ALLOWED_FRONTEND_ORIGINS,
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
        allowedHeaders: ["content-type"],
      },
    });

    new cdk.CfnOutput(this, "DiscogsProxyFunctionUrl", {
      value: functionUrl.url,
      description: "Public Lambda Function URL for the Discogs proxy.",
    });

    new cdk.CfnOutput(this, "DiscogsTokenParameterName", {
      value: DISCOGS_TOKEN_PARAMETER_NAME,
      description: "SSM parameter path that stores the Discogs API token.",
    });

    new cdk.CfnOutput(this, "DiscogsConsumerKeyParameterName", {
      value: DISCOGS_CONSUMER_KEY_PARAMETER_NAME,
      description: "SSM parameter path that stores the Discogs consumer key.",
    });

    new cdk.CfnOutput(this, "DiscogsConsumerSecretParameterName", {
      value: DISCOGS_CONSUMER_SECRET_PARAMETER_NAME,
      description: "SSM parameter path that stores the Discogs consumer secret.",
    });
  }
}
