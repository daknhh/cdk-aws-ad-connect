import { KMSClient, DecryptCommand, DecryptCommandInput } from "@aws-sdk/client-kms"; 
import { RuntimeProperties } from "../types/runtimeprops";
import { Config } from "../types/config";
import { TextEncoder, TextDecoder } from "util";


/**
 *
 * @param awsregion  AWS region, e.g. eu-central-1
 * @param runtimeProps runtime properties object, where to store prices
 * @returns true if prices are update in runtimeprops
 */
 export async function DecryptSecretValue(runtimeProps: RuntimeProperties, config: Config, awsregion: string): Promise<boolean> {
    try{
        console.log("🕵🏼‍♂️  Decrypting Ad Passwort with KMS Key. \n")
        const client = new KMSClient({region: awsregion});
        const input: DecryptCommandInput = {
            CiphertextBlob: Buffer.from(config.ad.Password.encryptedvalue,"base64"),
            KeyId: config.ad.Password.kmskeyid,
        };
        const command = new DecryptCommand(input);
        let response = await client.send(command);
        if(response.Plaintext){
            runtimeProps.SecretValue = Buffer.from(response.Plaintext as any).toString() || ""
        }
        console.log("🤫 Adding Ad Passwort to runtime properties. \n")
        return true;
    }
    catch(e){
        console.log("🚨 Error: " +e)
        return false;
    }
  }