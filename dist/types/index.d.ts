export interface BedrockDataAutomationInput {
    inputS3Uri: string;
    projectArn: string;
    outputConfiguration?: {
        s3OutputConfiguration?: {
            s3Uri: string;
        };
    };
}
export interface BedrockDataAutomationOutput {
    invocationArn: string;
    status: string;
    outputS3Uri?: string;
}
export interface ConversationalAnalytics {
    call_summary: string;
    call_categories: string[];
    topics: string[];
    transcript?: string;
    audio_summary?: string;
    topic_summary?: string;
    audio_content_moderation?: ContentModeration;
}
export interface ContentModeration {
    categories: string[];
    severity: string;
}
export interface SnsMessage {
    callId: string;
    audioS3Uri: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export interface SqsMessageBody {
    Type: string;
    MessageId: string;
    TopicArn: string;
    Message: string;
    Timestamp: string;
    SignatureVersion: string;
    Signature: string;
    SigningCertURL: string;
    UnsubscribeURL: string;
}
export interface CallRecordingRecord {
    hash: string;
    epchdatetimestamp: number;
    call_id: string;
    s3_input_uri: string;
    s3_output_uri?: string;
    bedrock_invocation_arn?: string;
    bedrock_status: string;
    call_summary?: string;
    call_categories?: string[];
    topics?: string[];
    transcript?: string;
    audio_summary?: string;
    topic_summary?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
export interface ApiAnalyticsRequest {
    hash?: string;
    callId?: string;
}
export interface ApiAnalyticsResponse {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
}
//# sourceMappingURL=index.d.ts.map