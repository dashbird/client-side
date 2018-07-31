# Dashbird client-side code

This repository contains what is installed to clients AWS account when installing Dashbird. Dashbird relies on CloudWatch log subscriptions to transfer clients observable resources logs into its own system. This solution creates access to Dashbird's AWS account and manages the log group subscripions.

The notable parts of this solution are the **CloudFormation template (stack.yaml)** and a **Lambda function (index.js)**.

## CloudFormation template (example-stack.yaml)

The CloudFormation template contains:

##### Resources
 - `LambdaExecutionRole` - permissions for `SubscriberLambda` to manage subscription filters and log to CloudWatch.
 - `ScheduledRule` - periodic event that triggers `SubscriberLambda`.
 - `SubscriberLambda` - Lambda that manages CloudWatch log group subscriptions and client state.
 - `DashbirdIntegrationRole` - Role that Dashbird uses to list resources to monitor. Contains permissions to access Lambda, CloudWatch and X-ray APIs.
 - `LambdaLogGroup` - Log group for `SubscriberLambda` to log to.
 - `PermissionForEventsToInvokeLambda` - Permission that allows `ScheduledRule` to invoke `SubscriberLambda`.
 
##### Outputs
  - `DashbirdIntegrationRoleArn` - ARN of the `DashbirdIntegrationRole`. This ARN must be copied to Dashbird after stack creation to finish onboarding.
  - `DashbirdIntegrationRoleExternalId` - A unique string to identify clients AWS account.


## Workings of `SubscriberLambda` (index.js)
Triggered periodically, this Lambda requests client status updates from Dashbird API and manages CloudWatch log group subscriptions based on that information. The function also has the task of finalising the onboarding by sending the ARN of `DashbirdIntegrationRole` to Dashbird.


_For edits and suggestions, feel free to create issues to Github or contact support@dashbird.io._
