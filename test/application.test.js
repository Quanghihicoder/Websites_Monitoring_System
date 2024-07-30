// Test AWS infrastructure

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require('../lib/application-stack');
const { Metric, Alarm } = require('aws-cdk-lib/aws-cloudwatch');
//const AWS = require('aws-sdk-mock');
//const { handler } = require('../src/lambdas/dynamodb');
//const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

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
                'DEPLOYMENT_STOP_ON_ALARM']
        }
    })
})

const urls = ['https://www.swinburne.edu.au', 'https://www.youtube.com','https://www.apple.com']; 

test('Alarms for Latency have correct properties', () => {    
    urls.forEach((url, i) => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `webcrawler-alarm-${url}-latency-ap-southeast-2-prod`,
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 3000, // Use the actual value of acceptableLatency
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
      Threshold: 3000, // Use the actual value of acceptableLatency
      AlarmDescription: 'Alarm for Max Latency Metric'
    })
  })

  test('Alarm for Min Availability has correct properties', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'webcrawler-alarm-min-reachable-ap-southeast-2-prod',
      ComparisonOperator: 'LessThanThreshold',
      Threshold: urls.length, // Use the actual number of URLs
      AlarmDescription: 'Alarm for Min Availability Metric'
    })
  })

// ======================================================== Snapshot Test =====================================================
// Might need to run "npm run test --updateSnapshot"
it('Matches the snapshot.', () => {
    expect(template.toJSON()).toMatchSnapshot();
});
    
// ======================================================== Integration Test =====================================================
/*
describe('Lambda Function Integration Tests', () => {
    beforeAll(() => {
        AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
            callback(null, {});
        });

        // Set the environment variable
        process.env.TABLE_NAME = 'WebsiteMonitoringTable';
    });

    afterAll(() => {
        AWS.restore('DynamoDB.DocumentClient');
    });

    it('should write data to DynamoDB', async () => {
        const event = {
            Records: [
                {
                    Sns: {
                        Message: JSON.stringify({
                            AlarmDescription: 'Test Alarm Description',
                            Trigger: {
                                Dimensions: [
                                    {
                                        value: 'http://example.com'
                                    }
                                ]
                            },
                            NewStateReason: 'Test reason'
                        })
                    }
                }
            ]
        };

        // Spy on DynamoDBClient's send method
        const sendSpy = jest.spyOn(DynamoDBClient.prototype, 'send');

        await handler(event);

        // Verify that the send method was called with the correct parameters
        expect(sendSpy).toHaveBeenCalledWith(expect.any(PutItemCommand));
        expect(sendSpy.mock.calls[0][0].input).toEqual({
            TableName: 'WebsiteMonitoringTable',
            Item: {
                url: { S: 'http://example.com' },
                timestamp: expect.any(Object),
                alarmDescription: { S: 'Test Alarm Description' },
                reason: { S: 'Test reason' },
            },
        });

        sendSpy.mockRestore();
    });

    it('should skip insertion for Max Latency Metric alarm', async () => {
        const event = {
            Records: [
                {
                    Sns: {
                        Message: JSON.stringify({
                            AlarmDescription: 'Alarm for Max Latency Metric',
                            Trigger: {
                                Dimensions: [
                                    {
                                        value: 'http://example.com'
                                    }
                                ]
                            },
                            NewStateReason: 'Test reason'
                        })
                    }
                }
            ]
        };

        // Spy on DynamoDBClient's send method
        const sendSpy = jest.spyOn(DynamoDBClient.prototype, 'send');

        await handler(event);

        // Verify that the send method was not called
        expect(sendSpy).not.toHaveBeenCalled();

        sendSpy.mockRestore();
    });

    it('should skip insertion for Min Availability Metric alarm', async () => {
        const event = {
            Records: [
                {
                    Sns: {
                        Message: JSON.stringify({
                            AlarmDescription: 'Alarm for Min Availability Metric',
                            Trigger: {
                                Dimensions: [
                                    {
                                        value: 'http://example.com'
                                    }
                                ]
                            },
                            NewStateReason: 'Test reason'
                        })
                    }
                }
            ]
        };

        // Spy on DynamoDBClient's send method
        const sendSpy = jest.spyOn(DynamoDBClient.prototype, 'send');

        await handler(event);

        // Verify that the send method was not called
        expect(sendSpy).not.toHaveBeenCalled();

        sendSpy.mockRestore();
    });
})*/
