# Album Wall Infrastructure

This workspace contains the AWS CDK app and Lambda sources for the static frontend: the Discogs proxy, short share links, the cover image service, saved walls, the collection cache and the cover color service.

## What it deploys

- `album-wall` CDK stack in `us-east-1`
- public Lambda Function URL for the Discogs proxy, which also runs "Sign in with Discogs" (see below)
- IAM permissions for the Lambda to read Discogs credentials from SSM Parameter Store
- short share links: a DynamoDB table, the link page function and a CloudFront distribution on `albumwall.bradleygolski.com`
- cover images: a function that resizes allowed covers (Discogs, Cover Art Archive) to 64, 320 or 600 pixel WebP, served by the same distribution at `/img?url=<cover>&w=<width>` and cached for a year
- saved walls: a DynamoDB table (provisioned 1 read and 1 write unit) where the proxy keeps a signed-in visitor's saved layouts and wall history under their Discogs account
- collection cache: the same distribution serves `/collection?username=<name>` from the proxy and keeps a public collection for five minutes, keyed by username and calling site; the proxy marks errors and signed-in answers as not cacheable, and signed-in requests never go through it
- cover colors: a DynamoDB table (provisioned 3 read and 3 write units, entries expire after a year) and a function that answers `POST {urls: [...]}` with the profiles kept for up to 100 allowed cover addresses, measuring a few missing ones itself with the app's own `coverProfile` code
- a poster function that draws the wall at print size (18 x 24 or 24 x 36 inches at 300 dots per inch) and streams the JPEG back from `/poster` on the same domain; the day's total is capped at 40 by a counter in the short links table
- a $1 monthly budget and three CloudWatch alarms on Lambda for the whole account (invocations, errors and throttles; one alarm metric each)

## Free-tier headroom for other apps

This account is shared, so the app keeps to a share of each always-free allowance and the infrastructure tests (`test/guardrails.test.ts`) fail when a change goes past it.

| Free allowance                | Included                              | This app uses                                                                                                              |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CloudWatch alarm metrics      | 10                                    | 3 (Lambda invocations, errors and throttles for the whole account, so they also watch other apps)                          |
| DynamoDB provisioned capacity | 25 read and 25 write units            | 5 and 5                                                                                                                    |
| Lambda compute                | 400,000 GB-seconds a month            | posters at worst 35% (40 a day, each at most 40 seconds of 3 GB); everything else is far smaller and capped by concurrency |
| Lambda requests               | 1,000,000 a month                     | far below; the daily alarm is at 100,000                                                                                   |
| CloudFront                    | 1 TB out, 10,000,000 requests a month | covers cached for a year; posters are streamed and uncached (a few MB each)                                                |
| Budgets                       | 2                                     | 1                                                                                                                          |

Things to know when adding another app to the account:

- The three alarms are account-wide, so another app's Lambda traffic counts toward them. Do not add per-function alarms for it: each alarm metric over ten is billed, and an alarm on a math expression bills for every metric in it. Custom metrics are also limited to ten free.
- Reserved concurrency (72 across this app's functions) comes out of the account's Lambda concurrency pool; check the account's quota in Service Quotas if another app needs a lot.
- Posters are the one feature with a real compute cost. The cap is in the function (`POSTER_DAILY_CAP`), not only in an alarm, so it holds even if nobody is watching.

## Local commands

- `npm ci`
- `npm run build`
- `npx cdk synth`
- `npx cdk deploy --require-approval never`

## Required AWS parameters

Create these SSM Parameter Store `SecureString` values in `us-east-1` before deploying:

- `/album-wall/discogs-token`
- `/album-wall/discogs-consumer-key`
- `/album-wall/discogs-consumer-secret`

`/album-wall/discogs-token` is the shared token used for visitors who have not signed in. The consumer key and secret belong to the Discogs developer app used for signing in; its callback is the app's address, and the proxy also sends the page's own address as `oauth_callback`, so the home preview works with the same app.

## Sign in with Discogs

Discogs only shows a private collection, or folders other than "All", to its owner, so the proxy runs Discogs' OAuth 1.0a sign-in (PLAINTEXT signatures over HTTPS):

- `POST /oauth/start` with `{ callback }` asks Discogs for a request token and answers with the Discogs approval page, the request token and its secret. The callback must be one of the app's own pages (same list of origins as short links, no query or fragment), so the proxy cannot send anyone elsewhere.
- `POST /oauth/finish` with `{ token, secret, verifier }` trades the approved request token for the visitor's access token and secret, and looks up their username (`/oauth/identity`).
- Collection requests (`GET /?username=&folder=`) and `GET /folders?username=` carry `Authorization: Bearer <token>:<secret>`; the proxy signs the Discogs request with the consumer secret and that token. Without the header nothing changes: the shared token is used and only folder 0 can be loaded.

Nothing is stored server-side. The visitor's access token and secret are kept in their browser's local storage until they sign out. The request token's secret, needed once between start and finish, is handed back to the browser, which holds it in session storage for that tab: it is only useful together with the consumer secret (which never leaves the proxy) and a verifier that Discogs gives only to the visitor who approved, it expires once used, and the long-lived access secret ends up in the same browser anyway, so encrypting or signing it on the server would add a key to manage without protecting anything more. Logs never include tokens or secrets: errors are logged by kind and the proxy's own message only.

## GitHub Actions deployment

The main deploy workflow uses GitHub OIDC to assume an AWS IAM role and run `cdk deploy` from CI.

Required repository configuration:

- repository variable `AWS_DEPLOY_ROLE_ARN`
  The IAM role ARN GitHub Actions should assume.
- repository secret `DISCOGS_PROXY_URL`
  Used only by PR validation builds, which do not deploy AWS resources.

Required IAM role capabilities:

- trusted for GitHub OIDC from this repository
- permission to deploy the `album-wall` stack in `us-east-1`
- permission to read and update the Lambda, IAM, and CloudFormation resources managed by the CDK stack
- permission to read the SSM parameters referenced by the stack

The deploy workflow resolves the live `DiscogsProxyFunctionUrl` and `CoverProfilesUrl` CloudFormation outputs after `cdk deploy` and feeds them into the static frontend build, so the production site always uses the currently deployed endpoints.
