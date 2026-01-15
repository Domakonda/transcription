# Lambda Function: adom-inbound-callrecording-retrieval
# Triggered by API Gateway, reads from DynamoDB and returns to UI

# Note: For mono repo architecture, application code is deployed separately
# Initial deployment uses placeholder Lambda to allow infrastructure provisioning

# Lambda Function
resource "aws_lambda_function" "adom_inbound_callrecording_retrieval" {
  filename         = "${path.module}/lambda_placeholder_retrieval.zip"
  function_name    = "adom-inbound-callrecording-retrieval"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder_retrieval.zip")
  runtime          = var.lambda_runtime
  timeout          = 30 # 30 seconds
  memory_size      = 256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME          = aws_dynamodb_table.call_recordings.name
      S3_INPUT_BUCKET              = var.s3_input_bucket_name
      S3_OUTPUT_BUCKET             = var.s3_input_bucket_name
      S3_OUTPUT_PREFIX             = var.s3_output_prefix
      BEDROCK_PROJECT_ARN          = aws_cloudformation_stack.bedrock_data_automation.outputs["ProjectArn"]
      BEDROCK_BLUEPRINT_STAGE      = var.blueprint_stage
      PAGINATION_DEFAULT_PAGE_SIZE = var.pagination_default_page_size
      PAGINATION_MAX_PAGE_SIZE     = var.pagination_max_page_size
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "adom-inbound-callrecording-retrieval"
    }
  )
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "adom_inbound_callrecording_retrieval" {
  name              = "/aws/lambda/adom-inbound-callrecording-retrieval"
  retention_in_days = 14

  tags = local.common_tags
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway_invoke_retrieval" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.adom_inbound_callrecording_retrieval.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.analytics_api.execution_arn}/*/*"
}
