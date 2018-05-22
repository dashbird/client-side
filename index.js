'use strict'

const AWS = require('aws-sdk')
AWS.config.setPromisesDependency(null);
const CWLogs = new AWS.CloudWatchLogs()
const request = require('request-promise')

exports.handler = async function (event, context) {

  console.log('request')
  // const client = await request('https://mkhjm850ze.execute-api.us-east-1.amazonaws.com/prod/status?externalId=123')
  const client = {
    status: 'enabled',
    lambdas: [{
      region: 'us-east-1',
      logGroup: '/aws/lambda/random',
      destination: 'arn:aws:logs:us-east-1:458024764010:destination:dashbird-us-east-1'
    },
    {
      region: 'us-east-1',
      logGroup: '/aws/lambda/whats-my-ip',
      destination: 'arn:aws:logs:us-east-1:458024764010:destination:dashbird-us-east-1'
    }]
  }
  console.log('request', JSON.stringify(client, null, 4))

  if(client.status === 'enabled') {
    for (const lambda of client.lambdas) {
      console.log(`subscribing ${lambda.logGroup} ${lambda.destination}`)
      await CWLogs.putSubscriptionFilter({
        destinationArn: lambda.destination,
        filterName: lambda.region,
        filterPattern: '-END',
        logGroupName: lambda.logGroup,
        distribution: 'ByLogStream'
      }).promise()
      console.log(`subscribed ${lambda.logGroup} to kinesis stream`)
    }
  } else {
    // TODO: remove all subscriptions
  }

  return true;
} 
