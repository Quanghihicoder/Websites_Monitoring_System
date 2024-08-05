// Test DynamoDB / integration

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBClient, PutItemCommand} = require("@aws-sdk/client-dynamodb");
const handler = require('../src/lambdas/dynamodb').handler;


describe('Lambda Function Integration Tests', () => {
    const ddbMock = mockClient(DynamoDBClient);

    beforeAll(() => {
        ddbMock.reset();
        // Set the environment variable
        process.env.TABLE_NAME = 'TestTable';
    });

    afterEach(() => {
        ddbMock.reset();
    });

    test('should write data to DynamoDB', async () => {

        ddbMock.on(PutItemCommand).resolves(
            {
                TableName: process.env.TABLE_NAME,
                Item: {
                    url: { S: "http://example.com" },
                    timestamp: { S: new Date().toDateString() },
                    alarmDescription: { S: "value" },
                    reason: { S: "value"},
                },

            }
        )

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

        await handler(event);

        // Verify that the send method was called with the correct parameters
        expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
            TableName: 'WebsiteMonitoringTable',
            Item: {
                url: { S: 'http://example.com' },
                timestamp: expect.any(Object),
                alarmDescription: { S: 'Test Alarm Description' },
                reason: { S: 'Test reason' },
            },
        });
    });

    test('should skip insertion for Max Latency Metric alarm', async () => {
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

        await handler(event);

        // Verify that the send method was not called
        expect(ddbMock).not.toHaveReceivedCommand(PutItemCommand);
    });

    test('should skip insertion for Min Availability Metric alarm', async () => {
        const event = {
            Records: [
                {
                    Sns:    {
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

        await handler(event);

        // Verify that the send method was not called
        expect(ddbMock).not.toHaveReceivedCommand(PutItemCommand);
    });
})
