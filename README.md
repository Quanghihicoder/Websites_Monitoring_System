# Project Overview
In this project, we are providing an AWS cloud-based solution as an application or system for websites monitoring. The application will run on schedule. It will then monitor the list of provided websites and notify the developer whenever a metric breaches the defined threshold. The application involves using CI/CD to automate deployment stages, writing unit and integration tests, storing logs, and automating metrics to roll back deployments.

# Pre-requisites 
Before you begin, ensure you have met the following requirements: 
1. AWS Account: You need an active AWS account. 
2. AWS CDK: Installed globally via npm. 
3. AWS CLI: Installed and configured with access keys.

# Development
The project is developed using AWS CDK and JavaScript programming language. 
Node.js version: v20.13.1 
npm version: 10.5.2 
AWS CLI version: aws-cli/2.17.32 Python/3.11.9 Windows/10 exe/AMD64 
CDK version: 2.152.0

# How to install and run the project
The source code of the project can be found here: 
Quanghihicoder/Websites_Monitoring_System (github.com) 
1. Clone the project  
2. Change the AWS account number in bin/project3.js in line 8 and 13. 
3. Create access keys for IAM account. Run the "aws configure" command to add the credentials. 
4. Create a new GitHub repo in your account and push the code to it. Go to the lines 20-22 in lib/pipeline-stack.js to change the details to match your GitHub repo. 
5. Create GitHub OAuth Token, store it in Sercet Manager from AWS websites. Go to the line 42 in lib/pipeline-stack.js to change the secret name. 
6. Run the following commands. 
7. To test the API Gateway and DynamoDB, go to AWS websites and find the APIs URL. Copy it. Open apis/index.txt, replace the URL, remmember it is ending with /websites. Then run the command from terminal or Postman. With PUT & DELETE add the id in the URL as mentioned in apis/index.txt

# Useful commands
1. `npm install` install libraries 
2. `npm run test -- -u` perform all tests 
3. `cdk synth` emits the synthesized CloudFormation template 
4. `cdk bootstrap` bootstrap, the necessary files for the S3 assets and the necessary roles for the stack 
5. `cdk deploy PipelineStack` deploy the Pipeline stack to your default AWS account/region, the pipeline will deploy other stacks 
6. `cdk destroy --all` destroy all stack deployed

# Main Architecture 
![alt text](https://github.com/Quanghihicoder/Websites_Monitoring_System/blob/master/images/Architecture.png)

# Future Enhancement
![alt text](https://github.com/Quanghihicoder/Websites_Monitoring_System/blob/master/images/Enhancement.png)
Although the project already includes the necessary code for integrating DynamoDB and API Gateway as replacements for S3, we decided not to apply these in our final solution. This decision was based on various factors, including the evaluation of the benefits versus the complexity of making such a transition.

However, in the future, using the API endpoints from DynamoDB and API Gateway into the web crawler function could offer significant advantages. It would enable users to modify the JSON list of websites without needing to access GitHub or change the codebase. Users could easily update the list of target websites, making it more user-friendly and efficient, thereby reducing dependency on developers. 


