import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { AlbumWallStack } from "../lib/album-wall-stack";

function template() {
  // Skip bundling: these tests read the template, and the share page installs sharp when bundled.
  const app = new cdk.App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new AlbumWallStack(app, "test", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  return Template.fromStack(stack);
}

describe("cost guardrails", () => {
  const stack = template();

  it("budgets $1 a month and emails on the first cent and on a forecast over $1", () => {
    stack.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 1, Unit: "USD" },
      }),
      NotificationsWithSubscribers: [
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: "ACTUAL", Threshold: 1 }),
          Subscribers: [Match.objectLike({ SubscriptionType: "EMAIL" })],
        }),
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: "FORECASTED", Threshold: 100 }),
        }),
      ],
    });
  });

  it("reads the alert address from Parameter Store instead of the repository", () => {
    const json = JSON.stringify(stack.toJSON());
    expect(json).toContain("{{resolve:ssm:/album-wall/alert-email}}");
    expect(json).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    stack.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email" });
  });

  it("alarms on unusual traffic, errors and throttling, notifying the alerts topic", () => {
    // Three each for the Discogs proxy, the short link page and the cover image service; staying
    // within the ten alarms CloudWatch includes for free.
    stack.resourceCountIs("AWS::CloudWatch::Alarm", 9);
    for (const metric of ["Invocations", "Errors", "Throttles"]) {
      stack.hasResourceProperties("AWS::CloudWatch::Alarm", {
        MetricName: metric,
        AlarmActions: Match.anyValue(),
      });
    }
  });

  it("caps the proxy's concurrency so abuse is throttled rather than billed", () => {
    stack.hasResourceProperties("AWS::Lambda::Function", { ReservedConcurrentExecutions: 5 });
  });

  it("tags resources with the application", () => {
    stack.hasResourceProperties("AWS::SNS::Topic", {
      Tags: Match.arrayWith([{ Key: "application", Value: "album-wall" }]),
    });
  });
});

describe("short share links", () => {
  const stack = template();

  it("keeps shared walls in a table that stays free and forgets them after a year", () => {
    stack.hasResourceProperties("AWS::DynamoDB::Table", {
      ProvisionedThroughput: { ReadCapacityUnits: 2, WriteCapacityUnits: 2 },
      TimeToLiveSpecification: { AttributeName: "expires", Enabled: true },
    });
  });

  it("serves links from an ARM function with capped concurrency behind CloudFront", () => {
    stack.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: ["arm64"],
      ReservedConcurrentExecutions: 3,
      MemorySize: 1024,
    });
    stack.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        PriceClass: "PriceClass_100",
        CacheBehaviors: Match.arrayWith([Match.objectLike({ PathPattern: "/w/*.jpg" })]),
      }),
    });
  });

  it("serves links on albumwall.bradleygolski.com with a DNS-validated certificate", () => {
    stack.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "albumwall.bradleygolski.com",
      ValidationMethod: "DNS",
    });
    stack.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ Aliases: ["albumwall.bradleygolski.com"] }),
    });
    stack.resourceCountIs("AWS::Route53::HostedZone", 0);
  });

  it("publishes the link domain in Parameter Store for the functions to read by name", () => {
    stack.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/album-wall/share-domain",
      Value: "albumwall.bradleygolski.com",
    });
    const json = JSON.stringify(stack.toJSON());
    expect(json).toContain("parameter/album-wall/share-domain");
  });

  it("lets the proxy store walls and the page read them, and nothing more", () => {
    stack.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Action: Match.arrayWith(["dynamodb:PutItem"]) }),
        ]),
      }),
    });
    const policies = JSON.stringify(stack.findResources("AWS::IAM::Policy"));
    expect(policies).not.toContain("dynamodb:DeleteTable");
  });
});

describe("cover images", () => {
  const stack = template();

  it("resizes covers in an ARM function with capped concurrency and short-lived logs", () => {
    stack.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: ["arm64"],
      ReservedConcurrentExecutions: 10,
      Timeout: 12,
      Description: Match.stringLikeRegexp("cover images"),
    });
    stack.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 14 });
  });

  it("lets only CloudFront call the function", () => {
    stack.hasResourceProperties("AWS::Lambda::Url", { AuthType: "AWS_IAM" });
    stack.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
      OriginAccessControlConfig: Match.objectLike({ OriginAccessControlOriginType: "lambda" }),
    });
    stack.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunctionUrl",
      Principal: "cloudfront.amazonaws.com",
    });
    stack.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunction",
      Principal: "cloudfront.amazonaws.com",
      InvokedViaFunctionUrl: true,
    });
  });

  it("serves /img on the short link distribution, cached by cover address and width", () => {
    stack.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["albumwall.bradleygolski.com"],
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: "/img", AllowedMethods: ["GET", "HEAD"] }),
        ]),
      }),
    });
    stack.hasResourceProperties("AWS::CloudFront::CachePolicy", {
      CachePolicyConfig: Match.objectLike({
        MaxTTL: 31536000,
        ParametersInCacheKeyAndForwardedToOrigin: Match.objectLike({
          QueryStringsConfig: { QueryStringBehavior: "whitelist", QueryStrings: ["url", "w"] },
          HeadersConfig: { HeaderBehavior: "none" },
          CookiesConfig: { CookieBehavior: "none" },
        }),
      }),
    });
    stack.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });
});
