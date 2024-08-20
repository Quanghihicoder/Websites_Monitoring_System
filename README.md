# Welcome to your Cloud Development project

This project focuses on developing a website monitoring application on AWS that integrates Continuous Integration and Continuous Deployment (CI/CD) practices to automate the deployment pipeline through multiple stages.

## Table of Contents
1. [Project Overview](#Project)
2. [System Architecture](#System)
3. [About this Repository](#About)
4. [Pre-requisites](#Pre)
5. [Getting Started](#Getting)
6. [Customizing the Deployment](#Customizing)
7. [CloudWatch Alarms](#CloudWatch)
8. [Persist Alarm data to DynamoDB](#Persist)
9. [Unit and Integration Testing](#Unit)
10. [Resources Used](#Resources)
11. [Contact](#Contact)
12. [License](#License)


## Project Overview
This project aims to build a robust website monitoring application on AWS. By leveraging CI/CD practices, the application automates the deployment pipeline through multiple stages (Beta and Production). The core functionality includes monitoring public websites, triggering alarms when performance metrics exceed defined thresholds and persisting alarm data in DynamoDB for further analysis. Additionally, the system ensures operational health with automated metrics, logging and rollbacks in case of service degradation.

## System Architecture
The application is designed using AWS services such as Lambda, CloudWatch, SNS, DynamoDB, and the AWS Cloud Development Kit (CDK). The system architecture consists of:

* Website Monitoring: A Lambda function runs periodically to check a list of websites.
* Metrics Collection: CloudWatch collects metrics such as latency and availability.
* Alarm Triggering: Alarms are triggered based on predefined thresholds.
* Notification: SNS sends emails to subscribed email addresses.
* Data Persistence: Alarm data is stored in DynamoDB for further analysis.
* Code Deployment: Automatic deployment using CI/CD pipeline and rollback mechanism in depployment failures.

## About this Repository
 By using AWS Cloud Development Kit (CDK), the application will monitor a set of public websites which are stored in a JSON file in a s3 bucket. Monitoring will be done based on pre defined metrics to measure their performance and availability. If the metrics breach the defined threshold values, alarms will be triggered and the notifications will be sent to the subscribed email addresses. The alarm details will then be persisted to a DynamoDB table for further analysis. And the code will be build and deploy in several stages, and the system will incorporate automated metrics, logging, and alarms to maintain operational health and facilitate automated rollbacks in the event of service degradation. 

## Pre-requisites
Before you begin, ensure you have met the following requirements:

* AWS Account: You need an active AWS account.
* AWS CDK: Installed globally via npm.
* AWS CLI: Installed and configured with appropriate permissions.

## Getting Started

* Clone the Repository

```bash 
git clone https://github.com/Quanghihicoder/TIP_project3/
```
* Install Dependencies

```bash 
npm install
```
* Deploy the Pipeline Stack

```bash 
cdk deploy PipelineStack
```
## Customizing the Deployment
Modify the list of monitored URLs or change metric thresholds by editing the appropriate JSON or configuration files.

## CloudWatch Alarms

The application includes several CloudWatch alarms that monitor the given list of public URL's based on predefined metrics.

* Metrics and Thresholds

| Metric | Threshold Comparison |
| ------ | --------- |
| Availability  | less than 1 |
| Latency  | greater than 800ms |

* Alarm Triggering Flow

1. Metric Monitoring: CloudWatch monitors the specified metrics every five minutes.
2. Execution: The code will iterate for the set of URL's in the JSON file to monitor the metrics. 
3. Alarm Activation: When a metric crosses the defined threshold, the respective CloudWatch alarm is activated.

* How it Works

1. CloudWatch Monitors Metrics: CloudWatch monitors metrics associated with the webcrawler Lambda function.
2. Alarm Triggers: Alarms are triggered based on predefined thresholds.

* Libraries Required

-- Install the aws-cdk-lib Package: If you have not installed the AWS CDK library yet, you can add it to your project using npm (Node Package Manager). Run the following command in your project directory:

```bash 
npm install aws-cdk-lib 
```

-- Import the Required Components:Once the aws-cdk-lib package is installed, you can import the required components (Alarm, ComparisonOperator, and TreatMissingData) from the aws-cloudwatch module as follows:

```bash 
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
```

* Application Deployment

1. Deploy the pipeline stack by running 'cdk deploy PipelineStack'.
2. Wait until the pipeline deployment succeeds, which may take up to 10 minutes.

* Usage

1. Log in to the AWS Management Console and navigate to the CloudWatch component.
2. Go to 'All alarms'.
3. Created alarms will be displayed under 'All alarms'.
4. When the metric thresholds are breached, the alarms will be displayed under the 'In Alarm' section.

* Troubleshooting

1. Deployment Issues: Ensure that all AWS CLI commands are configured correctly and that you have sufficient IAM permissions.
2. Lambda Errors: Check the CloudWatch logs associated with the Lambda functions for any errors or stack traces.

# Persist Alarm data to DynamoDB

* How it Works

When alarms are triggered, they change the alarm status to “in alarm” and notify the administrators via a notification service (SNS). This SNS topic will then trigger a Lambda function based on events, and the alarm details will be persisted to a DynamoDB table through the Lambda function.

* Libraries Required

-- Install the aws-cdk-lib Package: If you haven't installed the AWS CDK library yet, you can add it to your project using npm (Node Package Manager). Run the following command in your project directory:

```bash
 npm install aws-cdk-lib
 ```

-- Import the Required Components:You should import following components from the AWS modules.

```bash 
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const logs = require('aws-cdk-lib/aws-logs');
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
```

* Application Deployment
1. If you are running the code in your branch, enter the command 'cdk deploy PipelineStack' to deploy the pipeline.
2. Wait until pipeline deployment success. It may get upto 10 minutes to deploy.

```bash 
cdk deploy PipelineStack
```
3. 

* Usage
1. Log in into AWS management console and go to CloudWatch component.
2. When the metrics threshold breached and alarms riggered, they will be display under 'In Alarm' section of the CloudWatch Alarms.
3. Go to DynamoDB component and load the tables.
4. Select the table and click 'Explore items'.
5. Alarm data related to the triggered alarm will be available in the table.

# Unit and Integration Testing

* Unit Testing 
In unit testing individual units of the application code will be tested to ensure that the resources and their properties 
align with the CloudFormation template.

* Integration Testing
Integration testing involves validating that various AWS services (like Lambda, DynamoDB, CloudWatch, SNS, and CloudFormation) interact correctly and perform as expected when combined in the deployed application.

* Libraries Required
-- Install the aws-cdk-lib Package: If you haven't installed the AWS CDK library yet, you can add it to your project using npm (Node Package Manager). Run the following commands in your project directory:

```bash
 npm install aws-cdk-lib
 npm install aws-sdk-client-mock
 npm install @aws-sdk/client-cloudformation @aws-sdk/client-lambda @aws-sdk/client-cloudwatch @aws-sdk/client-sns
```

-- Import the Required Components:You should import following components from the AWS modules.

```bash
 const { Template } = require('aws-cdk-lib/assertions');
 const { CloudFormationClient, DescribeStacksCommand } = require("@aws-sdk/client-cloudformation");
 const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
 const { CloudWatchClient, DescribeAlarmsCommand } = require("@aws-sdk/client-cloudwatch");
 const { SNSClient, ListSubscriptionsByTopicCommand } = require("@aws-sdk/client-sns");
 ```

* Usage

Execute the following command to execute the unit test cases in your local repository.
```bash
npm test
```
In pipeline process unit and integration test suites will be executed before the deployment.If the unit and integration tests get failed, deployment will be failed.

* Output

Output will appear like below if all the testcases are successfully executed.

```bash
  project3@0.1.0 test 
  jest 
 
  PASS  test/application.test.js (9.649 s) 
  PASS  test/pipeline.test.js (11.234 s) 
  PASS  test/dynamodb.test.js (12.989 s) 
  PASS  test/alarms.test.js (14.656 s) 
  PASS  test/webcrawler.test.js (24.268 s)'

 Test Suites: 5 passed, 5 total 
 Tests:       28 passed, 28 total 
 Snapshots:   0 total 
 Time:        25.98 s 
 Ran all test suites. 
 ```

## Resources Used
- [Developer Guide](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [API Reference](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-construct-library.html)
- [CDK Repository](https://github.com/aws/aws-cdk)
- [CDK Construct Hub](https://constructs.dev/)

## Contact
For more information or assistance, feel free to reach out to 104768276@student.swin.edu.au

## License
This library is licensed under the SwinburneUniversity License.