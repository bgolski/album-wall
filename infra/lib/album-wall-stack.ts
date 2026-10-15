import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
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
// Where cost and usage alerts go; kept in Parameter Store, like the Discogs secrets, so the
// address is not in the repository.
const ALERT_EMAIL_PARAMETER_NAME = "/album-wall/alert-email";
// Hosting must stay free: alert on the first cent spent, and when the month is forecast to pass $1.
const MONTHLY_BUDGET_USD = 1;
// Far below Lambda's free allowance (1M requests a month), so unusual traffic is noticed early.
const DAILY_INVOCATION_ALARM = 100_000;
const HOURLY_ERROR_ALARM = 50;
// Short share links: the CloudFront domain is written here after the distribution is made and read
// by name at run time, so the functions do not depend on the distribution that points at them.
const SHARE_DOMAIN_PARAMETER_NAME = "/album-wall/share-domain";
const LIVE_APP_URL = "https://bradleygolski.com/album-wall/";
// Short links live on a subdomain of the site. DNS is on Cloudflare (no Route 53 zone, which costs
// a monthly fee), so the certificate is validated by a CNAME added there by hand, and the domain
// is a CNAME (DNS only) to the distribution.
const SHARE_DOMAIN = "albumwall.bradleygolski.com";
// Cover images are served on the same domain, under this path (the app asks for
// https://<domain>/img?url=...&w=...).
const COVER_IMAGE_PATH = "/img";
// A wall's first load asks for about 50 covers at once (the wall and the pool tiles in view), and
// covers not yet cached each need the function. Throttled requests fall back to the third-party
// proxy in the app, and after a few the app stops asking, so the cap has to take a whole wall.
const COVER_IMAGE_CONCURRENCY = 50;
const HOURLY_COVER_THROTTLE_ALARM = 100;

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
        // "authorization" carries a signed-in visitor's Discogs access token.
        allowedHeaders: ["content-type", "authorization"],
      },
    });

    const { sharePage: sharePageFunction, distribution } = this.addShortLinks(discogsProxyFunction);
    const coverImageFunction = this.addCoverImages(distribution);

    this.addCostGuardrails(discogsProxyFunction, sharePageFunction, coverImageFunction);

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

  /**
   * Short share links that show the wall in message previews, inside the always-free allowances:
   * a DynamoDB table with provisioned capacity (on-demand is not free) whose items expire after a
   * year, a function that serves the link page and draws the wall's picture, and CloudFront in
   * front of it (default domain, pictures cached for a year).
   *
   * @param proxy The Discogs proxy, which stores shared walls (`POST /share`).
   * @returns The share page function, for alarms, and the distribution, which also serves covers.
   */
  private addShortLinks(proxy: lambdaNodejs.NodejsFunction) {
    const table = new dynamodb.Table(this, "SharedWallsTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 2,
      writeCapacity: 2,
      timeToLiveAttribute: "expires",
    });

    const sharePage = new lambdaNodejs.NodejsFunction(this, "SharePageFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: "lambda/share-page/index.ts",
      handler: "handler",
      description: "Short share links for album-wall: link page and wall picture.",
      timeout: cdk.Duration.seconds(20),
      memorySize: 1024,
      reservedConcurrentExecutions: 3,
      environment: {
        SHARE_TABLE_NAME: table.tableName,
        SHARE_DOMAIN_PARAMETER_NAME,
        DEFAULT_APP_URL: LIVE_APP_URL,
      },
      bundling: {
        target: "node22",
        // sharp has native parts: install the Linux ARM build whatever machine deploys.
        nodeModules: ["sharp"],
        environment: { npm_config_os: "linux", npm_config_cpu: "arm64", npm_config_libc: "glibc" },
      },
    });
    table.grantReadData(sharePage);
    table.grantWriteData(proxy);
    proxy.addEnvironment("SHARE_TABLE_NAME", table.tableName);
    proxy.addEnvironment("SHARE_DOMAIN_PARAMETER_NAME", SHARE_DOMAIN_PARAMETER_NAME);

    const readShareDomain = new iam.PolicyStatement({
      actions: ["ssm:GetParameter"],
      resources: [
        cdk.Stack.of(this).formatArn({
          service: "ssm",
          resource: "parameter",
          resourceName: SHARE_DOMAIN_PARAMETER_NAME.slice(1),
        }),
      ],
    });
    sharePage.addToRolePolicy(readShareDomain);
    proxy.addToRolePolicy(readShareDomain);

    const origin = new origins.FunctionUrlOrigin(
      sharePage.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })
    );
    const certificate = new acm.Certificate(this, "ShareCertificate", {
      domainName: SHARE_DOMAIN,
      validation: acm.CertificateValidation.fromDns(),
    });
    const distribution = new cloudfront.Distribution(this, "ShareDistribution", {
      comment: "Album Wall short share links",
      domainNames: [SHARE_DOMAIN],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        // The page depends on who asks (a preview fetcher or a person), so it is not cached.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        "/w/*.jpg": {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    new ssm.StringParameter(this, "ShareDomainParameter", {
      parameterName: SHARE_DOMAIN_PARAMETER_NAME,
      stringValue: SHARE_DOMAIN,
      description: "Domain of album-wall short share links.",
    });

    new cdk.CfnOutput(this, "ShareLinkDomain", {
      value: SHARE_DOMAIN,
      description: "Domain of short share links (https://<domain>/w/<id>).",
    });

    new cdk.CfnOutput(this, "ShareDistributionDomain", {
      value: distribution.distributionDomainName,
      description: "CloudFront domain the short link domain points to (CNAME, DNS only).",
    });

    return { sharePage, distribution };
  }

  /**
   * The app's own cover image service, replacing a third-party resizing proxy: a function that
   * fetches covers from an allowlist of hosts and returns square WebP copies at the few sizes the
   * app uses, readable by pages (CORS `*`), behind the short link distribution with each copy
   * cached for a year by address and width. Only CloudFront may call the function (origin access
   * control), and its concurrency is capped.
   *
   * @param distribution The short link distribution, which serves covers under `/img`.
   * @returns The cover image function, for alarms.
   */
  private addCoverImages(distribution: cloudfront.Distribution) {
    const coverImage = new lambdaNodejs.NodejsFunction(this, "CoverImageFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: "lambda/cover-image/index.ts",
      handler: "handler",
      description: "Album-wall cover images: allowed covers resized for the app.",
      timeout: cdk.Duration.seconds(12),
      memorySize: 1024,
      reservedConcurrentExecutions: COVER_IMAGE_CONCURRENCY,
      logGroup: new logs.LogGroup(this, "CoverImageLogs", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      bundling: {
        target: "node22",
        // sharp has native parts: install the Linux ARM build whatever machine deploys.
        nodeModules: ["sharp"],
        environment: { npm_config_os: "linux", npm_config_cpu: "arm64", npm_config_libc: "glibc" },
      },
    });

    const origin = origins.FunctionUrlOrigin.withOriginAccessControl(
      coverImage.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.AWS_IAM })
    );
    // Function URLs need both permissions; the origin grants only lambda:InvokeFunctionUrl.
    coverImage.addPermission("CloudFrontInvoke", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: distribution.distributionArn,
      invokedViaFunctionUrl: true,
    });
    const cachePolicy = new cloudfront.CachePolicy(this, "CoverImageCachePolicy", {
      comment: "Album Wall cover images, by cover address and width",
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList("url", "w"),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      minTtl: cdk.Duration.seconds(0),
      defaultTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(365),
    });
    distribution.addBehavior(COVER_IMAGE_PATH, origin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      cachePolicy,
    });

    new cdk.CfnOutput(this, "CoverImageUrl", {
      value: `https://${SHARE_DOMAIN}${COVER_IMAGE_PATH}`,
      description: "Cover image service (?url=<cover address>&w=64|320|600).",
    });

    return coverImage;
  }

  /**
   * Keeps hosting free, or makes any cost visible at once: a $1 monthly budget for the whole
   * account that emails on the first cent spent and when the month is forecast to pass $1, and
   * alarms on the Discogs proxy for unusual traffic, errors and throttling (its reserved
   * concurrency throttles abuse instead of billing it).
   *
   * @param proxy The Discogs proxy function.
   * @param sharePage The short link page function, watched the same way.
   * @param coverImage The cover image function, watched the same way.
   */
  private addCostGuardrails(
    proxy: lambda.IFunction,
    sharePage: lambda.IFunction,
    coverImage: lambda.IFunction
  ) {
    // A dynamic reference is resolved by CloudFormation during the deploy (with its execution
    // role), unlike a template parameter, which the CDK deploy role would have to read itself.
    const alertEmail = new cdk.CfnDynamicReference(
      cdk.CfnDynamicReferenceService.SSM,
      ALERT_EMAIL_PARAMETER_NAME
    ).toString();

    const alerts = new sns.Topic(this, "AlertsTopic", { displayName: "Album Wall alerts" });
    alerts.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "album-wall-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: MONTHLY_BUDGET_USD, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          // 1% of $1: anything at all is spent.
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 1,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: alertEmail }],
        },
        {
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: alertEmail }],
        },
      ],
    });

    const alarm = (
      id: string,
      metric: cloudwatch.IMetric,
      threshold: number,
      description: string
    ) =>
      new cloudwatch.Alarm(this, id, {
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: description,
      }).addAlarmAction(new cloudwatchActions.SnsAction(alerts));

    alarm(
      "ProxyInvocationsAlarm",
      proxy.metricInvocations({ period: cdk.Duration.days(1), statistic: "Sum" }),
      DAILY_INVOCATION_ALARM,
      "The Discogs proxy ran far more often than usual in a day."
    );
    alarm(
      "ProxyErrorsAlarm",
      proxy.metricErrors({ period: cdk.Duration.hours(1), statistic: "Sum" }),
      HOURLY_ERROR_ALARM,
      "The Discogs proxy failed many times in an hour."
    );
    alarm(
      "ProxyThrottlesAlarm",
      proxy.metricThrottles({ period: cdk.Duration.hours(1), statistic: "Sum" }),
      0,
      "The Discogs proxy hit its concurrency cap, which may mean abuse."
    );
    alarm(
      "SharePageInvocationsAlarm",
      sharePage.metricInvocations({ period: cdk.Duration.days(1), statistic: "Sum" }),
      DAILY_INVOCATION_ALARM,
      "Short share links were opened far more often than usual in a day."
    );
    alarm(
      "SharePageErrorsAlarm",
      sharePage.metricErrors({ period: cdk.Duration.hours(1), statistic: "Sum" }),
      HOURLY_ERROR_ALARM,
      "The short link page failed many times in an hour."
    );
    alarm(
      "SharePageThrottlesAlarm",
      sharePage.metricThrottles({ period: cdk.Duration.hours(1), statistic: "Sum" }),
      0,
      "The short link page hit its concurrency cap, which may mean abuse."
    );
    alarm(
      "CoverImageInvocationsAlarm",
      coverImage.metricInvocations({ period: cdk.Duration.days(1), statistic: "Sum" }),
      DAILY_INVOCATION_ALARM,
      "The cover image service resized far more covers than usual in a day."
    );
    alarm(
      "CoverImageErrorsAlarm",
      coverImage.metricErrors({ period: cdk.Duration.hours(1), statistic: "Sum" }),
      HOURLY_ERROR_ALARM,
      "The cover image service failed many times in an hour."
    );
    alarm(
      "CoverImageThrottlesAlarm",
      coverImage.metricThrottles({ period: cdk.Duration.hours(1), statistic: "Sum" }),
      HOURLY_COVER_THROTTLE_ALARM,
      "The cover image service was throttled many times in an hour, which may mean abuse."
    );
  }
}
