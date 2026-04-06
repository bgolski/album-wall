# Album Wall Infrastructure

This workspace contains the AWS CDK app and Lambda source for the Discogs proxy used by the static frontend.

## What it deploys

- `album-wall` CDK stack in `us-east-1`
- public Lambda Function URL for the Discogs proxy
- IAM permissions for the Lambda to read Discogs credentials from SSM Parameter Store

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

## GitHub Actions deployment

The main deploy workflow uses GitHub OIDC to assume an AWS IAM role and run `cdk deploy` from CI.

Required repository configuration:

- repository variable `AWS_DEPLOY_ROLE_ARN`
  The IAM role ARN GitHub Actions should assume.
- repository secret `DEPLOY_TOKEN`
  Used to push the built static site to `bgolski.github.io`.
- repository secret `DISCOGS_PROXY_URL`
  Used only by PR validation builds, which do not deploy AWS resources.

Required IAM role capabilities:

- trusted for GitHub OIDC from this repository
- permission to deploy the `album-wall` stack in `us-east-1`
- permission to read and update the Lambda, IAM, and CloudFormation resources managed by the CDK stack
- permission to read the SSM parameters referenced by the stack

The deploy workflow resolves the live `DiscogsProxyFunctionUrl` CloudFormation output after `cdk deploy` and feeds that into the static frontend build, so the production site always uses the currently deployed proxy endpoint.
