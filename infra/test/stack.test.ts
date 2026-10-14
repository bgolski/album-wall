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
    // Three for the Discogs proxy and three for the short link page.
    stack.resourceCountIs("AWS::CloudWatch::Alarm", 6);
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
        CacheBehaviors: [Match.objectLike({ PathPattern: "/w/*.jpg" })],
      }),
    });
  });

  it("publishes the link domain in Parameter Store for the functions to read by name", () => {
    stack.hasResourceProperties("AWS::SSM::Parameter", { Name: "/album-wall/share-domain" });
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
