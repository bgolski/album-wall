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
    // One each for Lambda's account-wide invocations, errors and throttles: three of the ten alarm
    // metrics CloudWatch includes for free, so the rest stay free for other apps in the account.
    stack.resourceCountIs("AWS::CloudWatch::Alarm", 3);
    for (const metric of ["Invocations", "Errors", "Throttles"]) {
      stack.hasResourceProperties("AWS::CloudWatch::Alarm", {
        Namespace: "AWS/Lambda",
        MetricName: metric,
        AlarmActions: Match.anyValue(),
      });
    }
    // Account-wide: no function is named, so one alarm covers every function.
    for (const alarm of Object.values(stack.findResources("AWS::CloudWatch::Alarm"))) {
      expect((alarm.Properties as { Dimensions?: unknown }).Dimensions).toBeUndefined();
    }
  });

  it("lets the app send a signed-in visitor's token to the proxy, from its own sites only", () => {
    stack.hasResourceProperties("AWS::Lambda::Url", {
      AuthType: "NONE",
      Cors: Match.objectLike({
        AllowHeaders: ["content-type", "authorization"],
        AllowOrigins: Match.arrayWith(["https://bradleygolski.com"]),
      }),
    });
  });

  it("lets the proxy read the Discogs consumer key and secret for signing in", () => {
    const policies = JSON.stringify(stack.findResources("AWS::IAM::Policy"));
    expect(policies).toContain("discogs-consumer-key");
    expect(policies).toContain("discogs-consumer-secret");
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
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
      TimeToLiveSpecification: { AttributeName: "expires", Enabled: true },
    });
  });

  it("serves links from an ARM function with capped concurrency behind CloudFront", () => {
    stack.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: ["arm64"],
      ReservedConcurrentExecutions: 10,
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
      ReservedConcurrentExecutions: 50,
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

describe("shared cover colors", () => {
  const stack = template();

  it("keeps profiles in a free provisioned table that expires them", () => {
    stack.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{ AttributeName: "url", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 3, WriteCapacityUnits: 3 },
      TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
    });
  });

  it("answers from a capped function that only the app's own sites may call", () => {
    stack.hasResourceProperties("AWS::Lambda::Function", {
      Description: Match.stringLikeRegexp("cover colors"),
      ReservedConcurrentExecutions: 5,
      Architectures: ["arm64"],
      Environment: { Variables: Match.objectLike({ PROFILE_TABLE_NAME: Match.anyValue() }) },
    });
    stack.hasResourceProperties("AWS::Lambda::Url", {
      AuthType: "NONE",
      Cors: Match.objectLike({
        AllowMethods: ["POST"],
        AllowHeaders: ["content-type"],
        AllowOrigins: Match.arrayWith(["https://bradleygolski.com"]),
      }),
    });
  });
});

describe("cached public collections", () => {
  const stack = template();

  it("serves /collection on the short link distribution, cached by username and calling site", () => {
    stack.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: "/collection", AllowedMethods: ["GET", "HEAD"] }),
        ]),
      }),
    });
    stack.hasResourceProperties("AWS::CloudFront::CachePolicy", {
      CachePolicyConfig: Match.objectLike({
        DefaultTTL: 0,
        MaxTTL: 600,
        ParametersInCacheKeyAndForwardedToOrigin: Match.objectLike({
          QueryStringsConfig: { QueryStringBehavior: "whitelist", QueryStrings: ["username"] },
          HeadersConfig: { HeaderBehavior: "whitelist", Headers: ["Origin"] },
          CookiesConfig: { CookieBehavior: "none" },
        }),
      }),
    });
    stack.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });
});

describe("saved walls and edge answers", () => {
  const stack = template();

  it("keeps saved walls in a free provisioned table keyed by account and item", () => {
    stack.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [
        { AttributeName: "user", KeyType: "HASH" },
        { AttributeName: "item", KeyType: "RANGE" },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
    });
    stack.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({ SAVED_TABLE_NAME: Match.anyValue() }) },
    });
  });

  it("answers everything but short links at the edge, so scanners never run the function", () => {
    stack.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionCode: Match.stringLikeRegexp("/w/"),
    });
    stack.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: [Match.objectLike({ EventType: "viewer-request" })],
        }),
      }),
    });
  });

  it("alarms on throttling only when it is heavy", () => {
    const alarms = Object.values(stack.findResources("AWS::CloudWatch::Alarm")).map(
      (alarm) => alarm.Properties as { MetricName: string; Threshold: number }
    );
    for (const alarm of alarms.filter((a) => a.MetricName === "Throttles")) {
      expect(alarm.Threshold).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("posters", () => {
  const stack = template();

  it("draws them in a streaming ARM function with capped concurrency and a daily cap", () => {
    stack.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: ["arm64"],
      MemorySize: 3008,
      Timeout: 40,
      ReservedConcurrentExecutions: 2,
      Environment: {
        Variables: Match.objectLike({ POSTER_DAILY_CAP: "40", SHARE_TABLE_NAME: Match.anyValue() }),
      },
    });
    stack.hasResourceProperties("AWS::Lambda::Url", { InvokeMode: "RESPONSE_STREAM" });
  });

  it("serves POST /poster on the short link domain, never cached", () => {
    stack.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "/poster",
            AllowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
            ViewerProtocolPolicy: "https-only",
          }),
        ]),
      }),
    });
  });

  it("lets the function add to the day's counter and nothing else in the table", () => {
    stack.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "dynamodb:UpdateItem",
            Condition: {
              "ForAllValues:StringLike": { "dynamodb:LeadingKeys": ["poster-cap:*"] },
            },
          }),
        ]),
      },
    });
  });
});
