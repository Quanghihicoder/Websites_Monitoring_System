// Test Cloud Formation Application Stack
const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require('../lib/application-stack');
const { Metric, Alarm } = require('aws-cdk-lib/aws-cloudwatch');

// ======================================================== Fake Creation =====================================================
const Sydney = {
    account: "058264550947",
    region: "ap-southeast-2",
};

const app = new cdk.App();
const stack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });
const template = Template.fromStack(stack);

const url = "example.com"

// ======================================================== Unit/Assertions Test =====================================================

test('Web Crawler has been created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: "webcrawler.handler"
    })
})

test('IAM Role for Web Crawler is created', () => {
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

test('Web Crawler runs every 2 minutes', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: "rate(2 minutes)"
    })
})

test('Alarms for Latency have correct properties', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {       
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        ActionsEnabled: true,
        Period: 120, // 2 minutes
        TreatMissingData: 'ignore'
      })
})

test('There are 13 alarms, includes 3 Latency, 3 Availability, 3 BrokenLinks, 1 Min Availability, 1 Max Latency, 2 Operational Web Crawler', () => {
    template.resourceCountIs("AWS::CloudWatch::Alarm", 13);

    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageExecutionTime-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageAvailability-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageBrokenLinks-prod"}, 3)
})

test('SNS has been created and has 3 subscriptions', () => {
    template.hasResource("AWS::SNS::Topic", "");    
    template.resourceCountIs("AWS::SNS::Subscription", 3);
})

test('DynamoDB Table is created with correct properties', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'webcrawler-alarm-dynamodb-prod',
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

test('Alarm Writer is created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'alarmwriter-prod',
        Runtime: 'nodejs20.x',
        Handler: 'alarmwriter.handler'       
    })
})

test('IAM role for alarm writer lambda function is created', () => {
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
    })
})

test('Lambda Alias for Web Crawler is created', () => {
    template.hasResource('AWS::Lambda::Alias',"");
    template.hasResourceProperties('AWS::Lambda::Alias',{
        Name: 'webcrawler-alias-prod'
    })
})

test('Lambda Deployment Group for Web Crawler is created', () => {
    template.hasResource('AWS::CodeDeploy::DeploymentGroup',"");
    template.hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
        AutoRollbackConfiguration: {
            Events: [
                'DEPLOYMENT_FAILURE',
                'DEPLOYMENT_STOP_ON_REQUEST',
                'DEPLOYMENT_STOP_ON_ALARM']
        }
    })
})

// ======================================================== Integration / Snapshot Test =====================================================
// Might need to run "npm run test --updateSnapshot"
it('Matches the snapshot.', () => {
   expect(template.toJSON()).toMatchSnapshot();
})
    
