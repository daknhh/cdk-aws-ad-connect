import json
import logging
import boto3
from typing import List, Dict, Union, Any
import urllib
import json

logging.getLogger().setLevel(logging.INFO)

def lambda_handler(event, _context: Any) -> None:
    logging.info(json.dumps(event, indent=4))
    ds_client = boto3.client('ds')
    secret_client = boto3.client('secretsmanager')
    if (event['RequestType'] == 'Create'):
        event = create_ad_connect(event, ds_client,secret_client)
        return event
    if(event['RequestType']  == 'Update'):
        event['CreationStatus'] = "SUCCESS"
        event['CreationMessage'] = "Please use create / delete - no update available."
        return event
    if(event['RequestType'] == 'Delete'):
        event = delete_ad_connect(event,ds_client)
        return event
def create_ad_connect(event, ds_client, secret_client):
    #Variables
    Name = event['ResourceProperties']['ad_Name']
    ShortName = event['ResourceProperties']['ad_ShortName']
    Description  = event['ResourceProperties']['ad_Description']
    Size = event['ResourceProperties']['ad_Size']
    VpcId = event['ResourceProperties']['VpcId']
    SubnetIds = event['ResourceProperties']['SubnetIds']
    CustomerDnsIps = event['ResourceProperties']['CustomerDnsIps']
    Secret = event['ResourceProperties']['ad_Secret']
    try:
        Secretvalue = secret_client.get_secret_value(
        SecretId=Secret)
        SecretValueFull = json.loads(Secretvalue['SecretString'])
        password = SecretValueFull['password']
        username = event['ResourceProperties']['ad_ServiceUserName']
    except Exception as e:
        print(f"🚨 Could not connect retrieve secret with the Id: {Secret}! - Error: {e}")
        event['CreationStatus'] = "FAILED"
        event['CreationMessage'] = f"Could not connect retrieve secret with the Id: {Secret}!"
        return event
    try:
        response = ds_client.connect_directory(
        Name=Name,
        ShortName=ShortName,
        Password=password,
        Description=Description,
        Size=Size,
        ConnectSettings={
            'VpcId': VpcId,
            'SubnetIds': SubnetIds.split(","),
            'CustomerDnsIps': CustomerDnsIps.split(","),
            'CustomerUserName': username
        },
        )
        print(f"✅ Successfully create AD-Connector with the Name: {Name}.")
        event['DirectoryId'] = response['DirectoryId']
        return event
    except Exception as e:
        print(f"🚨 Could not connect AD with the Name: {Name}!  - Error: {e}")
        event['CreationStatus'] = "FAILED"
        event['CreationMessage'] = f"Could not connect AD with the Name: {Name}!"
        return event
def delete_ad_connect(event,ds_client):
    try:
        directories = ds_client.describe_directories()
        if(directories['DirectoryDescriptions'] == []):
            print(F"No Directories")
            event['CreationStatus'] = "FAILED"
            event['CreationMessage'] = "No directories!"
            return event
        else:
            for directory in directories['DirectoryDescriptions']:
                if((directory['ShortName']) == event['ResourceProperties']['ad_ShortName']):
                    directory_id = directory['DirectoryId']
                    print(f"Successfully found directory_id for AD-Connector.")
    except Exception as e:
        print(F"🚨 Could not describe directories! - Error {e}")
        event['CreationStatus'] = "FAILED"
        event['CreationMessage'] = "Could not describe directories!"
        return event
    try:
        delete = ds_client.delete_directory(DirectoryId=directory_id)
        print(f"✅ Successfully deleted AD-Connector with the Id: {directory_id}.")
        event['DirectoryId'] = delete['DirectoryId']
        return event
    except Exception as e:
        print(f"🚨 Could not delete directory! - Error {e}")
        event['CreationStatus'] = "FAILED"
        event['CreationMessage'] = "Could not delete directory!"
        return event