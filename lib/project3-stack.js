const synthetics = require('aws-cdk-lib/aws-synthetics')
const path = require('path')

const { Stack, Duration } = require('aws-cdk-lib');
// const sqs = require('aws-cdk-lib/aws-sqs');

class Project3Stack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here

   const canary = new synthetics.Canary(this, 'MyCanary', {
  canaryName: 'heart-beat-canary',  
  schedule: synthetics.Schedule.rate(Duration.minutes(1)),
  test: synthetics.Test.custom({    
    code: synthetics.Code.fromAsset(path.join(__dirname, '../src/canaries/')),
    handler: 'index.handler',
  }),
  runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
  
});
  }
}

module.exports = { Project3Stack }
