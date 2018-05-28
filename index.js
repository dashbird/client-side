'use strict'

const AWS = require('aws-sdk')
const request = require('request-promise')
const _ = require('lodash')
const Promise = require('bluebird')

const EXTERNAL_ID = process.env.EXTERNAL_ID
const ROLE_ARN = process.env.DASHBIRD_ROLE_ARN
const BASE_URL = 'https://configuration.dashbird.io/aws/cloudwatch'

async function updateRoleArn () {
  const response = await request({
    method: 'POST',
    uri: `${BASE_URL}/${EXTERNAL_ID}/delegation`,
    json: true,
    body: { roleArn: ROLE_ARN }
  })

  if (response.status === 'OK') {
    console.log('Set role arn, exiting with failure')
    throw new Error('role arn set, retrying')
  }
}

async function processLogGroups (client, groups) {
  const requests = _.map(groups, async (observable) => {
    try {
      let result = null
      if (observable.action.toLowerCase() === 'upsert') {
        console.log(`Upserting`, observable)
        result = await upsertObservable(client, observable)
      } else {
        console.log(`Removing`, observable)
        result = await removeObservable(client, observable)
      }
      if (result) {
        return logGroupSuccess(observable)
      }
    } catch (error) {
      return logGroupError(error, observable)
    }
  })
  return Promise.all(requests)
}

async function upsertObservable (client, observable) {
  const existingFilters = await client.describeSubscriptionFilters({
    logGroupName: observable.logGroup
  }).promise()
  const isDashbirdFilter = _.find(existingFilters.subscriptionFilters, (filter) => filter.destinationArn.includes('458024764010'))

  if (!existingFilters.subscriptionFilters.length || isDashbirdFilter) {
    return putObservable(client, observable)
  } else {
    console.log(`Log group ${observable.logGroup} has a subscription filter belonging to someone else, skipping.`)
  }
}

async function logGroupError (err, observable) {
  console.log(`Reporting error`, err.code, `with observable`, observable)
  const body = {
    action: observable.action,
    status: 'FAIL',
    error: err.code === 'ResourceNotFoundException' ? err.code : null
  }

  return request({
    method: 'POST',
    uri: `${BASE_URL}/${EXTERNAL_ID}/loggroup/${observable.id}`,
    json: true,
    body: body
  })
}

async function logGroupSuccess (observable) {
  console.log('Posting results about observable', observable)
  return request({
    method: 'POST',
    uri: `${BASE_URL}/${EXTERNAL_ID}/loggroup/${observable.id}`,
    json: true,
    body: {
      action: observable.action,
      status: 'SUCCESS',
      error: null
    }
  })
}

async function putObservable (client, observable) {
  console.log(`Adding subscription filter to log group ${observable.logGroup} with filter name ${observable.region}`)

  return client.putSubscriptionFilter({
    destinationArn: observable.destination,
    filterName: observable.region,
    filterPattern: '-END',
    logGroupName: observable.logGroup,
    distribution: 'ByLogStream'
  }).promise()
}

async function removeObservable (client, observable) {
  console.log(`Removing log group ${observable.logGroup} with filter name ${observable.region}`)

  return client.deleteSubscriptionFilter({
    filterName: observable.region,
    logGroupName: observable.logGroup
  }).promise()
}

async function processAllLogGroups (observables) {
  let regionGroups = _.groupBy(observables, (o) => o.region)
  console.log(`Client is active, processing ${observables.length} observables.`)

  const promises = _.map(regionGroups, async (logGroups, region) => {
    const CWLogs = new AWS.CloudWatchLogs({ region: region })
    return processLogGroups(CWLogs, logGroups)
  })

  return Promise.all(promises)
}

exports.handler = async function (event, context) {
  const client = await request({
    method: 'GET',
    uri: `${BASE_URL}/${EXTERNAL_ID}/loggroup`,
    json: true
  })

  if (client.status.toLowerCase() === 'active') {
    return processAllLogGroups(client.observables)
  }
  return updateRoleArn()
}
