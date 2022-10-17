import boto3
import json

def lambda_handler(event, _context):
    event = event["Payload"]
    if("DirectoryId" in event.keys() or "Payload" in event.keys()):
        print(event.keys())
        if("DirectoryId" in event.keys()):
            DirectoryId = event["DirectoryId"]
        elif("Payload" in event.keys()):
            DirectoryId = event["Payload"]["DirectoryId"]
        ds_client = boto3.client('ds')
        response = ds_client.describe_directories(
            DirectoryIds=[
                DirectoryId
            ],
        )
        print(response['DirectoryDescriptions'])
        if(response['DirectoryDescriptions'] == []):
            event["CreationStatus"] = "SUCCESS"
            event["CreationMessage"] = "Resource Created / or Deleted"
            print(f"Return {event}")
            return event
        else:
            directory_status = response['DirectoryDescriptions'][0]['Stage']
            print(f"🧪 Status: {directory_status}")
            if(directory_status == 'Deleted' or directory_status == 'Active'):
                event["CreationStatus"] = "SUCCESS"
                event["CreationMessage"] = "Resource Created / or Deleted"
                print(f"Return {event}")
                return event
            if(directory_status != 'Deleted' or directory_status != 'Active'):
                if(directory_status == 'Inoperable' or directory_status == 'Failed' or directory_status == 'Impaired' or directory_status == 'RestoreFailed'):
                    event["CreationStatus"] = "FAILED"
                    event["CreationMessage"] = "Resource Problem!"
                    return event
                else:
                    event["CreationStatus"] = "INPROGRESS"
                    event["CreationMessage"] = "Waiting to be finished"
                    return event
    else:
        event["CreationStatus"] = "FAILED"
        event["CreationMessage"] = "Resource Problem!"
        return event