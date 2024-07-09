// Test canary function
const AWS = require('aws-sdk-mock');
const handler = require('../src/canaries/nodejs/node_modules/index').handler;
var path = require('path');

beforeAll(() => {
    process.env.BUCKET = 'example'; // Any value, does not matter
});

it('canary gets object from S3', async () => {

    const fileData = require('fs').readFileSync(path.join(__dirname, '../src/buckets/data/webCrawler.json'), 'utf8')

    const urls = []

    const jsonData = JSON.parse(fileData);
    for (const website of jsonData.websites) {
      urls.push(website.url);
    }

    const mockData = {
        Body: Buffer.from(fileData)
    }
    
    AWS.mock('S3', 'getObject', mockData);

    const result = await handler(true);
    expect(result).toEqual(urls);

    AWS.restore('S3');
});