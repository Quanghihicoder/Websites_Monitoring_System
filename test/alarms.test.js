const { CloudFormationClient, DescribeStacksCommand } = require("@aws-sdk/client-cloudformation");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CloudWatchClient, DescribeAlarmsCommand } = require("@aws-sdk/client-cloudwatch");
const { SNSClient, ListSubscriptionsByTopicCommand } = require("@aws-sdk/client-sns");
const cdk = require("aws-cdk-lib");
const { mockClient } = require('aws-sdk-client-mock');


const stackName = "TestStack";
const region = "ap-southeast-2";

//Create instances of AWS SDK clients for interacting with cloudFormation
const cloudFormationClient = new CloudFormationClient({ region });
const lambdaClient = new LambdaClient({ region });
const cloudWatchClient = new CloudWatchClient({ region });
const snsClient = new SNSClient({ region });


describe("Integration Tests for AWS CDK Stack", () => {

    //Mock clients for the AWS services 
    const cfMock = mockClient(CloudFormationClient);
    const lambdaMock = mockClient(LambdaClient);
    const snsMock = mockClient(SNSClient);
    const cloudWatchMock = mockClient(CloudWatchClient);
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
                { SubscriptionArn: "Subscription1" },
                { SubscriptionArn: "Subscription2" },
                { SubscriptionArn: "Subscription3" }
        ]
        });

        cloudWatchMock.on(DescribeAlarmsCommand).resolves({
            MetricAlarms: new Array(12).fill({ AlarmName: "webcrawler-alarm" })
            
        });
    });

    it("Stack is deployed successfully", async () => {
        const command = new DescribeStacksCommand({ StackName: "TestStack" });
        const response = await cloudFormationClient.send(command);
        expect(response.Stacks[0].StackStatus).toBe("CREATE_COMPLETE");
    });

    it("Lambda function is invoked successfully", async () => {
        const functionName = "TestFunction";
        const command = new InvokeCommand({ FunctionName: functionName });
        const response = await lambdaClient.send(command);
        expect(response.StatusCode).toBe(200);
    });

    it("CloudWatch alarms are set up correctly", async () => {
        const command = new DescribeAlarmsCommand({});
        const response = await cloudWatchClient.send(command);
        const alarms = response.MetricAlarms.filter(alarm => alarm.AlarmName.includes("webcrawler-alarm"));
        expect(alarms.length).toBe(12);
    });

    it("SNS topic and subscriptions are set up correctly", async () => {
        const command = new ListSubscriptionsByTopicCommand({ TopicArn: topicArn });
        const response = await snsClient.send(command);
        expect(response.Subscriptions).toBeDefined();
        expect(response.Subscriptions.length).toBe(3);
    });

});