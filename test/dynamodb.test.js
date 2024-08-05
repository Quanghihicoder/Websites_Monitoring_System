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

    it('should write data to DynamoDB', async () => {

        ddbMock.on(PutItemCommand).resolves(
            {
                TableName: process.env.TABLE_NAME,
                Item: {
                    url: { S: "http://example.com" },
                    //timestamp: { S: new Date().toDateString() },
                    alarmDescription: { S: "value" },
                    reason: { S: "value"},
                },

            }
        )
        /*
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

        //expect(ddbMock).toHaveReceivedCommand(PutItemCommand);

        const calls = ddbMock.commandCalls(PutItemCommand);
        expect(calls.length).toBe(1);


        const commandInput = calls[0].args[0].input;
        expect(commandInput).toEqual({
            TableName: 'TestTable',
            Item: {
                url: { S: 'http://example.com' },
                //timestamp: expect.any(Object),
                alarmDescription: { S: 'Test Alarm Description' },
                reason: { S: 'Test reason' },
            },
        });*/
    });
})
    
