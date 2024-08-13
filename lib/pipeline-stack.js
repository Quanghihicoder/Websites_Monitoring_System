const { Stack, RemovalPolicy, SecretValue} = require('aws-cdk-lib');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');
const s3 = require('aws-cdk-lib/aws-s3');
const { PolicyStatement } = require('aws-cdk-lib/aws-iam');

class PipelineStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // ======================================================== Variables =====================================================
    const githubRepo = "Websites_Monitoring_System";
    const githubOwner = "Quanghihicoder";
    const githubBranch = "temp";

    // ======================================================== Pipeline =====================================================
    // Bucket for pipeline
    const pipelineBucket = new s3.Bucket(this, 'PipelineBucket', {
      bucketName: 'webcrawler-pipeline-bucket',
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
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
      oauthToken: SecretValue.secretsManager("GitHub"),
      output: sourceArtifacts,
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK
    })

    // Build CDK
    const buildCDKProject = new codebuild.PipelineProject(this, 'BuildProject', {
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
      projectName: 'build-project'
    });

    const buildCDKArtifacts = new codepipeline.Artifact();
    const buildCDKAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      input:sourceArtifacts,
      project: buildCDKProject,
      outputs: [buildCDKArtifacts],
      runOrder: 1
    });

    // Build Lambda
    const buildLambdaProject = new codebuild.PipelineProject(this, 'project3-cicd-build-lambda-project', {
        buildSpec: codebuild.BuildSpec.fromObject({
            "version": 0.2,
            "phases": {
              "install": {
                "runtime-versions": {
                    "nodejs": 20
                },
                "commands": [
                    'cd src',
                    'cd lambdas',
                ]
              },
            },
            "artifacts": {
              "base-directory": "src/lambdas",
              "files": ["*.js"],
            },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
        },
        projectName: 'project3-cicd-build-lambda-project'
    });
  
    const buildLambdaArtifacts = new codepipeline.Artifact();
    const buildLambdaAction = new codepipeline_actions.CodeBuildAction({
        actionName: "BuildLambda",
        input: sourceArtifacts,
        project: buildLambdaProject,
        outputs: [buildLambdaArtifacts],
        runOrder: 2
    });

    // Test
    const testProject = new codebuild.PipelineProject(this, 'TestProject', {
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
      projectName: 'test-project'
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
    
    // Deploy Beta Action
    const deployBetaAction = new codepipeline_actions.CloudFormationDeployStackSetAction({
      actionName: 'DeployBeta',
      stackSetName: props.betaApplicationStack.stackName,
      adminPermissions: true,
      // templatePath:  buildCDKArtifacts.atPath(`${props.betaApplicationStack.stackName}.template.json`),
      template: codepipeline_actions.StackSetTemplate.fromArtifactPath(buildCDKArtifacts.atPath(`${props.betaApplicationStack.stackName}.template.json`))
      // extraInputs: [buildLambdaArtifacts],
    })
    // Deploy Prod Action
    const deployProdAction = new codepipeline_actions.CloudFormationDeployStackSetAction({
        actionName: 'DeployProd',
        stackSetName: props.prodApplicationStack.stackName,
        adminPermissions: true,
        // templatePath:  buildCDKArtifacts.atPath(`${props.prodApplicationStack.stackName}.template.json`),
        template: codepipeline_actions.StackSetTemplate.fromArtifactPath(buildCDKArtifacts.atPath(`${props.prodApplicationStack.stackName}.template.json`))
        // extraInputs: [buildLambdaArtifacts],
    })

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'pipeline',
      artifactBucket: pipelineBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction]
        }, {
          stageName: 'Build',
          actions: [buildCDKAction]
        }, 
        // {
        //   stageName: 'Test',
        //   actions: [testAction]
        // },
        {
          stageName: 'DeployBeta',
          actions: [deployBetaAction]
        },
        // {
        //   stageName: 'ManualApproval',
        //   actions: [manualApprovalAction]
        // }, 
        {
          stageName: 'DeployProduction',
          actions: [deployProdAction]
        }
      ]
    });

    pipeline.addToRolePolicy(new PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${props.env.account}:role/*`]
    }))
  }
}

module.exports = { PipelineStack }
