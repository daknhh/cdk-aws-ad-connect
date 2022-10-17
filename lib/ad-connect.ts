import * as cdk from "aws-cdk-lib";
import * as lambdaPy from '@aws-cdk/aws-lambda-python-alpha'

import {
  aws_iam as iam,
  aws_secretsmanager as secretmanager,
  aws_kms as kms,
  aws_lambda as lambda,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  aws_logs as logs,
  Tags,
  SecretValue,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Config } from "./types/config";
import { RuntimeProperties } from "./types/runtimeprops";

export interface ConfigStackProps extends cdk.StackProps {
  readonly config: Config;
  runtimeprops: RuntimeProperties;
}

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id, props);

    console.log(
      "🌎 New Ressources are beeing created in :",
      "\x1b[33m",
      "\n                      " + process.env.CDK_DEFAULT_REGION,
      "\x1b[0m \n",
      "👤 in AWS Account : ",
      "\x1b[33m",
      "\n                      " + process.env.AWSUME_PROFILE,
      "\x1b[0m"
    );

    const secretkey = kms.Key.fromLookup(this,"SecretKmsKey",{aliasName: "alias/" + props.config.secret.kmskeyalias})
    const secret = new secretmanager.Secret(this, 'Secret', {
      secretName: props.config.general.prefix + "-AD-Connect-" + props.config.ad.ShortName.toUpperCase() + "-ServiceUser",
      description: "AD-User Credentials for AD Connect",
      secretObjectValue: {
        username: SecretValue.unsafePlainText(props.config.ad.ShortName+ "\u005C" + props.config.ad.ConnectionSettings.CustomerUserName),
        password: SecretValue.unsafePlainText(props.runtimeprops.SecretValue.trim()),
      },
      encryptionKey: secretkey

   });


    // AdConnect Lambda
    const IamRoleAdConnectLambdaFunctionRole = new iam.Role(this, "IamRoleAdConnectLambdaFunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    secretkey.grantDecrypt(IamRoleAdConnectLambdaFunctionRole)
    const DirectoryServiceAllow = new iam.PolicyStatement({
      actions:[
        "ds:ConnectDirectory",
        "ds:DeleteDirectory",
        "ds:DescribeDirectories"
      ],
      resources: ["*"]})
    
    const ec2Allow = new iam.PolicyStatement({
      actions:[
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs",
        "ec2:CreateSecurityGroup",
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:CreateTags",
        "ec2:DeleteSecurityGroup",
        "ec2:DeleteNetworkInterface",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:DeleteTags"],
      resources: ["*"]})


    const SecretAllow = new iam.PolicyStatement({
      actions:[
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ],
      resources: [secret.secretArn]})

    const CwLogAllow = new iam.PolicyStatement({
      actions:[
        "logs:FilterLogEvents",
        "logs:DescribeLogGroups",
        "logs:ListTagsLogGroup"
      ],
      resources: ["arn:aws:logs:" + process.env.CDK_DEFAULT_REGION + ":"+ process.env.CDK_DEFAULT_ACCOUNT+":log-group:*"]})
    IamRoleAdConnectLambdaFunctionRole.addToPolicy(CwLogAllow)
    IamRoleAdConnectLambdaFunctionRole.addToPolicy(SecretAllow)
    IamRoleAdConnectLambdaFunctionRole.addToPolicy(ec2Allow)
    IamRoleAdConnectLambdaFunctionRole.addToPolicy(DirectoryServiceAllow)
    IamRoleAdConnectLambdaFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole",
    ),);

    const ManagedResourceLambdaFunction = new lambdaPy.PythonFunction(this, "ManagedResourceLambdaFunction", {
      runtime: lambda.Runtime.PYTHON_3_9,
      entry: "./lambda/ManagedResource",
      index: "adconnect.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.seconds(60),
      architecture: lambda.Architecture.ARM_64,
      role: IamRoleAdConnectLambdaFunctionRole,
      memorySize: 256,
      logRetention: logs.RetentionDays.TWO_WEEKS
    });

    // Update CloudFormation Lambda
    const UpdateCloudFormationLambdaFunctionRole = new iam.Role(this, "UpdateCloudFormationLambdaFunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    UpdateCloudFormationLambdaFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole",
    ),);

    const UpdateCloudFormationLambdaFunction = new lambdaPy.PythonFunction(this, "UpdateCloudFormationLambdaFunction", {
      runtime: lambda.Runtime.PYTHON_3_9,
      entry: "./lambda/UpdateCloudFormation",
      index: "updatecloudformation.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.seconds(25),
      architecture: lambda.Architecture.ARM_64,
      role: UpdateCloudFormationLambdaFunctionRole,
      memorySize: 128,
      logRetention: logs.RetentionDays.TWO_WEEKS
    });


    // Status Lambda
    const StatusLambdaFunctionRole = new iam.Role(this, "StatusLambdaFunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    StatusLambdaFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole",
    ),);
    const DescribeDirectoryServiceAllow = new iam.PolicyStatement({
      actions:[
        "ds:DescribeDirectories"
      ],
      resources: ["*"]})
    StatusLambdaFunctionRole.addToPolicy(DescribeDirectoryServiceAllow)
    StatusLambdaFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole",
    ),);
    const StatusLambdaFunction = new lambdaPy.PythonFunction(this, "StatusLambdaFunction", {
      runtime: lambda.Runtime.PYTHON_3_9,
      entry: "./lambda/Status",
      index: "status.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.seconds(25),
      architecture: lambda.Architecture.ARM_64,
      role: StatusLambdaFunctionRole,
      memorySize: 128,
      logRetention: logs.RetentionDays.TWO_WEEKS
    });

      // StepFunction
      const ManagedResource = new tasks.LambdaInvoke(this, 'ManagedResourceLambda', {
        lambdaFunction: ManagedResourceLambdaFunction,
      });
      const Status = new tasks.LambdaInvoke(this, 'StatusLambda', {
        lambdaFunction: StatusLambdaFunction,
      });
      const UpdateCloudFormationLambda = new tasks.LambdaInvoke(this, 'UpdateCloudFormationLambda', {
        lambdaFunction: UpdateCloudFormationLambdaFunction,
      });
      const wait30 = new sfn.Wait(this, 'Wait 30 Seconds', {
        time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
      });

      const definition = ManagedResource
        .next(wait30)
        .next(Status)
        .next(new sfn.Choice(this, 'Resource Complete?')
          // Look at the "status" field
          .when(sfn.Condition.stringEquals('$.Payload.CreationStatus', 'FAILED'), UpdateCloudFormationLambda)
          .when(sfn.Condition.stringEquals('$.Payload.CreationStatus', 'SUCCESS'), UpdateCloudFormationLambda)
          .otherwise(wait30));

      const StateMaschine = new sfn.StateMachine(this, 'StateMachine', {
        definition,
        timeout: cdk.Duration.minutes(25),
      });

    // Trigger StepFunction Lambda
    const CustomResourceLambdaFunctionRole = new iam.Role(this, "CustomResourceLambdaFunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    CustomResourceLambdaFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole",
    ),);
    StateMaschine.grantStartExecution(CustomResourceLambdaFunctionRole)

    const CustomResourceLambdaFunction = new lambdaPy.PythonFunction(this, "CustomResourceLambdaFunction", {
      runtime: lambda.Runtime.PYTHON_3_9,
      entry: "./lambda/CustomResourceHandler",
      index: "customresrouce.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.seconds(10),
      architecture: lambda.Architecture.ARM_64,
      role: CustomResourceLambdaFunctionRole,
      memorySize: 256,
      environment: {
        STATE_MACHINE_ARN: StateMaschine.stateMachineArn
      }
    });


    const AdConnect = new cdk.CustomResource(this, "AdConnect", {
      properties: {
        ad_Name: props.config.ad.Name,
        ad_ShortName: props.config.ad.ShortName,
        ad_Description: props.config.ad.Description,
        ad_Size: props.config.ad.Size,
        VpcId: props.config.ad.ConnectionSettings.VpcId,
        SubnetIds: props.config.ad.ConnectionSettings.SubnetIds.toString(),
        CustomerDnsIps: props.config.ad.ConnectionSettings.CustomerDnsIps.toString(),
        ad_Secret: secret.secretArn,
        ad_ServiceUserName: props.config.ad.ConnectionSettings.CustomerUserName
      },
      serviceToken: CustomResourceLambdaFunction.functionArn
    })

    new cdk.CfnOutput(this, this.stackName + "DirectoryId", {
      value: AdConnect.getAtt("DirectoryId").toString(),
      description: "DirectoryId",
      exportName: this.stackName + "DirectoryId",
    });

    new cdk.CfnOutput(this, this.stackName + "Secret", {
      value: secret.secretName,
      description: "Credentialsfor_AdConnect",
      exportName: this.stackName + "Secret",
    });
    }
}
