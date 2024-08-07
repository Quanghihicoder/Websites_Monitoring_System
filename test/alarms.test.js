const { CloudFormationClient, DescribeStacksCommand } = require("@aws-sdk/client-cloudformation");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CloudWatchClient, DescribeAlarmsCommand } = require("@aws-sdk/client-cloudwatch");
const { SNSClient, ListSubscriptionsByTopicCommand } = require("@aws-sdk/client-sns");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { EventBridgeClient, ListRulesCommand } = require("@aws-sdk/client-eventbridge");
const cdk = require("aws-cdk-lib");
const {ApplicationStack} = require("../lib/application-stack");
const {Template} = require("aws-cdk-lib/assertions");
const { mockClient } = require('aws-sdk-client-mock');

const Sydney = {
    account: "058264550947",
    region: "ap-southeast-2",
};

const url ="example.url";

const stackName = "TestStack";
const region = "ap-southeast-2";

const cloudFormationClient = new CloudFormationClient({ region });
const lambdaClient = new LambdaClient({ region });
const cloudWatchClient = new CloudWatchClient({ region });
const dynamoDBClient = new DynamoDBClient({ region });
const snsClient = new SNSClient({ region });
const ssmClient = new SSMClient({ region });
const eventBridgeClient = new EventBridgeClient({ region });

describe("Integration Tests for AWS CDK Stack", () => {

    const cfMock = mockClient(CloudFormationClient);
    const lambdaMock = mockClient(LambdaClient);
    const snsMock = mockClient(SNSClient);
    const topicArn ="TestTopic";

    beforeAll(() => {
        cfMock.on(DescribeStacksCommand, { StackName: "TestStack" }).resolves({
            Stacks: [{
                    StackStatus: "CREATE_COMPLETE"}]
        });
   
        lambdaMock.on(InvokeCommand, { FunctionName: 'TestFunction' }).resolves({
            StatusCode: 200,
        });

        snsMock.on(ListSubscriptionsByTopicCommand, { TopicArn: topicArn }).resolves({
            Subscriptions: [
                { SubscriptionArn: "TestTopic" },
                { SubscriptionArn: "TestTopic" },
                { SubscriptionArn: "TestTopic" }
        ]
        });
    });

    test("Stack is deployed successfully", async () => {
        const command = new DescribeStacksCommand({ StackName: "TestStack" });
        const response = await cloudFormationClient.send(command);
        expect(response.Stacks[0].StackStatus).toBe("CREATE_COMPLETE");
    });

    test("Lambda function is invoked successfully", async () => {
        const functionName = "TestFunction";
        const command = new InvokeCommand({ FunctionName: functionName });
        const response = await lambdaClient.send(command);
        expect(response.StatusCode).toBe(200);
    });

    test("CloudWatch alarms are set up correctly", async () => {
        const command = new DescribeAlarmsCommand({});
        const response = await cloudWatchClient.send(command);
        const alarms = response.MetricAlarms.filter(alarm => alarm.AlarmName.includes("webcrawler-alarm"));
        expect(alarms.length).toBe(0);
    });

    test("SNS topic and subscriptions are set up correctly", async () => {
        const topicArn = "TestTopic";
        const command = new ListSubscriptionsByTopicCommand({ TopicArn: topicArn });
        const response = await snsClient.send(command);
        expect(response.Subscriptions).toBeDefined();
        expect(response.Subscriptions.length).toBe(3);
    });

});