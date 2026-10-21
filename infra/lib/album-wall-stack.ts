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
import { Construct } from "constructs";
import { appFunction, SHARP_BUNDLING } from "./appFunction";

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
// The three alarms below watch Lambda for the whole account (one alarm metric each, where an alarm
// for each function would be ten), so the rest of CloudWatch's ten free alarm metrics stay free for
// whatever else runs in this account.
const DAILY_INVOCATION_ALARM = 100_000;
const HOURLY_ERROR_ALARM = 50;
// Throttling is the caps doing their job (scanners and bursts are turned away for free), so it
// alarms only when it is heavy enough to mean abuse or a cap that is too low. A wall's first load
// can be throttled a little on the cover service, which is why this is higher than it once was.
const HOURLY_THROTTLE_ALARM = 100;
// Posters are drawn at print size, which takes real compute, so the number made in a day is capped
// in code. 40 a day, each taking at most 40 seconds of 3 GB, is at worst 35% of the month's free
// compute (400,000 GB-seconds); in practice a poster takes a few seconds.
const POSTER_DAILY_CAP = 40;
const POSTER_PATH = "/poster";
const POSTER_CONCURRENCY = 2;
const POSTER_MEMORY_MB = 3008;
const POSTER_TIMEOUT_SECONDS = 40;
// Room for a message preview (page and picture, sometimes several fetchers at once).
const SHARE_PAGE_CONCURRENCY = 10;
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
const COLLECTION_PATH = "/collection";
// Few at once: each request can measure covers, which is the work this function exists to share.
const COVER_PROFILES_CONCURRENCY = 5;
// A wall's first load asks for about 50 covers at once (the wall and the pool tiles in view), and
// covers not yet cached each need the function. Throttled requests fall back to the third-party
// proxy in the app, and after a few the app stops asking, so the cap has to take a whole wall.
const COVER_IMAGE_CONCURRENCY = 50;

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

    const discogsProxyFunction = appFunction(this, "DiscogsProxy", {
      entry: "lambda/discogs-proxy/index.ts",
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

    const { distribution, table: sharedWalls } = this.addShortLinks(discogsProxyFunction);
    this.addCoverImages(distribution);
    this.addPoster(distribution, sharedWalls);
    this.addCollectionCache(distribution, functionUrl);
    this.addCoverProfiles();

    this.addSavedWalls(discogsProxyFunction);

    this.addCostGuardrails();

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
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: "expires",
    });

    const sharePage = appFunction(this, "SharePage", {
      entry: "lambda/share-page/index.ts",
      description: "Short share links for album-wall: link page and wall picture.",
      timeout: cdk.Duration.seconds(20),
      memorySize: 1024,
      reservedConcurrentExecutions: SHARE_PAGE_CONCURRENCY,
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
    // Anything that is not a short link (scanners trying /wp-login.php, /.env and the like) is
    // answered at the edge, so it never runs the function: robots.txt, or a redirect to the app.
    const edgeOnly = new cloudfront.Function(this, "ShareEdgeFunction", {
      comment: "Album Wall short links: answer everything but /w/ at the edge",
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  if (uri.indexOf("/w/") === 0) return event.request;
  var cache = { value: "public, max-age=86400" };
  if (uri === "/robots.txt") {
    return {
      statusCode: 200,
      statusDescription: "OK",
      headers: { "content-type": { value: "text/plain" }, "cache-control": cache },
      body: { encoding: "text", data: "User-agent: *\\nAllow: /w/\\nDisallow: /\\n" },
    };
  }
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: { location: { value: "${LIVE_APP_URL}" }, "cache-control": cache },
  };
}`),
    });

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
        functionAssociations: [
          { function: edgeOnly, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
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

    return { sharePage, distribution, table };
  }

  /**
   * Public collections, kept by CloudFront for a few minutes (the proxy says how long) so a
   * second load of the same collection is answered at the edge without paging through Discogs
   * again. Only the username is part of the request: a signed-in visitor's own requests go to the
   * proxy directly, and nothing sent here carries their sign-in to the function.
   *
   * @param distribution The distribution on the short link domain.
   * @param proxyUrl The Discogs proxy's function URL.
   */
  private addCollectionCache(distribution: cloudfront.Distribution, proxyUrl: lambda.FunctionUrl) {
    // The function URL answers CORS itself, for the calling site, so the site is part of the key.
    const cachePolicy = new cloudfront.CachePolicy(this, "CollectionCachePolicy", {
      comment: "Album Wall public collections, by username and calling site",
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList("username"),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Origin"),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      minTtl: cdk.Duration.seconds(0),
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.minutes(10),
    });
    distribution.addBehavior(COLLECTION_PATH, new origins.FunctionUrlOrigin(proxyUrl), {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      cachePolicy,
    });

    new cdk.CfnOutput(this, "CollectionCacheUrl", {
      value: `https://${SHARE_DOMAIN}${COLLECTION_PATH}`,
      description: "Cached public collections (?username=<name>); the app's anonymous loads.",
    });
  }

  /**
   * Cover colors measured once for everyone: a table of cover profiles (provisioned capacity
   * inside the always-free allowance, with a time-to-live that expires profiles a year after they
   * were measured) and a function that answers a batch of cover addresses from it, measuring a
   * few that are missing the way the browser would. Only the function writes, and the addresses
   * it will fetch are the same allowlist as the cover image service.
   *
   * @returns The function, for alarms.
   */
  private addCoverProfiles() {
    const table = new dynamodb.Table(this, "CoverProfilesTable", {
      partitionKey: { name: "url", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 3,
      writeCapacity: 3,
      timeToLiveAttribute: "ttl",
      // Everything in it can be measured again.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const profiles = appFunction(this, "CoverProfiles", {
      entry: "lambda/cover-profiles/index.ts",
      description: "Album-wall cover colors: kept profiles, and a few measured on demand.",
      timeout: cdk.Duration.seconds(25),
      memorySize: 1024,
      reservedConcurrentExecutions: COVER_PROFILES_CONCURRENCY,
      environment: { PROFILE_TABLE_NAME: table.tableName },
      bundling: SHARP_BUNDLING,
    });
    table.grantReadWriteData(profiles);
    const url = profiles.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ALLOWED_FRONTEND_ORIGINS,
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["content-type"],
      },
    });
    new cdk.CfnOutput(this, "CoverProfilesUrl", {
      value: url.url,
      description: "Cover color service (POST {urls: [...]}), used by Sort by Color.",
    });
    return profiles;
  }

  /**
   * Posters: the wall drawn at print size (18 x 24 or 24 x 36 inches at 300 dots per inch), which
   * a phone cannot draw, so it comes out the same whichever device asked. A function with capped
   * concurrency draws it and streams the picture back (a large poster is tens of megabytes, more
   * than a plain response may hold). Each poster takes real compute, so the day's total is capped
   * in the function by a counter kept in the short links table, under keys only this function may
   * write: that keeps the month inside the free compute allowance however it is called. Served on
   * the short link domain under `/poster`.
   *
   * @param distribution The short link distribution.
   * @param table The short links table, whose items expire by themselves.
   * @returns The poster function.
   */
  private addPoster(distribution: cloudfront.Distribution, table: dynamodb.Table) {
    const poster = appFunction(this, "Poster", {
      entry: "lambda/poster/index.ts",
      description: "Album-wall posters: the wall drawn at print size, a few a day.",
      timeout: cdk.Duration.seconds(POSTER_TIMEOUT_SECONDS),
      memorySize: POSTER_MEMORY_MB,
      reservedConcurrentExecutions: POSTER_CONCURRENCY,
      environment: {
        SHARE_TABLE_NAME: table.tableName,
        POSTER_DAILY_CAP: String(POSTER_DAILY_CAP),
      },
      bundling: SHARP_BUNDLING,
    });
    // Only the day's counter, and only to add to it.
    poster.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:UpdateItem"],
        resources: [table.tableArn],
        conditions: {
          "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["poster-cap:*"] },
        },
      })
    );

    const url = poster.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });
    distribution.addBehavior(
      POSTER_PATH,
      new origins.FunctionUrlOrigin(url, { readTimeout: cdk.Duration.seconds(60) }),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      }
    );

    new cdk.CfnOutput(this, "PosterPath", {
      value: `https://${SHARE_DOMAIN}${POSTER_PATH}`,
      description: "Poster service (POST {size, background, rows, columns, covers}).",
    });
    return poster;
  }

  /**
   * Signed-in visitors' saved layouts and wall history, so they load on any device: one item per
   * Discogs account, collection and kind, in a table with provisioned capacity inside the
   * always-free allowance (on-demand is not free). Kept until the visitor deletes them.
   *
   * @param proxy The Discogs proxy, which checks the sign-in and reads and writes the items.
   */
  private addSavedWalls(proxy: lambdaNodejs.NodejsFunction) {
    const table = new dynamodb.Table(this, "SavedWallsTable", {
      partitionKey: { name: "user", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "item", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    });
    table.grantReadWriteData(proxy);
    proxy.addEnvironment("SAVED_TABLE_NAME", table.tableName);
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
    const coverImage = appFunction(this, "CoverImage", {
      entry: "lambda/cover-image/index.ts",
      description: "Album-wall cover images: allowed covers resized for the app.",
      timeout: cdk.Duration.seconds(12),
      memorySize: 1024,
      reservedConcurrentExecutions: COVER_IMAGE_CONCURRENCY,
      bundling: SHARP_BUNDLING,
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
   * three alarms on Lambda for the whole account, for unusual traffic, errors and throttling (each
   * function's reserved concurrency throttles abuse instead of billing it). Three alarms is all
   * this app uses of CloudWatch's ten free ones.
   */
  private addCostGuardrails() {
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

    // Lambda's own account-wide totals (no function named), so one alarm each covers every function
    // here and any other app in the account.
    const lambdaTotal = (metricName: string, period: cdk.Duration) =>
      new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName,
        statistic: "Sum",
        period,
      });
    alarm(
      "LambdaInvocationsAlarm",
      lambdaTotal("Invocations", cdk.Duration.days(1)),
      DAILY_INVOCATION_ALARM,
      "Lambda ran far more often than usual in a day."
    );
    alarm(
      "LambdaErrorsAlarm",
      lambdaTotal("Errors", cdk.Duration.hours(1)),
      HOURLY_ERROR_ALARM,
      "Lambda functions failed many times in an hour."
    );
    alarm(
      "LambdaThrottlesAlarm",
      lambdaTotal("Throttles", cdk.Duration.hours(1)),
      HOURLY_THROTTLE_ALARM,
      "Lambda throttled many runs in an hour, which may mean abuse."
    );
  }
}
