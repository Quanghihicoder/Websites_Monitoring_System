const { Stack, Duration, RemovalPolicy, CfnParameter} = require('aws-cdk-lib');
const fs = require('fs')
const path = require('path');
const s3 = require('aws-cdk-lib/aws-s3')
const s3deployment = require('aws-cdk-lib/aws-s3-deployment')
const iam = require("aws-cdk-lib/aws-iam")
const {Alarm, ComparisonOperator, TreatMissingData, Metric, MathExpression} = require('aws-cdk-lib/aws-cloudwatch')
const actions = require('aws-cdk-lib/aws-cloudwatch-actions')
const sns = require('aws-cdk-lib/aws-sns')
const subscriptions = require('aws-cdk-lib/aws-sns-subscriptions');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const logs = require("aws-cdk-lib/aws-logs")
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
const eventstargets = require('aws-cdk-lib/aws-events-targets');
const codedeploy = require('aws-cdk-lib/aws-codedeploy')

class ApplicationStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // ======================================================== Variables =====================================================
    const metricNameSpace = "MonitorWebsites" + "-" + props.stage ;
    const metricLatencyName = "PageExecutionTime" + "-" + props.stage;
    const metricAvailabilityName = "PageAvailability" + "-" + props.stage;
    const metricBrokenLinksName = "PageBrokenLinks" + "-" + props.stage;

    const metricOperationalNameSpace = "LambdaInsights";
    const metricCPUName = "cpu_total_time";
    const metricMemoryName = "used_memory_max";

    // ======================================================== Asset =====================================================

    const websitesBucket = new s3.Bucket(this, 'WebCrawlerBucket', {
      bucketName: 'webcrawler-bucket' + "-" + props.stage,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    
    // Upload json web clawer to the bucket
    new s3deployment.BucketDeployment(this, 'WebCrawlerBucketDeployment', {
      sources: [s3deployment.Source.asset(path.join(__dirname, '../src/buckets/'))],
      destinationBucket: websitesBucket,
      retainOnDelete: false,
    });

    // ======================================================== Web Crawler =====================================================

    const webcrawlerRole = new iam.Role(this, 'WebCrawlerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Web Crawler IAM Role' + "-" + props.env.region + "-" + props.stage,
    });

    webcrawlerRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['s3:ListAllMyBuckets'],
        effect: iam.Effect.ALLOW,
      }),
    );

    webcrawlerRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['s3:*'],
        effect: iam.Effect.ALLOW,
      }),
    );

    webcrawlerRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['cloudwatch:PutMetricData'],
        effect: iam.Effect.ALLOW,
      }),
    );

    webcrawlerRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['logs:CreateLogStream', 'logs:CreateLogGroup', 'logs:PutLogEvents'],
        effect: iam.Effect.ALLOW,
      }),
    );


    const logGroup = new logs.LogGroup(this, 'WebCrawlerLogGroup', {
        logGroupName: "webcrawler-loggroup" + "-" + props.stage,
        removalPolicy: RemovalPolicy.DESTROY
    });

    const webcrawler = new lambda.Function(this, 'WebCrawler', {
      functionName: "webcrawler" + "-" + props.stage,
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambdas/')),
      handler: 'webcrawler.handler',
      role: webcrawlerRole,
      loggingFormat: lambda.LoggingFormat.JSON,
      systemLogLevelV2: lambda.SystemLogLevel.INFO,
      applicationLogLevelV2: lambda.ApplicationLogLevel.INFO,
      logGroup: logGroup,
      timeout: Duration.seconds(30),
      memorySize: 512,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_89_0,
      environment: {
        BUCKET: websitesBucket.bucketName,
        METRIC_NAMESPACE: metricNameSpace,
        METRIC_LATENCY_NAME: metricLatencyName,
        METRIC_AVAILABILITY_NAME: metricAvailabilityName,
        METRIC_BROKENLINKS_NAME: metricBrokenLinksName,
      },
    });

    const webcrawlerLambdaEvent = new events.Rule(this,'WebCrawlerEvent',{
      description: "Web Crawler run every 5 mins",
      targets: [new eventstargets.LambdaFunction(webcrawler)],
      schedule: events.Schedule.rate(Duration.minutes(5)),
    });
    
    // ======================================================== Metrics =====================================================

    const filePath = path.join(__dirname, '../src/buckets/data/websites.json');

    const data = fs.readFileSync(filePath, {encoding: 'utf-8'});

    const urls = []

    const jsonData = JSON.parse(data);
    for (const website of jsonData.websites) {
      urls.push(website.url);
    }

    var metricsLatency = {}
    var metricsAvailability = {}
    var metricsBrokenLinks = {}

    for (let i = 0; i < urls.length; i++) {
      metricsLatency[`ml${i}`] =  new Metric({
        namespace: metricNameSpace,
        metricName: metricLatencyName,
        dimensionsMap: {url: urls[i]}
      })

      metricsAvailability[`ma${i}`] =  new Metric({
        namespace: metricNameSpace,
        metricName: metricAvailabilityName,
        dimensionsMap: {url: urls[i]}
      })

      metricsBrokenLinks[`mb${i}`] =  new Metric({
        namespace: metricNameSpace,
        metricName: metricBrokenLinksName,
        dimensionsMap: {url: urls[i]}
      })
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

    const acceptableLatency = 800

    var alarmsLatency = []
    var alarmsAvailability = []
    var alarmsBrokenLinks = []

    for (let i = 0; i < urls.length; i++) {
      alarmsLatency.push(new Alarm(this, 'AlarmLatency' + urls[i], {
        metric: metricsLatency[`ml${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `webcrawler-alarm-${urls[i]}-latency` + "-" + props.stage,
        alarmDescription: `Alarm for ${urls[i]} Latency Metric`,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: acceptableLatency,
      }));

      alarmsAvailability.push(new Alarm(this, 'AlarmAvailability' + urls[i] , {
        metric: metricsAvailability[`ma${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `webcrawler-alarm-${urls[i]}-availability` + "-" + props.stage,
        alarmDescription: `Alarm for ${urls[i]} Availability Metric`,
        comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: 1,
      }));

      alarmsBrokenLinks.push(new Alarm(this, 'AlarmBrokenLinks' + urls[i], {
        metric: metricsBrokenLinks[`mb${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `webcrawler-alarm-${urls[i]}-broken-links` + "-" + props.stage,
        alarmDescription: `Alarm for ${urls[i]} Broken Links Metric`,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: 0,
      }));
    }

    const alarmMaxLatency = new Alarm(this, 'AlarmMaxLatency', {
      metric: metricMaxLatency, 
      evaluationPeriods: 1,
      actionsEnabled: true,
      alarmName: 'webcrawler-alarm-max-latency' + "-" + props.stage,
      alarmDescription: 'Alarm for Max Latency Metric',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: acceptableLatency,
    });


    const alarmMinAvailability = new Alarm(this, 'AlarmMinAvailability', {
      metric: metricMinAvailability, 
      evaluationPeriods: 1,
      actionsEnabled: true,
      alarmName: 'webcrawler-alarm-min-availability' + "-" + props.stage,
      alarmDescription: 'Alarm for Min Availability Metric',
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: urls.length,
    });

    // ======================================================== SNS topics =====================================================

    const emailTopic = new sns.Topic(this, 'EmailTopic', {
      displayName: 'webcrawler-email-topic'+ "-" + props.stage,
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
  
    // ======================================================== DynamoDB =====================================================
    
    const webcrawlerAlarmTable = new dynamodb.Table(this, 'WebCrawlerAlarmDynamoDB', {
      tableName: "webcrawler-alarm-dynamodb" + "-" + props.stage,
      partitionKey: {
        name: 'url', 
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp', 
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ======================================================== Alarm Writer =====================================================
   
    const alarmwriterRole = new iam.Role(this, 'AlarmWriterRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Lambda IAM Role for DynamoDB' + "-" + props.env.region + "-" + props.stage,
    });

    alarmwriterRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [webcrawlerAlarmTable.tableArn],
        actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:GetItem'],
        effect: iam.Effect.ALLOW, 
      }),
    );

    alarmwriterRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['logs:CreateLogStream', 'logs:CreateLogGroup', 'logs:PutLogEvents'],
        effect: iam.Effect.ALLOW,
      }),
    );

    const alarmwriter = new lambda.Function(this, 'AlarmWriter', {
      functionName: "alarmwriter" + "-" + props.stage,
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambdas/')),
      handler: 'alarmwriter.handler',
      role: alarmwriterRole,
      environment: {
        TABLE_NAME: webcrawlerAlarmTable.tableName,
      },
    });

    emailTopic.addSubscription(new subscriptions.LambdaSubscription(alarmwriter));    

    // ======================================================== Code Deploy =====================================================
    
    // Since the traffic is not much, 1 in 5 minutes, but we want to monitor it, so 95% of the traffic will go to the new version
    // Only 5% left on the current version
    const deploymentConfig = new codedeploy.LambdaDeploymentConfig(this, 'CustomConfig', {
      trafficRouting: new codedeploy.TimeBasedCanaryTrafficRouting({
        interval: Duration.minutes(15),
        percentage: 95,
      }),
    });

    const webcrawlerAlias = new lambda.Alias(this, 'WebCrawlerAlias', {
      aliasName: "webcrawler-alias" + "-" + props.stage,
      version: webcrawler.currentVersion,
    });

    const webcrawlerDeployment = new codedeploy.LambdaDeploymentGroup(this, 'WebCrawlerDeployment', {
      alias: webcrawlerAlias,
      deploymentConfig: deploymentConfig,
      autoRollback: {
        failedDeployment: true, 
        stoppedDeployment: true, 
        deploymentInAlarm: true,
      },
    });

    const alarmwriterAlias = new lambda.Alias(this, 'AlarmWriterAlias', {
      aliasName: "alarmwriter-alias" + "-" + props.stage,
      version: alarmwriter.currentVersion,
    });

    const alarmwriterDeployment = new codedeploy.LambdaDeploymentGroup(this, 'AlarmWriterDeployment', {
      alias: alarmwriterAlias,
      deploymentConfig: deploymentConfig,
      autoRollback: {
        failedDeployment: true, 
        stoppedDeployment: true 
      },
    });
    
    // ======================================================== Operational Metrics & Alarms =====================================================

    const webcrawlerOperationalMetricCPU = new Metric({
      namespace: metricOperationalNameSpace,
      metricName: metricCPUName,
      dimensionsMap: {function_name: webcrawler.functionName}
    })

    const webcrawlerOperationalMetricMemmory = new Metric({
      namespace: metricOperationalNameSpace,
      metricName: metricMemoryName,
      dimensionsMap: {function_name: webcrawler.functionName}
    })

    const webcrawlerCPUAlarm = new Alarm(this, 'WebCrawlerCPUAlarm', {
      metric: webcrawlerOperationalMetricCPU, 
      evaluationPeriods: 1,
      alarmName: 'webcrawler-cpu-alarm' + "-" + props.stage,
      alarmDescription: 'Alarm for Web Crawler CPU Runtime Metric',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      period: Duration.minutes(5),
      threshold: 1200,
    });

    const webcrawlerMemmoryAlarm = new Alarm(this, 'WebCrawlerMemmoryAlarm', {
      metric: webcrawlerOperationalMetricMemmory, 
      evaluationPeriods: 1,
      alarmName: 'webcrawler-memmory-alarm' + "-" + props.stage,
      alarmDescription: 'Alarm for Web Crawler Memmory Used Metric',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      period: Duration.minutes(5),
      threshold: 200,
    });

    webcrawlerDeployment.addAlarm(webcrawlerCPUAlarm)
    webcrawlerDeployment.addAlarm(webcrawlerMemmoryAlarm)
  }
}

module.exports = { ApplicationStack }