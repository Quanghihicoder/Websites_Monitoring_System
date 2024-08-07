const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient();

const tableName = process.env.TABLE_NAME;

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        const metricData = JSON.parse(record.Sns.Message);

        // Skip insertion if the alarm description matches specific criteria
        if (metricData.AlarmDescription === 'Alarm for Max Latency Metric' ||
            metricData.AlarmDescription === 'Alarm for Min Availability Metric') {
                const params = {
                    TableName: tableName,
                    Item: {
                        url: { S: metricData.AlarmDescription },
                        timestamp: { S: new Date().toDateString() },
                        alarmDescription: { S: metricData.AlarmDescription },
                        reason: { S: metricData.NewStateReason },
                    }}
        continue;
        };
        
        const params = {
            TableName: tableName,
            Item: {
                url: { S: metricData.Trigger.Dimensions[0].value },
                timestamp: { S: new Date().toDateString() },
                alarmDescription: { S: metricData.AlarmDescription },
                reason: { S: metricData.NewStateReason },
            },
        };

        try {
            const command = new PutItemCommand(params);
            await client.send(command);
            console.log('Data inserted:', params.Item);
        } catch (err) {
            console.error('Error inserting data:', err);
        }
    }
};
