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
                TableName: 'TestTable',
                Item: {
                    //url: { S: "http://example.com" },
                    alarmDescription: { S: "value" },
                    reason: { S: "value"},
                },

            }
        )     
    });
})
    
