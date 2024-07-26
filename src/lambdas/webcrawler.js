/* global fetch */
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

const s3 = new S3Client({});
const cloudWatch = new CloudWatchClient({});

// Test pipeline
// const test = true

// maximum number of links that would be followed
const limit = 10;

const getLinks = (html) => {
    const links = [];
    const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(https?:\/\/|\/)(.*?)\1/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        links.push(match[2] + match[3]);
    }

    return links;
}

const getBrokenLinks = async function (url, html) {
    const links = getLinks(html).slice(0, limit);

    let brokenLinkCount = 0;

    for (let i = 0; i < links.length; i++) {
        if (links[i].startsWith("/")) {
            links[i] = url + links[i]
        }
    }

    for (let i = 0; i < links.length; i++) {
        const response = await fetch(links[i]);

        if (response) {
            if (response.status < 200 || response.status > 299) {
                brokenLinkCount += 1;
            }
        }
    }

    return brokenLinkCount;
}

const loadUrl = async function (url) {
    try {
        let availability = 0;
        let time = 0;
        let brokenLinkCount = 0;

        const start = Date.now();

        const response = await fetch(url)

        if (response) {
            time = Date.now() - start;

            if (response.status >= 200 && response.status <= 299) {
                availability = 1;
            }

            let html = await response.text();
            if (html) {
                brokenLinkCount = await getBrokenLinks(url, html);

                if (brokenLinkCount >= 0) {
                    const command = new PutMetricDataCommand({
                        MetricData: [
                            {
                                MetricName: process.env.METRIC_LATENCY_NAME,
                                Dimensions: [
                                    {
                                        Name: 'url',
                                        Value: url
                                    }
                                ],
                                Unit: 'Milliseconds',
                                Value: time
                            },
                            {
                                MetricName: process.env.METRIC_AVAILABILITY_NAME,
                                Dimensions: [
                                    {
                                        Name: 'url',
                                        Value: url
                                    }
                                ],
                                Unit: 'Count',
                                Value: availability
                            },
                            {
                                MetricName: process.env.METRIC_BROKENLINKS_NAME,
                                Dimensions: [
                                    {
                                        Name: 'url',
                                        Value: url
                                    }
                                ],
                                Unit: 'Count',
                                Value: brokenLinkCount
                            }
                        ],
                        Namespace: process.env.METRIC_NAMESPACE,
                    });

                    try {
                        await cloudWatch.send(command);
                    } catch (e) {
                        console.log('Error putting metric data', e);
                    }
                }
            }
        }
    } catch (error) {
        console.log(`Error: ${error}`);
    }
};

const webcrawler = async function () {
    const bucketName = process.env.BUCKET;
    const objectKey = "data/websites.json"; // <- No /data

    console.log("BucketName:" + bucketName)

    const command = new GetObjectCommand({
        Bucket: bucketName, // your bucket name
        Key: objectKey // path to the object you're looking for
    });

    const urls = [];

    try {
        const response = await s3.send(command);
        const jsonContent = await response.Body.transformToString();
        const jsonData = await JSON.parse(jsonContent);
        for (const website of jsonData.websites) {
            urls.push(website.url);
        }
    } catch (err) {
        console.error('Error fetching S3 object:', err);
    }


    if (urls.length > 0) {
        for (const url of urls) {
            await loadUrl(url);
        }
    }

    return urls;
};

exports.handler = async (event) => {
    return await webcrawler();
};
