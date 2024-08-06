const { CloudFormationClient, DescribeStacksCommand } = require("@aws-sdk/client-cloudformation");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CloudWatchClient, DescribeAlarmsCommand } = require("@aws-sdk/client-cloudwatch");
const { DynamoDBClient, PutItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { SNSClient, ListSubscriptionsByTopicCommand } = require("@aws-sdk/client-sns");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { EventBridgeClient, ListRulesCommand } = require("@aws-sdk/client-eventbridge");
const cdk = require("aws-cdk-lib");
const {ApplicationStack} = require("../lib/application-stack");
const {Template} = require("aws-cdk-lib/assertions");

const Sydney = {
    account: "058264550947",
    region: "ap-southeast-2",
};

const url ="example.url";

const stackName = "ProdApplicationStack";
const region = "ap-southeast-2";

const cloudFormationClient = new CloudFormationClient({ region });
const lambdaClient = new LambdaClient({ region });
const cloudWatchClient = new CloudWatchClient({ region });
const dynamoDBClient = new DynamoDBClient({ region });
const snsClient = new SNSClient({ region });
const ssmClient = new SSMClient({ region });
const eventBridgeClient = new EventBridgeClient({ region });

describe("Integration Tests for AWS CDK Stack", () => {
    test("Stack is deployed successfully", async () => {
        const command = new DescribeStacksCommand({ StackName: stackName });
        const response = await cloudFormationClient.send(command);
        expect(response.Stacks[0].StackStatus).toBe("CREATE_COMPLETE");
    });

    test("Lambda function is invoked successfully", async () => {
        const functionName = "webcrawler-ap-southeast-2-prod";
        const command = new InvokeCommand({ FunctionName: functionName });
        const response = await lambdaClient.send(command);
        expect(response.StatusCode).toBe(200);
    });

    test("CloudWatch alarms are set up correctly", async () => {
        const command = new DescribeAlarmsCommand({});
        const response = await cloudWatchClient.send(command);
        const alarms = response.MetricAlarms.filter(alarm => alarm.AlarmName.includes("webcrawler-alarm"));
        expect(alarms.length).toBeGreaterThan(0);
    });

    test("SNS topic and subscriptions are set up correctly", async () => {
        const topicArn = "arn:aws:sns:ap-southeast-2:058264550947:webcrawler-email-topic-ap-southeast-2-prod";
        const command = new ListSubscriptionsByTopicCommand({ TopicArn: topicArn });
        const response = await snsClient.send(command);
        expect(response.Subscriptions.length).toBe(2);
    });

    test("DynamoDB table operations work correctly", async () => {
        const tableName = "webcrawler-dynamodb-ap-southeast-2-prod";
        const putCommand = new PutItemCommand({
            TableName: tableName,
            Item: {
                url: { S: "https://example.com" },
                timestamp: { S: new Date().toISOString() },
            },
        });
        await dynamoDBClient.send(putCommand);

        const getCommand = new GetItemCommand({
            TableName: tableName,
            Key: {
                url: { S: "https://example.com" },
                timestamp: { S: new Date().toISOString() },
            },
        });
        const response = await dynamoDBClient.send(getCommand);
        expect(response.Item).toBeDefined();
    });

    test("Scheduled events are set up correctly", async () => {
        const command = new ListRulesCommand({});
        const response = await eventBridgeClient.send(command);
        const rules = response.Rules.filter(rule => rule.Name.includes("webcrawler-lambda-event"));
        expect(rules.length).toBeGreaterThan(0);
    });
});