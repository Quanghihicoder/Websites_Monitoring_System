// Test DynamoDB / integration
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBClient, PutItemCommand} = require("@aws-sdk/client-dynamodb");
const handler = require('../src/lambdas/alarmwriter').handler;

const ddbMock = mockClient(DynamoDBClient);

describe('Alarm Writer Function Integration Tests', () => {

    beforeAll(() => {
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
                    alarmDescription: { S: "value" },
                    reason: { S: "value"},
                },

            }
        )     
    });
})
    
