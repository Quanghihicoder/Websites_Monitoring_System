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

const betaApplicationStack = new ApplicationStack(app, 'BetaApplicationStack', { env: Sydney, stackName: "BetaApplicationStack", stage: 'beta' });
const prodApplicationStack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });


// Create application stacks for both regions
// const betaApplicationStackVirginia = new ApplicationStack(app, 'BetaApplicationStackVirginia', { env: Virginia, stackName: "BetaApplicationStackVirginia", stage: 'beta' });
// const prodApplicationStackVirginia = new ApplicationStack(app, 'ProdApplicationStackVirginia', { env: Virginia, stackName: "ProdApplicationStackVirginia", stage: 'prod' });

// const betaApplicationStackSydney = new ApplicationStack(app, 'BetaApplicationStackSydney', { env: Sydney, stackName: "BetaApplicationStackSydney", stage: 'beta' });
// const prodApplicationStackSydney = new ApplicationStack(app, 'ProdApplicationStackSydney', { env: Sydney, stackName: "ProdApplicationStackSydney", stage: 'prod' });

new PipelineStack(app, 'PipelineStack', {
  stackName: "PipelineStack",
  betaApplicationStack: betaApplicationStack,
  prodApplicationStack: prodApplicationStack,
  env: Sydney,
});