# Lambda Function: adom-inbound-callrecording-transcription
# Triggered by SQS queue, invokes Bedrock Data Automation

# Note: For mono repo architecture, application code is deployed separately
# Initial deployment uses placeholder Lambda to allow infrastructure provisioning
# Deploy actual application code afterward using: aws lambda update-function-code
#
# The lifecycle block below prevents Terraform from reverting code/handler changes
# made via AWS CLI during application deployments

# Lambda Function
resource "aws_lambda_function" "adom_inbound_callrecording_transcription" {
  filename         = "${path.module}/lambda_placeholder_transcription.zip"
  function_name    = "adom-inbound-callrecording-transcription"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder_transcription.zip")
  runtime          = var.lambda_runtime
  timeout          = 180 # 3 minutes
  memory_size      = var.lambda_memory_size

  # Ignore changes to code and handler - managed via CI/CD
  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
      handler,
      last_modified
    ]
  }

  environment {
    variables = {
      S3_INPUT_BUCKET         = var.s3_input_bucket_name
      S3_OUTPUT_BUCKET        = var.s3_input_bucket_name
      S3_OUTPUT_PREFIX        = var.s3_output_prefix
      BEDROCK_PROJECT_ARN     = aws_cloudformation_stack.bedrock_data_automation.outputs["ProjectArn"]
      BEDROCK_BLUEPRINT_STAGE = var.blueprint_stage
      BEDROCK_PROFILE_ARN     = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:data-automation-profile/us.data-automation-v1"
      DYNAMODB_TABLE_NAME     = aws_dynamodb_table.call_recordings.name
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "adom-inbound-callrecording-transcription"
    }
  )
}

# Lambda Event Source Mapping (SQS trigger)
resource "aws_lambda_event_source_mapping" "sqs_to_lambda_transcription" {
  event_source_arn = aws_sqs_queue.adom_inbound_callrecording_transcript.arn
  function_name    = aws_lambda_function.adom_inbound_callrecording_transcription.arn
  batch_size       = 1 # Process one message at a time
  enabled          = true

  # Optional: scaling config
  scaling_config {
    maximum_concurrency = 10
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "adom_inbound_callrecording_transcription" {
  name              = "/aws/lambda/adom-inbound-callrecording-transcription"
  retention_in_days = 14

  tags = local.common_tags
}
