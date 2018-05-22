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

    promises = _.map(regionGroups, async (logGroups, region) => {
      let CWLogs = new AWS.CloudWatchLogs({
        region: region
      })

      return processLogGroups(CWLogs, logGroups)
    })
  } else {
    promises.push(updateRoleArn())
  }

  await Promise.all(promises)

  return true
}

async function updateRoleArn () {
  return request({
    method: 'POST',
    uri: `${BASE_URL}/${externalId}/delegation`,
    body: {
      roleArn: roleArn
    },
    json: true
  })
}

async function processLogGroups (client, groups) {
  const requests = _.map(groups, (observable) => {
    if (observable.action.toLowerCase() === 'upsert') {
      return upsertObservable(client, observable)
    } else {
      return removeObservable(client, observable)
    }
  })
  return Promise.all(requests)
}

async function upsertObservable (client, observable) {
  try {
    let existingFilters = await client.describeSubscriptionFilters({
      logGroupName: observable.logGroup
    }).promise()
    if (existingFilters.subscriptionFilters.length > 0) {
      let isDashbirdFilter = _.some(existingFilters.subscriptionFilters, (filter) => filter.destinationArn.indexOf('458024764010') !== -1)
      if (isDashbirdFilter) {
        return putObservable(client, observable)
      }
    } else {
      return putObservable(client, observable)
    }
  } catch (ex) {
    // Ignroe ResourceNotFoundException
    if (ex.code !== 'ResourceNotFoundException') {
      console.log(`Could not import extId ${externalId} logGroup ${observable.logGroup} with exception ${ex.toString()}`)
    }
  }
}

async function putObservable (client, observable) {
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
        success: true
      }
    })
  })
}

async function removeObservable (client, observable) {
  return client.deleteSubscriptionFilter({
    filterName: observable.region,
    logGroupName: observable.logGroup
  }).promise()
}
