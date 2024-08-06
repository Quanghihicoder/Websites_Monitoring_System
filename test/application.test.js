// Test Cloud Formation 

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require('../lib/application-stack');
const { Metric, Alarm } = require('aws-cdk-lib/aws-cloudwatch');

const Sydney = {
    account: "058264550947",
    region: "ap-southeast-2",
};

const url ="example.url";


const app = new cdk.App();
const stack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });
const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

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

test('Alarms for Latency have correct properties', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {       
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        ActionsEnabled: true,
        Period: 300, // 5 minutes in seconds
        TreatMissingData: 'ignore'
      })
})

test('There are 11 alarms, includes 3 Latency, 3 Availability, 3 BrokenLinks', () => {
    template.hasResource('AWS::CloudWatch::Alarm',"");
    template.resourceCountIs("AWS::CloudWatch::Alarm", 12);

    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageExecutionTime-ap-southeast-2-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageAvailability-ap-southeast-2-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageBrokenLinks-ap-southeast-2-prod"}, 3)
})

test('SNS has been created and has 3 subscriptions', () => {
    template.hasResource("AWS::SNS::Topic", "");    
    template.resourceCountIs("AWS::SNS::Subscription", 3);
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
                'DEPLOYMENT_STOP_ON_ALARM']
        }
    })
})

const urls = ['https://www.swinburne.edu.au']; 

test('Alarms for Latency have correct properties', () => {    
    urls.forEach((url, i) => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `webcrawler-alarm-${url}-latency-ap-southeast-2-prod`,
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 800, // Use the actual value of acceptableLatency
        Period: 300, // 5 minutes in seconds
        AlarmDescription: `Alarm for ${url} Latency Metric`,})
    })
  })

  test('Alarms for Availability have correct properties', () => {   
    urls.forEach((url, i) => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `webcrawler-alarm-${url}-availability-ap-southeast-2-prod`,
        ComparisonOperator: 'LessThanThreshold',
        ActionsEnabled: true,
        Period: 300, // 5 minutes in seconds
        AlarmDescription: `Alarm for ${url} Availability Metric`,})
    })
  })

  test('Alarms for Broken Links have correct properties', () => {
      urls.forEach((url, i) => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `webcrawler-alarm-${url}-broken-links-ap-southeast-2-prod`,
        ComparisonOperator: 'GreaterThanThreshold',
        Period: 300, // 5 minutes in seconds  
        AlarmDescription: `Alarm for ${url} BrokenLinks Metric`,})
    })
  })

  test('Alarm for Max Latency has correct properties', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'webcrawler-alarm-max-latency-ap-southeast-2-prod',
      ComparisonOperator: 'GreaterThanThreshold',
      Threshold: 800, // Use the actual value of acceptableLatency
      AlarmDescription: 'Alarm for Max Latency Metric'
    })
  })

  test('Alarm for Min Availability has correct properties', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'webcrawler-alarm-min-reachable-ap-southeast-2-prod',
      ComparisonOperator: 'LessThanThreshold',
      AlarmDescription: 'Alarm for Min Availability Metric'
    })
  })

// ======================================================== Integration / Snapshot Test =====================================================
// Might need to run "npm run test --updateSnapshot"
//it('Matches the snapshot.', () => {
//    expect(template.toJSON()).toMatchSnapshot();
//})
    
