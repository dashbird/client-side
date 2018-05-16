'use strict'

const AWS = require('aws-sdk')
const Logs = new AWS.CloudWatchLogs()
const promisify = require('util').promisify
const putSubscriptionFilter = promisify(Logs.putSubscriptionFilter)
const request = require('request-promise')

const DESTINATION_ARN = 'arn:aws:firehose:us-east-1:458024764010:deliverystream/kinesis-consumer-us-east-1'

exports.handler = async function (event, context) {

  // get log groups to subscribe to.
  const client = await request('https://mkhjm850ze.execute-api.us-east-1.amazonaws.com/prod/status?externalId=123')

  if(client.status === 'enabled') {
    for (lambda of client.lambdas) {
      await putSubscriptionFilter({
        destinationArn: DESTINATION_ARN,
        filterName: `dashbird-streamer-${lambda.name}`,
        filterPattern: '-END',
        logGroupName: lambda.logGroup,
        distribution: 'ByLogStream'
      })
      console.log(`subscribed ${lambda.name} to kinesis stream`)
    }
  } else {
    // TODO: remove all subscriptions
  }

  return true;
} 
