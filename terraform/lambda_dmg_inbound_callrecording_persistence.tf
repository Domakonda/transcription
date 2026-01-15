# Lambda Function: adom-inbound-callrecording-persistence
# Triggered by SQS queue (subscribed to S3 events), reads S3 and writes to DynamoDB

# Note: For mono repo architecture, application code is deployed separately
# Initial deployment uses placeholder Lambda to allow infrastructure provisioning

# Lambda Function
resource "aws_lambda_function" "adom_inbound_callrecording_persistence" {
  filename         = "${path.module}/lambda_placeholder_persistence.zip"
  function_name    = "adom-inbound-callrecording-persistence"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder_persistence.zip")
  runtime          = var.lambda_runtime
  timeout          = 180 # 3 minutes
  memory_size      = var.lambda_memory_size

  environment {
    variables = {
      S3_INPUT_BUCKET         = var.s3_input_bucket_name
      S3_OUTPUT_BUCKET        = var.s3_input_bucket_name
      S3_OUTPUT_PREFIX        = var.s3_output_prefix
      DYNAMODB_TABLE_NAME     = aws_dynamodb_table.call_recordings.name
      BEDROCK_PROJECT_ARN     = aws_cloudformation_stack.bedrock_data_automation.outputs["ProjectArn"]
      BEDROCK_BLUEPRINT_STAGE = var.blueprint_stage
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "adom-inbound-callrecording-persistence"
    }
  )
}

# Lambda Event Source Mapping (SQS trigger)
resource "aws_lambda_event_source_mapping" "sqs_to_lambda_persistence" {
  event_source_arn = aws_sqs_queue.adom_inbound_callrecording_persistence.arn
  function_name    = aws_lambda_function.adom_inbound_callrecording_persistence.arn
  batch_size       = 1 # Process one message at a time
  enabled          = true

  # Optional: scaling config
  scaling_config {
    maximum_concurrency = 10
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "adom_inbound_callrecording_persistence" {
  name              = "/aws/lambda/adom-inbound-callrecording-persistence"
  retention_in_days = 14

  tags = local.common_tags
}
