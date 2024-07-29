// Test AWS infrastructure

const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApplicationStack } = require("../lib/application-stack");
const { PipelineStack } = require("../lib/pipeline-stack");

const Sydney = {
  account: "058264550947",
  region: "ap-southeast-2",
};

const app = new cdk.App();
const betaApplicationStack = new ApplicationStack(app, 'BetaApplicationStack', { env: Sydney, stackName: "BetaApplicationStack", stage: 'beta' });
const prodApplicationStack = new ApplicationStack(app, 'ProdApplicationStack', { env: Sydney, stackName: "ProdApplicationStack", stage: 'prod' });

const stack =  new PipelineStack(app, 'PipelineStack', {
  stackName: "PipelineStack",
  betaApplicationStack: betaApplicationStack,
  prodApplicationStack: prodApplicationStack,
  env: Sydney,
});

const template = Template.fromStack(stack);

// ======================================================== Unit/Assertions Test =====================================================

test('Bucket for webcrawler has been created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: "project3-webcrawler-bucket"
    })
})

test('Bucket has correct removal policy', () => {
    template.hasResource('AWS::S3::Bucket', {
      Properties: {
        BucketName: 'project3-webcrawler-bucket'
      },
      DeletionPolicy: 'Delete' // This checks the `DeletionPolicy` for removal
    })
  })

test('The pipeline has been created', () => {
    template.hasResource("AWS::CodePipeline::Pipeline", "");
})

test('S3 Bucket for pipeline has been created', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'project3-pipeline-bucket',
        VersioningConfiguration: {
            Status: 'Enabled',
        },
  })
})

test('S3 Bucket Deployment Configured', () => {
    template.resourceCountIs('Custom::CDKBucketDeployment', 1);
})

test('SSM Parameter for webcrawler-assets-bucket-location has been created', () => {
    //template.hasResourceProperties('AWS::SSM::Parameter', {
    //  Name: 'webcrawler-assets-bucket-location',
})

/*
test('GitHub Source Action has been created', () => {
  template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: [
          {
              Name: "Source",
              Actions: [
                 {                   
                      Configuration: {
                          Owner: githubOwner,
                          Repo: githubRepo,
                          Branch: githubBranch,
                          OAuthToken: { "Ref": "GitHubToken" },
                          PollForSourceChanges: false
                     }                     
                 }
              ]
          }
      ]
  })
})
*/

test('Build CDK project has been created with correct properties', () => {
    template.hasResourceProperties('AWS::CodeBuild::Project', {
        Name: 'project3-cicd-build-cdk-project', 
        Source: {
            Type: 'CODEPIPELINE',
        },
        Artifacts: {
            Type: 'CODEPIPELINE',
        },
        Environment: {
            ComputeType: 'BUILD_GENERAL1_SMALL',
            Image: 'aws/codebuild/standard:7.0',
            Type: 'LINUX_CONTAINER',
            ImagePullCredentialsType: 'CODEBUILD',
        }  
    })
})
/*
test('CodeBuild Action for BuildCDK has been created with correct actionName', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
            {
                Actions: [
                    {
                        Name: 'BuildCDK',
                        ActionTypeId: {
                            Category: "Build",
                            Owner: "AWS",
                            Provider: "CodeBuild",
                            Version: "1"
                        }
                    }
                ]
            }
        ]
    })
})
*/
test('PipelineProject for Lambda build has been created', () => {
    template.hasResource('AWS::CodeBuild::Project', {
        Properties: {
            Name: 'project3-cicd-build-lambda-project'
        }
    })
})
/*
test('BuildSpec includes correct phases and artifacts', () => {
    template.hasResourceProperties('AWS::CodeBuild::Project', {
        BuildSpec: {
            version: '0.2',
            phases: {
                install: {
                    'runtime-versions': {nodejs: '20'},
                    commands: ['cd src','cd lambdas']
                }
            },
            artifacts: {
                'base-directory': 'src/lambdas',
                files: ['*.js']
            }
        }
    })
})

test('CodeBuild Action has correct actionName', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
            { Actions: [{ Name: "BuildLambda"}]}
        ]
    })
})
*/