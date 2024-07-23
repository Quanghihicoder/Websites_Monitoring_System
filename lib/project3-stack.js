const { Stack, Duration, RemovalPolicy, SecretValue} = require('aws-cdk-lib');
const fs = require('fs')
const path = require('path');
// const synthetics = require('aws-cdk-lib/aws-synthetics')
const s3 = require('aws-cdk-lib/aws-s3')
const s3deployment = require('aws-cdk-lib/aws-s3-deployment')
const iam = require("aws-cdk-lib/aws-iam")
const {Alarm, ComparisonOperator, TreatMissingData, Metric, Stats, MathExpression} = require('aws-cdk-lib/aws-cloudwatch')
const actions = require('aws-cdk-lib/aws-cloudwatch-actions')
const sns = require('aws-cdk-lib/aws-sns')
const subscriptions = require('aws-cdk-lib/aws-sns-subscriptions');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const logs = require("aws-cdk-lib/aws-logs")
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
const eventstargets = require('aws-cdk-lib/aws-events-targets');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');

class Project3Stack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // ======================================================== Variables =====================================================
    const metricNameSpace = "MonitorWebsites";
    const metricLatencyName = "PageExecutionTime";
    const metricAvailabilityName = "PageAvailability";
    const metricBrokenLinksName = "PageBrokenLinks";
    
    const githubRepo = "TIP_project3";
    const githubOwner = "Quanghihicoder";
    const githubBranch = "temp";

    // ======================================================== S3 =====================================================
    const assetsBucket = new s3.Bucket(this, 'project3-canary-bucket', {
      bucketName: 'project3-canary-bucket',
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Uncomment after run "cdk deploy" command and push to git to test the pipeline
    const testBucket = new s3.Bucket(this, 'project3-test-bucket', {
      bucketName: 'project3-test-bucket',
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


    // const canary = new synthetics.Canary(this, "canary", {
    //   canaryName: 'canary',
    //   artifactsBucketLocation: {bucket: assetsBucket},
    //   role: canaryRole,
    //   schedule:synthetics.Schedule.rate(Duration.minutes(5)),
    //   runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_7_0,
    //   test: synthetics.Test.custom({
    //     code: synthetics.Code.fromAsset(path.join(__dirname, '../src/canaries/')),
    //     handler: 'index.handler',
    //   }),
    //   environmentVariables: {
    //     BUCKET: assetsBucket.bucketName,
    //     METRIC_NAMESPACE: metricNameSpace,
    //     METRIC_LATENCY_NAME: metricLatencyName,
    //     METRIC_AVAILABILITY_NAME: metricAvailabilityName,
    //     METRIC_BROKENLINKS_NAME: metricBrokenLinksName
    //   },
    // })

    // canary.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const logGroup = new logs.LogGroup(this, 'canary-log-group', {
      logGroupName: "canary-log-group",
      removalPolicy: RemovalPolicy.DESTROY
    });

    const canary = new lambda.Function(this, 'canary', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambdas')),
      handler: 'canary.handler',
      role: canaryRole,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY
      },
      loggingFormat: lambda.LoggingFormat.JSON,
      systemLogLevelV2: lambda.SystemLogLevel.INFO,
      applicationLogLevelV2: lambda.ApplicationLogLevel.INFO,
      logGroup: logGroup,
      timeout: Duration.seconds(30),
      environment: {
        BUCKET: assetsBucket.bucketName,
        METRIC_NAMESPACE: metricNameSpace,
        METRIC_LATENCY_NAME: metricLatencyName,
        METRIC_AVAILABILITY_NAME: metricAvailabilityName,
        METRIC_BROKENLINKS_NAME: metricBrokenLinksName,
      },
    });

    const canaryLambdaEvent = new events.Rule(this,'canary-lambda-event',{
      description: "Canary run every 5 mins",
      targets: [new eventstargets.LambdaFunction(canary)],
      schedule: events.Schedule.rate(Duration.minutes(5)),
    });
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

    // ======================================================== SNS topics =====================================================

    const emailTopic = new sns.Topic(this, 'email-topic', {
      displayName: 'email-topic',
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
    
    const table = new dynamodb.Table(this, 'WebsiteMonitoringTable', {
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
   
    const lambdaRole = new iam.Role(this, 'lambda-dynamodb-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Lambda IAM Role for DynamoDB',
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

    const dynamodbFunction = new lambda.Function(this, 'DynamoDBLambda', {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambdas')),
        handler: 'dynamodb.handler',
        role: lambdaRole,
        environment: {
            TABLE_NAME: table.tableName,
        },
    });

    emailTopic.addSubscription(new subscriptions.LambdaSubscription(dynamodbFunction));    

    // ======================================================== Pipeline =====================================================
    // Bucket for pipeline
    const pipelineBucket = new s3.Bucket(this, 'project3-pipeline-bucket', {
      bucketName: 'project3-pipeline-bucket',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    /* ---------- Artifacts ---------- */
    // Webhooks are also automatically triggered when an event occurs, 
    // whereas polling is set up to run at fixed intervals and runs whether there is a new event or not.
    const sourceArtifacts = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "Source",
      owner: githubOwner,
      repo: githubRepo,
      branch: githubBranch,
      oauthToken: SecretValue.secretsManager("GitHubToken"),
      output: sourceArtifacts,
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK
    })

    // Build
    const buildProject = new codebuild.PipelineProject(this, 'project3-cicd-build-project', {
      buildSpec: codebuild.BuildSpec.fromObject({
          "version": 0.2,
          "phases": {
            "install": {
              "runtime-versions": {
                "nodejs": 20
              },
              "commands": [
                "npm install"
              ]
            },
            "build": {
              "on-failure": "ABORT",
              "commands": [
                "npm run cdk synth"
              ]
            }
          },
          "artifacts": {
            "base-directory": "cdk.out",
            "files": ["*.template.json"],
          },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
      },
      projectName: 'project3-cicd-build-project'
    });

    const buildArtifacts = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      input:sourceArtifacts,
      project: buildProject,
      outputs: [buildArtifacts]
    });

    // Test
    const testProject = new codebuild.PipelineProject(this, 'project3-cicd-test-project', {
      buildSpec: codebuild.BuildSpec.fromObject({
          "version": 0.2,
          "phases": {
            "install": {
              "runtime-versions": {
                "nodejs": 20
              },
              "commands": [
                "npm install"
              ]
            },
            "build": {
              "on-failure": "ABORT",
              "commands": [
                "npm run test -- -u"
              ]
            }
          }
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
      },
      projectName: 'project3-cicd-test-project'
    });

    const testAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Test',
      input: sourceArtifacts,
      project: testProject,
    });

    // Manual Approval
    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Review',
      additionalInformation: 'Code Review',
    });
    
    // Deploy Infrastructure
    const deployAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'CloudFormationCreateUpdate',
      stackName: props.stackName,
      adminPermissions: true,
      templatePath: buildArtifacts.atPath('Project3Stack.template.json'),
      });

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'project3-cicd-pipeline', {
      pipelineName: 'project3-cicd-pipeline',
      artifactBucket: pipelineBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction]
        }, {
          stageName: 'Build',
          actions: [buildAction]
        }, {
          stageName: 'Test',
          actions: [testAction]
        },{
          stageName: 'ManualApproval',
          actions: [manualApprovalAction]
        }, {
          stageName: 'DeployInfrastructure',
          actions: [deployAction]
        }
      ]
    });
  }
}

module.exports = { Project3Stack }