// Test AWS infrastructure

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require("../lib/application-stack");
const { PipelineStack } = require("../lib/pipeline-stack");

const Sydney = {
  account: "058264550947",
  region: "ap-southeast-2",
};

const app = new cdk.App();

const devApplicationStack = new ApplicationStack(app, 'devApplicationStack', { env: Sydney, stackName: "devApplicationStack", stage: 'dev' });
const prodApplicationStack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });

const stack =  new PipelineStack(app, 'PipelineStack', {
  stackName: "PipelineStack",
  devApplicationStack: devApplicationStack,
  prodApplicationStack: prodApplicationStack,
  env: Sydney,
});

const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

test('Bucket for webcrawler has been created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: "project3-webcrawler-bucket"
    })
})


test('The pipeline has been created', () => {
    template.hasResource("AWS::CodePipeline::Pipeline", "");
})