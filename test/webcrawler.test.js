// Test webcrawler function / integration
const { mockClient } = require('aws-sdk-client-mock');
const { S3Client, GetObjectCommand} = require("@aws-sdk/client-s3");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { sdkStreamMixin } = require("@smithy/util-stream");
const handler = require('../src/lambdas/webcrawler').handler;
var path = require('path');

const s3Mock = mockClient(S3Client);
const cloudWatchMock = mockClient(CloudWatchClient);

beforeAll(() => {
    process.env.BUCKET = 'example'; // Any value, does not matter
    process.env.METRIC_NAMESPACE = 'example'; // Any value, does not matter
    process.env.METRIC_LATENCY_NAME = 'example'; // Any value, does not matter
    process.env.METRIC_AVAILABILITY_NAME = 'example'; // Any value, does not matter
    process.env.METRIC_BROKENLINKS_NAME = 'example'; // Any value, does not matter
});

it('webcrawler gets object from S3', async () => {

    // Expect data from code
    const fileData = require('fs').readFileSync(path.join(__dirname, '../src/buckets/data/websites.json'), 'utf8')

    const urls = []

    const jsonData = JSON.parse(fileData);
    for (const website of jsonData.websites) {
      urls.push(website.url);
    }

    // Fake real data from s3
    const s3Data = require('fs').createReadStream(path.join(__dirname, '../src/buckets/data/websites.json'))

    const stream = sdkStreamMixin(s3Data)
    
    s3Mock.on(GetObjectCommand).resolves({
        Body: stream
    });

    cloudWatchMock.on(PutMetricDataCommand).resolves()

    const result = await handler();
    
    expect(result).toEqual(urls);

    s3Mock.restore();
    cloudWatchMock.restore();
}, 15000);

afterAll(done => {
    done()
})