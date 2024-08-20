const { Stack, RemovalPolicy, SecretValue, DefaultStackSynthesizer} = require('aws-cdk-lib');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');
const s3 = require('aws-cdk-lib/aws-s3');
const { PolicyStatement } = require('aws-cdk-lib/aws-iam');
const iam = require("aws-cdk-lib/aws-iam")

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
    const githubBranch = "master";

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

    // Build
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      buildSpec: codebuild.BuildSpec.fromObject({
          "version": 0.2,
          "phases": {
            "install": {
              "runtime-versions": {
                "nodejs": 20
              },
              "commands": [
                "npm install",
                "npm install -g cdk-assets@2"              ]
            },
            "build": {
              "on-failure": "ABORT",
              "commands": [
                "npm run cdk synth"
              ]
            },
            "post_build": {
              "commands": [
                "for FILE in cdk.out/*.assets.json; do cdk-assets -p $FILE publish; done"
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

    const assetsPublishingPermissions = new iam.PolicyStatement({
      sid: "extraPermissionsRequiredForPublishingAssets",
      effect: iam.Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: props.prodApplicationStacks.map(stack => `arn:aws:iam::${props.env.account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-file-publishing-role-${props.env.account}-${stack.region}`)
    });

    // attach the permission to the role created with 'buildjob'
    buildProject.addToRolePolicy(assetsPublishingPermissions);

    const buildArtifacts = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      input:sourceArtifacts,
      project: buildProject,
      outputs: [buildArtifacts],
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

    // Deploy Actions for multiple regions
    const deployBetaActions = props.betaApplicationStacks.map((stack,index) => new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: `DeployBeta-${stack.region}`,
      stackName: stack.stackName,
      adminPermissions: true,
      templatePath: buildArtifacts.atPath(`${stack.stackName}.template.json`),
      region: stack.region,
      runOrder: index + 1
    }));

    const deployProdActions = props.prodApplicationStacks.map((stack,index) => new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: `DeployProd-${stack.region}`,
      stackName: stack.stackName,
      adminPermissions: true,
      templatePath: buildArtifacts.atPath(`${stack.stackName}.template.json`),
      region: stack.region,
      runOrder: index + 1
    }));

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
          actions: [buildAction]
        }, 
        // {
        //   stageName: 'Test',
        //   actions: [testAction]
        // },
        {
          stageName: 'DeployBeta',
          actions: deployBetaActions
        },
        {
          stageName: 'ManualApproval',
          actions: [manualApprovalAction]
        }, 
        {
          stageName: 'DeployProduction',
          actions: deployProdActions
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
