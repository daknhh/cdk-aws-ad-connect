"""Lambda function used as a custom resource."""

import json
import os
import boto3

sfn_client = boto3.client("stepfunctions")
state_machine_arn = os.environ.get("STATE_MACHINE_ARN")


def lambda_handler(event, _context):
    """Receive an event from CloudFormation, pass it on to a Step Functions State Machine."""
    event_as_json_str = json.dumps(event)
    print(event_as_json_str)
    sfn_client.start_execution(
        stateMachineArn=state_machine_arn,
        input=event_as_json_str,
    )
