// Test Cloud Formation
const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require("../lib/application-stack");
const { PipelineStack } = require("../lib/pipeline-stack");
//const { Bucket } = require('aws-cdk-lib/aws-s3');

const Sydney = {
  account: "058264550947",
  region: "ap-southeast-2",
};

const app = new cdk.App();
const betaApplicationStack = new ApplicationStack(app, 'BetaApplicationStack', { env: Sydney, stackName: "BetaApplicationStack", stage: 'beta' });
const prodApplicationStack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });

const stack =  new PipelineStack(app, 'PipelineStack', {
  stackName: "PipelineStack",
  betaApplicationStack: betaApplicationStack,
  prodApplicationStack: prodApplicationStack,
  env: Sydney,
});

const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

test('S3 Bucket for pipeline has been created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'project3-pipeline-bucket',
        VersioningConfiguration: {
            Status: 'Enabled'
        }
  })
})

test('Bucket has correct removal policy', () => {
    template.hasResource('AWS::S3::Bucket', {
      Properties: {
        BucketName: 'project3-webcrawler-bucket'
      },
      DeletionPolicy: 'Delete' // This checks the `DeletionPolicy` for removal
    })
  })

test('SSM Parameter for webcrawler-assets-bucket-location has been created', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: 'webcrawler-assets-bucket-location',
    })
  })

test('The pipeline has been created', () => {
    template.hasResource("AWS::CodePipeline::Pipeline", "");
})

test('S3 Bucket Deployment Configured', () => {
    template.resourceCountIs('Custom::CDKBucketDeployment', 1);
})
