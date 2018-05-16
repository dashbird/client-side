'use strict'

const AWS = require('aws-sdk')
const Logs = new AWS.CloudWatchLogs()
const promisify = require('util').promisify
const putSubscriptionFilter = promisify(Logs.putSubscriptionFilter)

exports.handler = async function (event, context) {

  // get log groups to subscribe to.
 
  const params = {
    destinationArn: 'arn:aws:firehose:us-east-1:458024764010:deliverystream/kinesis-consumer-us-east-1',
		filterName: 'dashbird-streamer-random',
		filterPattern: '-END',
		logGroupName: 'STRING_VALUE',
		distribution: 'ByLogStream'
  }

  await putSubscriptionFilter(params)
  console.log('subscribed to stream')
  return true;
} 
