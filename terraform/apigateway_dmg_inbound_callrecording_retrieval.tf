# API Gateway for adom-inbound-callrecording-retrieval Lambda
# Receives requests from UI and triggers Lambda 3

# IAM Role for API Gateway CloudWatch Logging
resource "aws_iam_role" "api_gateway_cloudwatch" {
  name = "api-gateway-cloudwatch-global"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# API Gateway Account Settings (required for CloudWatch logging)
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn

  depends_on = [aws_iam_role_policy_attachment.api_gateway_cloudwatch]
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "analytics_api" {
  name        = "adom-inbound-callrecording-analytics-api"
  description = "API Gateway for call recording analytics retrieval"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

# API Gateway Resource: /analytics
resource "aws_api_gateway_resource" "analytics" {
  rest_api_id = aws_api_gateway_rest_api.analytics_api.id
  parent_id   = aws_api_gateway_rest_api.analytics_api.root_resource_id
  path_part   = "analytics"
}

# API Gateway Resource: /analytics/{hash}
resource "aws_api_gateway_resource" "analytics_hash" {
  rest_api_id = aws_api_gateway_rest_api.analytics_api.id
  parent_id   = aws_api_gateway_resource.analytics.id
  path_part   = "{hash}"
}

# API Gateway Method: GET /analytics/{hash}
resource "aws_api_gateway_method" "get_analytics" {
  rest_api_id   = aws_api_gateway_rest_api.analytics_api.id
  resource_id   = aws_api_gateway_resource.analytics_hash.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.hash" = true
  }
}

# API Gateway Integration with Lambda
resource "aws_api_gateway_integration" "lambda_integration_retrieval" {
  rest_api_id             = aws_api_gateway_rest_api.analytics_api.id
  resource_id             = aws_api_gateway_resource.analytics_hash.id
  http_method             = aws_api_gateway_method.get_analytics.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.adom_inbound_callrecording_retrieval.invoke_arn
}

# API Gateway Method: GET /analytics (list recent)
resource "aws_api_gateway_method" "get_analytics_list" {
  rest_api_id   = aws_api_gateway_rest_api.analytics_api.id
  resource_id   = aws_api_gateway_resource.analytics.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway Integration for list
resource "aws_api_gateway_integration" "lambda_integration_list" {
  rest_api_id             = aws_api_gateway_rest_api.analytics_api.id
  resource_id             = aws_api_gateway_resource.analytics.id
  http_method             = aws_api_gateway_method.get_analytics_list.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.adom_inbound_callrecording_retrieval.invoke_arn
}

# API Gateway Method: OPTIONS /analytics/{hash} (CORS)
resource "aws_api_gateway_method" "options_analytics" {
  rest_api_id   = aws_api_gateway_rest_api.analytics_api.id
  resource_id   = aws_api_gateway_resource.analytics_hash.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway Integration for OPTIONS (CORS)
resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id = aws_api_gateway_rest_api.analytics_api.id
  resource_id = aws_api_gateway_resource.analytics_hash.id
  http_method = aws_api_gateway_method.options_analytics.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway Method Response for OPTIONS
resource "aws_api_gateway_method_response" "options_response" {
  rest_api_id = aws_api_gateway_rest_api.analytics_api.id
  resource_id = aws_api_gateway_resource.analytics_hash.id
  http_method = aws_api_gateway_method.options_analytics.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

# API Gateway Integration Response for OPTIONS
resource "aws_api_gateway_integration_response" "options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.analytics_api.id
  resource_id = aws_api_gateway_resource.analytics_hash.id
  http_method = aws_api_gateway_method.options_analytics.http_method
  status_code = aws_api_gateway_method_response.options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_integration]
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "analytics_deployment" {
  rest_api_id = aws_api_gateway_rest_api.analytics_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.analytics.id,
      aws_api_gateway_resource.analytics_hash.id,
      aws_api_gateway_method.get_analytics.id,
      aws_api_gateway_integration.lambda_integration_retrieval.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.lambda_integration_retrieval,
    aws_api_gateway_integration.lambda_integration_list,
    aws_api_gateway_integration.options_integration
  ]
}

# API Gateway Stage
resource "aws_api_gateway_stage" "analytics_stage" {
  deployment_id = aws_api_gateway_deployment.analytics_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.analytics_api.id
  stage_name    = var.environment

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = local.common_tags

  depends_on = [aws_api_gateway_account.main]
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/adom-inbound-callrecording-analytics-api"
  retention_in_days = 14

  tags = local.common_tags
}
