#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { ApplicationStack } = require("../lib/application-stack");
const { PipelineStack } = require("../lib/pipeline-stack");

const Virginia = {
  account: "058264550947",
  region: "us-east-1",
};

const Sydney = {
  account: "058264550947",
  region: "ap-southeast-2",
};

const app = new cdk.App();

const devApplicationStack = new ApplicationStack(app, 'devApplicationStack', { env: Sydney, stackName: "devApplicationStack", stage: 'dev' });
const prodApplicationStack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });

new PipelineStack(app, 'PipelineStack', {
  stackName: "PipelineStack",
  devApplicationStack: devApplicationStack,
  prodApplicationStack: prodApplicationStack,
  env: Sydney,
});