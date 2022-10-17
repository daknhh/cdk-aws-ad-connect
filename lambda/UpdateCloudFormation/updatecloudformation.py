"""Lambda function that reports the state machine results back to CFN."""
import json
import requests


def lambda_handler(event, _context):
    """Return a success or failure to the CFN Custom Resource."""
    print(json.dumps(event))
    cfn_url = event["Payload"]["ResponseURL"]
    cfn_stack_id = event["Payload"]["StackId"]
    cfn_request_id = event["Payload"]["RequestId"]
    logical_resource_id = event["Payload"]["LogicalResourceId"]
    data={}

    if(event["Payload"]["CreationStatus"] == "SUCCESS"):
        if('DirectoryId' in event["Payload"]):
            data['DirectoryId']=event["Payload"]["DirectoryId"]

    json_body = {
        "Status": event["Payload"]["CreationStatus"],
        "Reason": event["Payload"]["CreationMessage"],
        "PhysicalResourceId": logical_resource_id,
        "StackId": cfn_stack_id,
        "RequestId": cfn_request_id,
        "LogicalResourceId": logical_resource_id,
        'Data': data
    }
    print(json_body)
    response = requests.put(
        url=cfn_url,
        json=json_body,
    )
