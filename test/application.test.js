// Test AWS infrastructure

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { Project3Stack } = require('../lib/project3-stack');

const app = new cdk.App();
const stack = new Project3Stack(app, 'Test-Project3Stack', {});
const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

// test('Bucket for webcrawler has been created', () => {
//     template.hasResourceProperties('AWS::S3::Bucket', {
//         BucketName: "project3-webcrawler-bucket"
//     })
// })

test('Web Crawler has been created', () => {
    template.hasResource("AWS::Lambda::Function", "");

    template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: "webcrawler.handler"
    })
})

test('Web Crawler runs every 5 minutes', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
        ScheduleExpression: "rate(5 minutes)"
    })
})

// test('There are 11 alarms, includes 3 Latency, 3 Availability, 3 BrokenLinks', () => {
//     template.resourceCountIs("AWS::CloudWatch::Alarm", 11);

//     template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageExecutionTime"}, 3)
//     template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageAvailability"}, 3)
//     template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageBrokenLinks"}, 3)
// })

test('There are 11 alarms', () => {
    template.resourceCountIs("AWS::CloudWatch::Alarm", 11);
})

// test('SNS has been created and has 2 email subscriptions', () => {
//     template.hasResource("AWS::SNS::Topic", "");
    
//     template.resourceCountIs("AWS::SNS::Subscription", 2);
// })

// ======================================================== Snapshot Test =====================================================
// Might need to run "npm run test --updateSnapshot"
it('Matches the snapshot.', () => {
    expect(template.toJSON()).toMatchSnapshot();
});
    
