export declare const config: {
    readonly aws: {
        readonly region: string;
    };
    readonly bedrock: {
        readonly projectArn: string;
        readonly blueprintStage: string;
        readonly profileArn: string;
    };
    readonly s3: {
        readonly inputBucket: string;
        readonly outputBucket: string;
        readonly outputPrefix: string;
    };
    readonly dynamodb: {
        readonly tableName: string;
    };
    readonly pagination: {
        readonly defaultPageSize: number;
        readonly maxPageSize: number;
    };
};
export declare const validateConfig: () => void;
//# sourceMappingURL=index.d.ts.map