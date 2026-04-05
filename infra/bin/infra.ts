#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AlbumWallStack } from "../lib/album-wall-stack";

const app = new cdk.App();

new AlbumWallStack(app, "album-wall", {
  env: {
    account: "505759575902",
    region: "us-east-1",
  },
});
