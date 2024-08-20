# Welcome to Websites Monitoring System

## A few steps required

1) Change the account number in bin/project3.js in line 8 and 13.

2) Create access keys for IAM account. Run the "aws configure" command to add the credentials.

3) Create a new GitHub repo in your account and push the code to it. Go to the lines 20-22 in lib/pipeline-stack.js to change the details to match your GitHub repo. 

4) Create GitHub OAuth Token, store it in Sercet Manager from AWS websites. Go to the line 42 in lib/pipeline-stack.js to change the secret name. 

5) Run the following commands.

## Commands
* `npm install`                install libraries
* `npm run test -- -u`         perform all tests
* `cdk synth`                  emits the synthesized CloudFormation template
* `cdk bootstrap`              bootstrap, the necessary files for the S3 assets and the necessary roles for the stack
* `cdk deploy PipelineStack`   deploy the Pipeline stack to your default AWS account/region, the pipeline will deploy other stacks
* `cdk destroy --all`          destroy all stack deployed


