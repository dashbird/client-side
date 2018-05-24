'use strict'

const AWS = require('aws-sdk')
const request = require('request-promise')
const _ = require('lodash')
const Promise = require('bluebird')

const externalId = process.env.EXTERNAL_ID
const roleArn = process.env.DASHBIRD_ROLE_ARN
const BASE_URL = 'https://configuration.dashbird.io/aws/cloudwatch'

exports.handler = async function (event, context) {
  const client = await request({
    method: 'GET',
    uri: `${BASE_URL}/${externalId}/loggroup`,
    json: true
  })

  let promises = []

  if (client.status.toLowerCase() === 'active') {
    let regionGroups = _.groupBy(client.observables, (o) => o.region)
    console.log(`Client is active, processing ${client.observables.length} observables.`)

    promises = _.map(regionGroups, async (logGroups, region) => {
      let CWLogs = new AWS.CloudWatchLogs({
        region: region
      })

      return processLogGroups(CWLogs, logGroups)
    })
  } else {
    promises.push(updateRoleArn())
  }

  Promise.all(promises)

  return true
}

async function updateRoleArn() {
  return request({
    method: 'POST',
    uri: `${BASE_URL}/${externalId}/delegation`,
    body: {
      roleArn: roleArn
    },
    json: true
  })
}

async function processLogGroups(client, groups) {
  const requests = _.map(groups, (observable) => {
    if (observable.action.toLowerCase() === 'upsert') {
      console.log(`Upserting`, observable)
      return upsertObservable(client, observable)
    } else {
      console.log(`Removing`, observable)
      return removeObservable(client, observable)
    }
  })
  return Promise.all(requests)
}

async function upsertObservable(client, observable) {
  return client.describeSubscriptionFilters({
    logGroupName: observable.logGroup
  }).promise().then((existingFilters) => {
    if (existingFilters.subscriptionFilters.length > 0) {
      let isDashbirdFilter = _.some(existingFilters.subscriptionFilters, (filter) => filter.destinationArn.indexOf('458024764010') !== -1)
      if (isDashbirdFilter) {
        return putObservable(client, observable)
      } else {
        console.log(`Log group ${observable.logGroup} has a subscription filter belonging to someone else, skipping.`)
      }
    } else {
      return putObservable(client, observable)
    }
  }, (err) => {
    return logGroupError(err, observable);
  })
}

async function logGroupError(err, observable) {
  console.log(`Reporting error`, err.code, `\nwith observable`, observable);
  let body = {
    action: observable.action,
    status: 'FAIL',
    error: err.code === 'ResourceNotFoundException' ? err.code : null
  }

  return request({
    method: 'POST',
    uri: `${BASE_URL}/${externalId}/loggroup/${observable.id}`,
    json: true,
    body: body
  })
}

async function putObservable(client, observable) {
  console.log(`Adding subscription filter to log group ${observable.logGroup} with filter name ${observable.region}`)

  return client.putSubscriptionFilter({
    destinationArn: observable.destination,
    filterName: observable.region,
    filterPattern: '-END',
    logGroupName: observable.logGroup,
    distribution: 'ByLogStream'
  }).promise().then(() => {
    return request({
      method: 'POST',
      uri: `${BASE_URL}/${externalId}/loggroup/${observable.id}`,
      json: true,
      body: {
        action: observable.action,
        status: 'SUCCESS',
        error: null
      }
    })
  })
}

async function removeObservable(client, observable) {
  console.log(`Removing log group ${observable.logGroup} with filter name ${observable.region}`)

  return client.deleteSubscriptionFilter({
    filterName: observable.region,
    logGroupName: observable.logGroup
  }).promise().catch((err) => {
    return logGroupError(err, observable)
  });
}
