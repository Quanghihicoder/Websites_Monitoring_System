// const cdk = require('aws-cdk-lib');
// const { Template } = require('aws-cdk-lib/assertions');
// const Project3 = require('../lib/project3-stack');

// example test. To run these tests, uncomment this file along with the
// example resource in lib/project3-stack.js

const { Template } = require('@aws-cdk/assertions');
const { App } = require('aws-cdk-lib');
const { Project3Stack } = require('../lib/project3-stack');

let app, stack, template;

beforeAll(() => {
    app = new App();
    stack = new Project3Stack(app, 'MyTestStack');
    template = Template.fromStack(stack);
});

test('S3 Bucket Created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'project3-canary-bucket',
    });
});

test('S3 Deployment Configured', () => {
    // Check for the custom resource for S3 deployment
    template.resourceCountIs('Custom::CDKBucketDeployment', 1);
});

test('SQS Queue Created', () => {
//   const app = new cdk.App();
//   // WHEN
//   const stack = new Project3.Project3Stack(app, 'MyTestStack');
//   // THEN
//   const template = Template.fromStack(stack);

//   template.hasResourceProperties('AWS::SQS::Queue', {
//     VisibilityTimeout: 300
//   });
});
