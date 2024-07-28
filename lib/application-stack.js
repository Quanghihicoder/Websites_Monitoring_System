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
const apigateway = require('aws-cdk-lib/aws-apigateway');
const events = require('aws-cdk-lib/aws-events');
const eventstargets = require('aws-cdk-lib/aws-events-targets');
const codedeploy = require('aws-cdk-lib/aws-codedeploy')
const ssm = require('aws-cdk-lib/aws-ssm')

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
    const metricNameSpace = "MonitorWebsites" + "-" + props.env.region + "-" + props.stage ;
    const metricLatencyName = "PageExecutionTime" + "-" + props.env.region + "-" + props.stage;
    const metricAvailabilityName = "PageAvailability" + "-" + props.env.region + "-" + props.stage;
    const metricBrokenLinksName = "PageBrokenLinks" + "-" + props.env.region + "-" + props.stage;
    
    // ======================================================== Props =====================================================
    this.lambdasCode = lambda.Code.fromCfnParameters();
    this.assetBucket = ssm.StringParameter.fromStringParameterName(this, "webcrawler-bucket-location", "webcrawler-assets-bucket-location").stringValue;

    // ======================================================== IAM =====================================================

    const webcrawlerRole = new iam.Role(this, 'webcrawler-iam-role' + "-" + props.env.region + "-" + props.stage, {
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

    // ======================================================== Web Crawler =====================================================

    const logGroup = new logs.LogGroup(this, 'webcrawler-log-group' + "-" + props.env.region + "-" + props.stage, {
        logGroupName: "webcrawler-log-group" + "-" + props.env.region + "-" + props.stage,
        removalPolicy: RemovalPolicy.DESTROY
    });

    const webcrawler = new lambda.Function(this, 'project3-webcrawler' + "-" + props.env.region + "-" + props.stage, {
      functionName: "webcrawler" + "-" + props.env.region + "-" + props.stage,
      runtime: lambda.Runtime.NODEJS_20_X,
      code: this.lambdasCode,
      handler: 'webcrawler.handler',
      role: webcrawlerRole,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY
      },
      loggingFormat: lambda.LoggingFormat.JSON,
      systemLogLevelV2: lambda.SystemLogLevel.INFO,
      applicationLogLevelV2: lambda.ApplicationLogLevel.INFO,
      logGroup: logGroup,
      timeout: Duration.seconds(30),
      environment: {
        BUCKET: this.assetBucket,
        METRIC_NAMESPACE: metricNameSpace,
        METRIC_LATENCY_NAME: metricLatencyName,
        METRIC_AVAILABILITY_NAME: metricAvailabilityName,
        METRIC_BROKENLINKS_NAME: metricBrokenLinksName,
      },
    });

    // const webcrawlerAPI = new apigateway.LambdaRestApi(this, 'project3-webcrawler-restapi' + "-" + props.env.region + "-" + props.stage, {
    //   handler: webcrawler,
    //   endpointExportName: 'project3-webcrawler-restapi'+ "-" + props.env.region + "-" + props.stage,
    //   // deployOptions: {
    //   //   stageName: props.stageName
    //   // }
    // });

    const webcrawlerLambdaEvent = new events.Rule(this,'webcrawler-lambda-event' + "-" + props.env.region + "-" + props.stage,{
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

    const acceptableLatency = 3000

    var alarmsLatency = []
    var alarmsAvailability = []
    var alarmsBrokenLinks = []

    for (let i = 0; i < urls.length; i++) {
      alarmsLatency.push(new Alarm(this, `alarm-${urls[i]}-latency`  + "-" + props.env.region + "-" + props.stage, {
        metric: metricsLatency[`ml${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `webcrawler-alarm-${urls[i]}-latency` + "-" + props.env.region + "-" + props.stage,
        alarmDescription: `Alarm for ${urls[i]} Latency Metric`,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: acceptableLatency,
      }));

      alarmsAvailability.push(new Alarm(this, `alarm-${urls[i]}-availability`  + "-" + props.env.region + "-" + props.stage, {
        metric: metricsAvailability[`ma${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `webcrawler-alarm-${urls[i]}-availability` + "-" + props.env.region + "-" + props.stage,
        alarmDescription: `Alarm for ${urls[i]} Availability Metric`,
        comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: 1,
      }));

      alarmsBrokenLinks.push(new Alarm(this, `alarm-${urls[i]}-broken-links`  + "-" + props.env.region + "-" + props.stage, {
        metric: metricsBrokenLinks[`mb${i}`], 
        evaluationPeriods: 1,
        actionsEnabled: true,
        alarmName: `webcrawler-alarm-${urls[i]}-broken-links`  + "-" + props.env.region + "-" + props.stage,
        alarmDescription: `Alarm for ${urls[i]} BrokenLinks Metric`,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        period: Duration.minutes(5),
        threshold: 0,
      }));
    }

    const alarmMaxLatency = new Alarm(this, 'alarm-max-latency'  + "-" + props.env.region + "-" + props.stage, {
      metric: metricMaxLatency, 
      evaluationPeriods: 1,
      actionsEnabled: true,
      alarmName: 'webcrawler-alarm-max-latency' + "-" + props.env.region + "-" + props.stage,
      alarmDescription: 'Alarm for Max Latency Metric',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: acceptableLatency,
    });


    const alarmMinAvailability = new Alarm(this, 'alarm-min-reachable' + "-" + props.env.region + "-" + props.stage, {
      metric: metricMinAvailability, 
      evaluationPeriods: 1,
      actionsEnabled: true,
      alarmName: 'webcrawler-alarm-min-reachable' + "-" + props.env.region + "-" + props.stage,
      alarmDescription: 'Alarm for Min Availability Metric',
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: urls.length,
    });

    // ======================================================== SNS topics =====================================================

    const emailTopic = new sns.Topic(this, 'email-topic' + "-" + props.env.region + "-" + props.stage, {
      displayName: 'webcrawler-email-topic' + "-" + props.env.region + "-" + props.stage,
    });
    
    emailTopic.addSubscription(new subscriptions.EmailSubscription('hoangquang2508@gmail.com'));
    // emailTopic.addSubscription(new subscriptions.EmailSubscription('akilasiniki@gmail.com'));

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
    
    const table = new dynamodb.Table(this, 'project3-dynamodb'  + "-" + props.env.region + "-" + props.stage, {
      tableName: "webcrawler-dynamodb" + "-" + props.env.region + "-" + props.stage,
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

    // ======================================================== Lambda for DynamoDB =====================================================
   
    const lambdaRole = new iam.Role(this, 'project3-lambda-dynamodb-role' + "-" + props.env.region + "-" + props.stage, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Lambda IAM Role for DynamoDB' + "-" + props.env.region + "-" + props.stage,
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [table.tableArn],
        actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:GetItem'],
        effect: iam.Effect.ALLOW, 
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['logs:CreateLogStream', 'logs:CreateLogGroup', 'logs:PutLogEvents'],
        effect: iam.Effect.ALLOW,
      }),
    );

    const dynamodbFunction = new lambda.Function(this, 'project3-dynamoDB-lambda' + "-" + props.env.region + "-" + props.stage, {
      functionName: "lambdadynamoDB" + "-" + props.env.region + "-" + props.stage,
      runtime: lambda.Runtime.NODEJS_20_X,
      code: this.lambdasCode,
      handler: 'dynamodb.handler',
      role: lambdaRole,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    emailTopic.addSubscription(new subscriptions.LambdaSubscription(dynamodbFunction));    

    // ======================================================== Code Deploy =====================================================
   
    // const webcrawlerLambdaApplication = new codedeploy.LambdaApplication(this, 'project3-webcrawler-lambdaapplication' + "-" + props.env.region + "-" + props.stage, {
    //   applicationName: 'project3-webcrawler-lambdaapplication' + "-" + props.env.region + "-" + props.stage
    // })
    
    const webcrawlerAlias = new lambda.Alias(this, 'project3-webcrawler-alias' + "-" + props.env.region + "-" + props.stage, {
      aliasName: props.stage,
      version: webcrawler.currentVersion,
    });

    const webcrawlerDeployment = new codedeploy.LambdaDeploymentGroup(this, 'project3-webcrawler-deployment'+ "-" + props.env.region + "-" + props.stage, {
      // application: webcrawlerLambdaApplication,
      alias: webcrawlerAlias,
      deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_3MINUTES,
      autoRollback: {
        failedDeployment: true, 
        stoppedDeployment: true, 
        deploymentInAlarm: true,
      },
    });

    const webcrawlerAlarmDuration = new Alarm(this, 'webcrawler-alarm-duration'  + "-" + props.env.region + "-" + props.stage, {
      metric: webcrawlerAlias.metricDuration(), 
      evaluationPeriods: 1,
      alarmName: 'webcrawler-alarm-duration' + "-" + props.env.region + "-" + props.stage,
      alarmDescription: 'Alarm for Lambda Duration Metric',
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      threshold: 20000,
    });

    webcrawlerDeployment.addAlarm(webcrawlerAlarmDuration)
  }
}

module.exports = { ApplicationStack }