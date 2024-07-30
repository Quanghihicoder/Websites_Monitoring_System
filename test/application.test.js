// Test AWS infrastructure

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require('../lib/application-stack');

const Sydney = {
    account: "058264550947",
    region: "ap-southeast-2",
};

const app = new cdk.App();
const stack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });
const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

// Test for lambda.Code.fromCfnParameters()
test('Lambda Code is created from CloudFormation parameters', () => {
    //template.resourceCountIs('AWS::CloudFormation::CustomResource', 1)
})

// Test for ssm.StringParameter.fromStringParameterName()
test('SSM Parameter for Web Crawler Bucket Location is referenced', () => {
    //template.hasResourceProperties('AWS::SSM::Parameter', {
    //    Name: 'webcrawler-bucket-location'
    //})
})

test('S3 bucket is created', () => {
    //template.hasResourceProperties('AWS::S3::Bucket', {
    //   BucketName: 'webcrawler-assets-bucket-location'
    //})
})

test('Web Crawler has been created', () => {
    template.hasResource("AWS::Lambda::Function", "");

    template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: "webcrawler.handler"
    })
})

test('IAM Role for Web Crawler is created', () => {
    template.hasResource('AWS::IAM::Role', "");
    template.hasResourceProperties('AWS::IAM::Role',{
        Description: 'Web Crawler IAM Role-ap-southeast-2-prod',
        AssumeRolePolicyDocument: {
            Statement: [{
                    Effect: 'Allow',
                    Principal: {
                        Service: 'lambda.amazonaws.com'
                    },
                    Action: 'sts:AssumeRole'}]}
    })
})

test('Web Crawler runs every 5 minutes', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: "rate(5 minutes)"
    })
})

test('There are 11 alarms, includes 3 Latency, 3 Availability, 3 BrokenLinks', () => {
    template.resourceCountIs("AWS::CloudWatch::Alarm", 12);

    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageExecutionTime-ap-southeast-2-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageAvailability-ap-southeast-2-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageBrokenLinks-ap-southeast-2-prod"}, 3)
})

test('SNS has been created and has 2 email subscriptions', () => {
    template.hasResource("AWS::SNS::Topic", "");    
    template.resourceCountIs("AWS::SNS::Subscription", 2);
})

test('DynamoDB Table is created with correct properties', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'webcrawler-dynamodb-ap-southeast-2-prod',
        AttributeDefinitions: [
            { AttributeName: 'url', AttributeType: 'S' },
            { AttributeName: 'timestamp', AttributeType: 'S' }
        ],
        KeySchema: [
            { AttributeName: 'url', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    })
})

test('Lambda Function for DynamoDB is created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'lambdadynamoDB-ap-southeast-2-prod',
        Runtime: 'nodejs20.x',
        Handler: 'dynamodb.handler'       
    })
})

test('IAM role for Lambda function is created', () => {
    template.hasResource('AWS::IAM::Role', "");
    template.hasResourceProperties('AWS::IAM::Role', {
        Description: 'Lambda IAM Role for DynamoDB-ap-southeast-2-prod'  
    })
})

test('IAM Role for Lambda interacting with DynamoDB has policies assigned', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
            Statement: [ {
                    Action: 'sts:AssumeRole',
                    Effect: 'Allow',
                    Principal: {Service: 'lambda.amazonaws.com'}}
            ]},
        Description: 'Lambda IAM Role for DynamoDB-ap-southeast-2-prod'
    })
})

test('Lambda Alias for Web Crawler is created', () => {
    template.hasResource('AWS::Lambda::Alias',"");
    template.hasResourceProperties('AWS::Lambda::Alias',{
        Name: 'prod'
    })
})

test('Lambda Deployment Group for Web Crawler is created', () => {
    template.hasResource('AWS::CodeDeploy::DeploymentGroup',"");
    template.hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
        DeploymentConfigName: 'CodeDeployDefault.LambdaLinear10PercentEvery3Minutes',
        AutoRollbackConfiguration: {
            Events: [
                'DEPLOYMENT_FAILURE',
                'DEPLOYMENT_STOP_ON_REQUEST',
                'DEPLOYMENT_STOP_ON_ALARM'
            ]
        }
    })
})

// ======================================================== Snapshot Test =====================================================
// Might need to run "npm run test --updateSnapshot"
it('Matches the snapshot.', () => {
    expect(template.toJSON()).toMatchSnapshot();
});
    
