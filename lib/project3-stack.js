const { Stack, Duration, RemovalPolicy } = require('aws-cdk-lib');
const fs = require('fs')
const path = require('path')
const synthetics = require('aws-cdk-lib/aws-synthetics')
const s3 = require('aws-cdk-lib/aws-s3')
const s3deployment = require('aws-cdk-lib/aws-s3-deployment')
const iam = require("aws-cdk-lib/aws-iam")
const {Alarm, ComparisonOperator, TreatMissingData, Metric, Stats, MathExpression} = require('aws-cdk-lib/aws-cloudwatch')
const actions = require('aws-cdk-lib/aws-cloudwatch-actions')
const sns = require('aws-cdk-lib/aws-sns')
const subscriptions = require('aws-cdk-lib/aws-sns-subscriptions');
const logs = require('aws-cdk-lib/aws-logs')

class Project3Stack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // ======================================================== S3 =====================================================
    const assetsBucket = new s3.Bucket(this, 'project3-canary-bucket', {
      bucketName: 'project3-canary-bucket',
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    
    // Upload json web clawer to the bucket
    new s3deployment.BucketDeployment(this, 'canary-bucket-deployment', {
      sources: [s3deployment.Source.asset(path.join(__dirname, '../src/buckets/'))],
      destinationBucket: assetsBucket,
      retainOnDelete: false,
    });

    // ======================================================== Canary =====================================================

    const canaryRole = new iam.Role(this, 'canary-iam-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Canary IAM Role',
    });

    canaryRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['s3:ListAllMyBuckets'],
        effect: iam.Effect.ALLOW,
      }),
    );

    canaryRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['s3:*'],
        effect: iam.Effect.ALLOW,
      }),
    );

    canaryRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['cloudwatch:PutMetricData'],
        effect: iam.Effect.ALLOW,
      }),
    );

    canaryRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['logs:CreateLogStream', 'logs:CreateLogGroup', 'logs:PutLogEvents'],
        effect: iam.Effect.ALLOW,
      }),
    );


    const canary = new synthetics.Canary(this, "canary", {
      canaryName: 'canary',
      artifactsBucketLocation: {bucket: assetsBucket},
      role: canaryRole,
      schedule:synthetics.Schedule.rate(Duration.minutes(5)),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_7_0,
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname, '../src/canaries/')),
        handler: 'index.handler',
      }),
      environmentVariables: {
        BUCKET: assetsBucket.bucketName,
      },
    })

    // ======================================================== Metrics =====================================================

    const filePath = path.join(__dirname, '../src/buckets/data/webCrawler.json');

    const data = fs.readFileSync(filePath, {encoding: 'utf-8'});

    const urls = []

    const jsonData = JSON.parse(data);
    for (const website of jsonData.websites) {
      urls.push(website.url);
    }

    var metricsLatency = {}
    var metricsAvailability = {}
    var metricsBrokenLinks = {}
    var metricsVisual = {}

    for (let i = 0; i < urls.length; i++) {
      metricsLatency[`ml${i}`] =  new Metric({
        namespace: "MonitorWebsites",
        metricName: "PageExecutionTime",
        dimensionsMap: {url: urls[i]}
      })

      metricsAvailability[`ma${i}`] =  new Metric({
        namespace: "MonitorWebsites",
        metricName: "PageAvailability",
        dimensionsMap: {url: urls[i]}
      })

      metricsBrokenLinks[`mb${i}`] =  new Metric({
        namespace: "MonitorWebsites",
        metricName: "PageBrokenLinks",
        dimensionsMap: {url: urls[i]}
      })

      // metricsBrokenLinks[`mb${i}`] =  new Metric({
      //   namespace: "MonitorWebsites",
      //   metricName: "PageBrokenLinks",
      //   dimensionsMap: {url: urls[i]}
      // })
    }

    const metricMaxLatency = new MathExpression({
      expression: "MAX(METRICS())",
      period: Duration.minutes(15),
      label: "Maximum Execution Time",
      usingMetrics: metricsLatency
    })

    const metricMinAvailability = new MathExpression({
      expression: "SUM(METRICS())",
      period: Duration.minutes(15),
      label: "Number of availabile websites",
      usingMetrics: metricsAvailability
    })

    // ======================================================== Alarms =====================================================

    const acceptableLatency = 5000

    var alarmsLatency = []
    var alarmsAvailability = []
    var alarmsBrokenLinks = []
    // var alarmsLatency = []

    for (let i = 0; i < urls.length; i++) {
      alarmsLatency.push(new Alarm(this, `alarm-${urls[i]}-latency`, {
        metric: metricsLatency[`ml${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `alarm-${urls[i]}-latency`,
        alarmDescription: `Alarm for ${urls[i]} Latency Metric`,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: acceptableLatency,
      }));

      alarmsAvailability.push(new Alarm(this, `alarm-${urls[i]}-availability`, {
        metric: metricsAvailability[`ma${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `alarm-${urls[i]}-availability`,
        alarmDescription: `Alarm for ${urls[i]} Availability Metric`,
        comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: 1,
      }));

      alarmsBrokenLinks.push(new Alarm(this, `alarm-${urls[i]}-broken-links`, {
        metric: metricsBrokenLinks[`mb${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `alarm-${urls[i]}-broken-links`,
        alarmDescription: `Alarm for ${urls[i]} BrokenLinks Metric`,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: 0,
      }));
    }

    const alarmMaxLatency = new Alarm(this, 'alarm-max-latency', {
      metric: metricMaxLatency, 
      evaluationPeriods: 1,
      actionsEnabled: true,
      alarmName: 'alarm-max-latency',
      alarmDescription: 'Alarm for Max Latency Metric',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: acceptableLatency,
    });


    const alarmMinAvailability = new Alarm(this, 'alarm-min-reachable', {
      metric: metricMinAvailability, 
      evaluationPeriods: 1,
      actionsEnabled: true,
      alarmName: 'alarm-min-reachable',
      alarmDescription: 'Alarm for Min Availability Metric',
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: urls.length,
    });


    const emailTopic = new sns.Topic(this, 'email-topic', {
      displayName: 'email-topic',
    });
    
    emailTopic.addSubscription(new subscriptions.EmailSubscription('hoangquang2508@gmail.com'));
    emailTopic.addSubscription(new subscriptions.EmailSubscription('akilasiniki@gmail.com'));

    alarmsLatency.forEach((alarm)=>{
      alarm.addAlarmAction(new actions.SnsAction(emailTopic))
    })

    alarmsAvailability.forEach((alarm)=>{
      alarm.addAlarmAction(new actions.SnsAction(emailTopic))
    })

    alarmsBrokenLinks.forEach((alarm)=>{
      alarm.addAlarmAction(new actions.SnsAction(emailTopic))
    })

    alarmMaxLatency.addAlarmAction(new actions.SnsAction(emailTopic))
    alarmMinAvailability.addAlarmAction(new actions.SnsAction(emailTopic))
  }
}

module.exports = { Project3Stack }