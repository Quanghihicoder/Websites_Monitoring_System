// Test Cloud Formation
const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
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

// Create application stacks for both regions
const betaApplicationStackVirginia = new ApplicationStack(app, 'BetaApplicationStackVirginia', { env: Virginia, stackName: "BetaApplicationStackVirginia", stage: 'beta' });
const prodApplicationStackVirginia = new ApplicationStack(app, 'ProdApplicationStackVirginia', { env: Virginia, stackName: "ProdApplicationStackVirginia", stage: 'prod' });

const betaApplicationStackSydney = new ApplicationStack(app, 'BetaApplicationStackSydney', { env: Sydney, stackName: "BetaApplicationStackSydney", stage: 'beta' });
const prodApplicationStackSydney = new ApplicationStack(app, 'ProdApplicationStackSydney', { env: Sydney, stackName: "ProdApplicationStackSydney", stage: 'prod' });

const stack = new PipelineStack(app, 'PipelineStack', {
  stackName: "PipelineStack",
  betaApplicationStacks: [betaApplicationStackVirginia, betaApplicationStackSydney],
  prodApplicationStacks: [prodApplicationStackVirginia, prodApplicationStackSydney],
  env: Sydney,
});

const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

test('S3 Bucket for pipeline has been created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'webcrawler-pipeline-bucket',
        VersioningConfiguration: {
            Status: 'Enabled'
        }
  })
})

test('The pipeline has been created', () => {
  template.hasResource("AWS::CodePipeline::Pipeline", "");
})
