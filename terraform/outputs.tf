# =============================================================================
# Outputs - Centralized output values for all resources
# =============================================================================

# -----------------------------------------------------------------------------
# S3 Bucket Outputs
# -----------------------------------------------------------------------------
output "s3_input_bucket" {
  description = "Name of the S3 input/output bucket (existing bucket)"
  value       = var.s3_input_bucket_name
}

output "s3_input_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = "arn:aws:s3:::${var.s3_input_bucket_name}"
}

output "s3_output_prefix" {
  description = "S3 prefix for transcription outputs"
  value       = var.s3_output_prefix
}

# -----------------------------------------------------------------------------
# SNS Topic Outputs
# -----------------------------------------------------------------------------
output "sns_topic_arn" {
  description = "ARN of the SNS topic for adom-inbound-callrecording-transcription"
  value       = aws_sns_topic.adom_inbound_callrecording_transcript.arn
}

# -----------------------------------------------------------------------------
# SQS Queue Outputs - Transcription
# -----------------------------------------------------------------------------
output "sqs_queue_url" {
  description = "URL of the SQS queue for adom-inbound-callrecording-transcription"
  value       = aws_sqs_queue.adom_inbound_callrecording_transcript.id
}

output "sqs_queue_arn" {
  description = "ARN of the SQS queue for transcription"
  value       = aws_sqs_queue.adom_inbound_callrecording_transcript.arn
}

output "sqs_dlq_arn" {
  description = "ARN of the SQS dead letter queue for transcription"
  value       = aws_sqs_queue.adom_inbound_callrecording_transcript_dlq.arn
}

# -----------------------------------------------------------------------------
# SQS Queue Outputs - Persistence
# -----------------------------------------------------------------------------
output "sqs_persistence_queue_url" {
  description = "URL of the SQS queue for adom-inbound-callrecording-persistence"
  value       = aws_sqs_queue.adom_inbound_callrecording_persistence.id
}

output "sqs_persistence_queue_arn" {
  description = "ARN of the SQS queue for persistence"
  value       = aws_sqs_queue.adom_inbound_callrecording_persistence.arn
}

output "sqs_persistence_dlq_arn" {
  description = "ARN of the SQS dead letter queue for persistence"
  value       = aws_sqs_queue.adom_inbound_callrecording_persistence_dlq.arn
}

# -----------------------------------------------------------------------------
# SQS Queue Outputs - S3 Bedrock Output Events
# -----------------------------------------------------------------------------
output "sqs_s3_bedrock_output_queue_url" {
  description = "URL of the SQS queue for S3 Bedrock output events"
  value       = aws_sqs_queue.s3_bedrock_output.id
}

output "sqs_s3_bedrock_output_queue_arn" {
  description = "ARN of the SQS queue for S3 Bedrock output events"
  value       = aws_sqs_queue.s3_bedrock_output.arn
}

output "sqs_s3_bedrock_output_dlq_arn" {
  description = "ARN of the SQS dead letter queue for S3 Bedrock output events"
  value       = aws_sqs_queue.s3_bedrock_output_dlq.arn
}

# -----------------------------------------------------------------------------
# Lambda Function Outputs
# -----------------------------------------------------------------------------
output "lambda_transcription_arn" {
  description = "ARN of adom-inbound-callrecording-transcription Lambda function"
  value       = aws_lambda_function.adom_inbound_callrecording_transcription.arn
}

output "lambda_transcription_name" {
  description = "Name of adom-inbound-callrecording-transcription Lambda function"
  value       = aws_lambda_function.adom_inbound_callrecording_transcription.function_name
}

output "lambda_persistence_arn" {
  description = "ARN of adom-inbound-callrecording-persistence Lambda function"
  value       = aws_lambda_function.adom_inbound_callrecording_persistence.arn
}

output "lambda_persistence_name" {
  description = "Name of adom-inbound-callrecording-persistence Lambda function"
  value       = aws_lambda_function.adom_inbound_callrecording_persistence.function_name
}

output "lambda_retrieval_arn" {
  description = "ARN of adom-inbound-callrecording-retrieval Lambda function"
  value       = aws_lambda_function.adom_inbound_callrecording_retrieval.arn
}

output "lambda_retrieval_name" {
  description = "Name of adom-inbound-callrecording-retrieval Lambda function"
  value       = aws_lambda_function.adom_inbound_callrecording_retrieval.function_name
}

# -----------------------------------------------------------------------------
# DynamoDB Table Outputs
# -----------------------------------------------------------------------------
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for call recordings"
  value       = aws_dynamodb_table.call_recordings.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.call_recordings.arn
}

# -----------------------------------------------------------------------------
# API Gateway Outputs
# -----------------------------------------------------------------------------
output "api_gateway_url" {
  description = "URL of the API Gateway for retrieval"
  value       = "${aws_api_gateway_stage.analytics_stage.invoke_url}/analytics/{hash}"
}

output "api_gateway_base_url" {
  description = "Base URL of the API Gateway stage"
  value       = aws_api_gateway_stage.analytics_stage.invoke_url
}

# -----------------------------------------------------------------------------
# Bedrock Data Automation Outputs
# -----------------------------------------------------------------------------
output "blueprint_arn" {
  description = "ARN of the Bedrock Data Automation blueprint"
  value       = aws_cloudformation_stack.bedrock_data_automation.outputs["BlueprintArn"]
}

output "project_arn" {
  description = "ARN of the Bedrock Data Automation project"
  value       = aws_cloudformation_stack.bedrock_data_automation.outputs["ProjectArn"]
}
