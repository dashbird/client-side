'use strict'

const AWS = require('aws-sdk')
const CWLogs = new AWS.CloudWatchLogs()
const promisify = require('util').promisify
const putSubscriptionFilter = promisify(CWLogs.putSubscriptionFilter)
const request = require('request-promise')

exports.handler = async function (event, context) {

  const client = await request('https://mkhjm850ze.execute-api.us-east-1.amazonaws.com/prod/status?externalId=123')

  if(client.status === 'enabled') {
    for (lambda of client.lambdas) {
      await putSubscriptionFilter({
        destinationArn: lambda.destination,
        filterName: `dashbird-streamer-${lambda.name}`,
        filterPattern: '-END',
        logGroupName: lambda.name,
        distribution: 'ByLogStream'
      })
      console.log(`subscribed ${lambda.name} to kinesis stream`)
    }
  } else {
    // TODO: remove all subscriptions
  }

  return true;
} 
