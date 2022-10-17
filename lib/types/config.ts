export interface Config {
  readonly general: {
    readonly produkt: string,
    readonly stage: string,
    readonly prefix: string,
  },
  readonly ad: {
    readonly Name: string,
    readonly ShortName: string,
    readonly Password: LookupSecret,
    readonly Description: string,
    readonly Size: string,
    readonly ConnectionSettings: {
      readonly VpcId: string,
      readonly SubnetIds: Array<string>,
      readonly CustomerDnsIps: Array<string>,
      readonly CustomerUserName: string,
    }
  },
  readonly secret: {
    readonly kmskeyalias: string
    readonly description: string
  }
}

interface LookupSecret {
  readonly encryptedvalue: string,
  readonly kmskeyid: string,
}