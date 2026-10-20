import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AlbumWallStack } from "../lib/album-wall-stack";

// Checks that keep the project inside the free allowances and on supported runtimes. They read the
// template the stack would deploy, so a change that could cost money or age out fails here, before
// it is deployed, and has to be looked at on purpose.

const template = (() => {
  // Skip bundling: these tests read the template, and the share page installs sharp when bundled.
  const app = new cdk.App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new AlbumWallStack(app, "guardrails", {
    env: { account: "123456789012", region: "us-east-1" },
  });
  return Template.fromStack(stack);
})().toJSON() as {
  Resources: Record<string, { Type: string; Properties: Record<string, any> }>;
};

const resources = Object.values(template.Resources);
const ofType = (type: string) => resources.filter((resource) => resource.Type === type);

// Everything the stack may contain. A resource type that is not here is new: look at what it costs
// (and whether it has a free allowance) before adding it. Nothing that bills by the hour is here
// (no NAT gateway, load balancer, database instance, WAF or Kinesis stream).
const ALLOWED_TYPES = new Set([
  "AWS::Budgets::Budget",
  "AWS::CDK::Metadata",
  "AWS::CertificateManager::Certificate",
  "AWS::CloudFront::CachePolicy",
  "AWS::CloudFront::Distribution",
  "AWS::CloudFront::Function",
  "AWS::CloudFront::OriginAccessControl",
  "AWS::CloudWatch::Alarm",
  "AWS::DynamoDB::Table",
  "AWS::IAM::Policy",
  "AWS::IAM::Role",
  "AWS::Lambda::Function",
  "AWS::Lambda::Permission",
  "AWS::Lambda::Url",
  "AWS::Logs::LogGroup",
  "AWS::SNS::Subscription",
  "AWS::SNS::Topic",
  "AWS::SSM::Parameter",
]);

// AWS's published deprecation dates for the runtimes the stack may use
// (https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html, checked 2026-10-20).
const RUNTIME_DEPRECATION: Record<string, string> = {
  "nodejs22.x": "2027-04-30",
  "nodejs24.x": "2028-04-30",
};
// How much notice the build wants before a runtime is deprecated.
const NOTICE_DAYS = 365;

// This app's share of the account's free allowances, so other apps can run in the same account:
// CloudWatch includes 10 alarm metrics, DynamoDB 25 read and 25 write units, Lambda 400,000
// GB-seconds of compute a month. The app may use up to a third to two fifths of each.
const MAX_ALARMS = 3;
const MAX_DYNAMODB_READ_UNITS = 6;
const MAX_DYNAMODB_WRITE_UNITS = 6;
const FREE_LAMBDA_GB_SECONDS = 400_000;
const MAX_POSTER_COMPUTE_SHARE = 0.4;
// Lambda keeps at least 10 concurrent runs unreserved; reserved runs beyond about a hundred would
// also let abuse run up the bill.
const MAX_RESERVED_CONCURRENCY_TOTAL = 100;

describe("what the stack may contain", () => {
  it("has only resource types that are free or inside a free allowance", () => {
    const unknown = [...new Set(resources.map((resource) => resource.Type))].filter(
      (type) => !ALLOWED_TYPES.has(type)
    );
    expect(unknown).toEqual([]);
  });
});

describe("Lambda", () => {
  const functions = ofType("AWS::Lambda::Function").filter(
    // The CDK's own helper functions for custom resources, when there are any.
    (fn) =>
      !String(fn.Properties.Handler ?? "").startsWith("index.handler") || fn.Properties.Runtime
  );

  it("caps every function's concurrency, so abuse is throttled instead of billed", () => {
    for (const fn of functions) {
      expect(fn.Properties.ReservedConcurrentExecutions).toBeGreaterThan(0);
    }
    const total = functions.reduce(
      (sum, fn) => sum + Number(fn.Properties.ReservedConcurrentExecutions ?? 0),
      0
    );
    expect(total).toBeLessThanOrEqual(MAX_RESERVED_CONCURRENCY_TOTAL);
  });

  it("runs every function on arm64, which costs less per run", () => {
    for (const fn of functions) expect(fn.Properties.Architectures).toEqual(["arm64"]);
  });

  it("keeps logs for a limited time, so they never pile up", () => {
    const groups = ofType("AWS::Logs::LogGroup");
    expect(groups.length).toBeGreaterThanOrEqual(functions.length);
    for (const group of groups) {
      expect(group.Properties.RetentionInDays).toBeGreaterThan(0);
      expect(group.Properties.RetentionInDays).toBeLessThanOrEqual(30);
    }
  });

  it(`uses only runtimes that stay supported for at least ${NOTICE_DAYS} more days`, () => {
    const limit = Date.now() + NOTICE_DAYS * 24 * 60 * 60 * 1000;
    for (const fn of functions) {
      const runtime = String(fn.Properties.Runtime);
      const deprecated = RUNTIME_DEPRECATION[runtime];
      // An unlisted runtime is a new one: add it with AWS's date for it.
      expect({ runtime, listed: Boolean(deprecated) }).toEqual({ runtime, listed: true });
      expect({ runtime, supportedUntilBeyondNotice: Date.parse(deprecated!) > limit }).toEqual({
        runtime,
        supportedUntilBeyondNotice: true,
      });
    }
  });
});

describe("DynamoDB", () => {
  const tables = ofType("AWS::DynamoDB::Table");

  it("uses provisioned capacity (on-demand has no free allowance), within this app's 6 and 6 of the account's free 25 and 25", () => {
    let reads = 0;
    let writes = 0;
    for (const table of tables) {
      expect(table.Properties.BillingMode).not.toBe("PAY_PER_REQUEST");
      reads += table.Properties.ProvisionedThroughput.ReadCapacityUnits;
      writes += table.Properties.ProvisionedThroughput.WriteCapacityUnits;
    }
    expect(reads).toBeLessThanOrEqual(MAX_DYNAMODB_READ_UNITS);
    expect(writes).toBeLessThanOrEqual(MAX_DYNAMODB_WRITE_UNITS);
  });

  it("has no replicas, streams or backups that bill on their own", () => {
    for (const table of tables) {
      expect(table.Properties.Replicas).toBeUndefined();
      expect(table.Properties.StreamSpecification).toBeUndefined();
      expect(
        table.Properties.PointInTimeRecoverySpecification?.PointInTimeRecoveryEnabled ?? false
      ).toBe(false);
    }
  });
});

describe("CloudFront", () => {
  it("uses the cheapest price class and no logging or paid add-ons", () => {
    for (const distribution of ofType("AWS::CloudFront::Distribution")) {
      const config = distribution.Properties.DistributionConfig;
      expect(config.PriceClass).toBe("PriceClass_100");
      expect(config.WebACLId).toBeUndefined();
      expect(config.Logging).toBeUndefined();
    }
  });
});

describe("CloudWatch", () => {
  it("uses no more than three of the ten free alarm metrics, each on one metric", () => {
    const alarms = ofType("AWS::CloudWatch::Alarm");
    expect(alarms.length).toBeLessThanOrEqual(MAX_ALARMS);
    for (const alarm of alarms) {
      // An alarm on a math expression bills for every metric in it.
      expect(alarm.Properties.Metrics).toBeUndefined();
      expect(alarm.Properties.MetricName).toBeDefined();
    }
  });

  it("makes no custom metrics (ten are free, and other apps may want them)", () => {
    for (const alarm of ofType("AWS::CloudWatch::Alarm")) {
      expect(String(alarm.Properties.Namespace).startsWith("AWS/")).toBe(true);
    }
  });
});

describe("posters", () => {
  const poster = ofType("AWS::Lambda::Function").find(
    (fn) => fn.Properties.Environment?.Variables?.POSTER_DAILY_CAP
  )!;

  it("cannot use more than its share of the month's free compute, however it is called", () => {
    expect(poster).toBeDefined();
    const perDay = Number(poster.Properties.Environment.Variables.POSTER_DAILY_CAP);
    expect(perDay).toBeGreaterThan(0);
    // Every poster of every day taking the whole timeout.
    const worst = perDay * 31 * (poster.Properties.MemorySize / 1024) * poster.Properties.Timeout;
    expect(worst).toBeLessThanOrEqual(FREE_LAMBDA_GB_SECONDS * MAX_POSTER_COMPUTE_SHARE);
  });

  it("is not called by an unlimited number of people at once", () => {
    expect(poster.Properties.ReservedConcurrentExecutions).toBeLessThanOrEqual(3);
  });
});

describe("spending alerts", () => {
  it("keeps the $1 budget with alerts on the first cent and on a forecast over $1", () => {
    const [budget] = ofType("AWS::Budgets::Budget");
    expect(Number(budget!.Properties.Budget.BudgetLimit.Amount)).toBeLessThanOrEqual(1);
    const kinds = (budget!.Properties.NotificationsWithSubscribers as any[]).map(
      (entry) => `${entry.Notification.NotificationType}>${entry.Notification.Threshold}`
    );
    expect(kinds).toEqual(expect.arrayContaining(["ACTUAL>1", "FORECASTED>100"]));
  });
});
