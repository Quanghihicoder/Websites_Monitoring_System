// Test AWS infrastructure

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require('../lib/application-stack');

const Sydney = {
    account: "058264550947",
    region: "ap-southeast-2",
};

const app = new cdk.App();
const stack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });
const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

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

test('There are 11 alarms, includes 3 Latency, 3 Availability, 3 BrokenLinks', () => {
    template.resourceCountIs("AWS::CloudWatch::Alarm", 12);

    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageExecutionTime-ap-southeast-2-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageAvailability-ap-southeast-2-prod"}, 3)
    template.resourcePropertiesCountIs("AWS::CloudWatch::Alarm", {MetricName: "PageBrokenLinks-ap-southeast-2-prod"}, 3)
})

test('SNS has been created and has 2 email subscriptions', () => {
    template.hasResource("AWS::SNS::Topic", "");
    
    template.resourceCountIs("AWS::SNS::Subscription", 2);
})

// ======================================================== Snapshot Test =====================================================
// Might need to run "npm run test --updateSnapshot"
it('Matches the snapshot.', () => {
    expect(template.toJSON()).toMatchSnapshot();
});
    
