declare module 'pg' {
  export class Client {
    constructor(config?: any);
    connect(): Promise<void>;
    query(queryTextOrConfig: any, values?: any[]): Promise<any>;
    end(): Promise<void>;
  }
}
