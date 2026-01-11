# IAM Role for Lambda Functions
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

# Lambda Execution Role
resource "aws_iam_role" "lambda_execution" {
  name               = "${local.name_prefix}-lambda-execution-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = local.common_tags
}

# Basic Lambda Execution Policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom IAM Policy for Lambda Functions
resource "aws_iam_policy" "lambda_custom" {
  name        = "${local.name_prefix}-lambda-custom-policy"
  description = "Custom policy for Bedrock Data Automation Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_input_bucket_name}",
          "arn:aws:s3:::${var.s3_input_bucket_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.dmg_inbound_callrecording_transcript.arn,
          aws_sqs_queue.dmg_inbound_callrecording_persistence.arn,
          aws_sqs_queue.s3_bedrock_output.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.call_recordings.arn
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeDataAutomationAsync",
          "bedrock:GetDataAutomationStatus",
          "bedrock:ListDataAutomationProjects",
          "bedrock:GetDataAutomationProject"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })

  tags = local.common_tags
}

# Attach custom policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_custom" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_custom.arn
}

# KMS permissions if KMS key is provided
resource "aws_iam_policy" "lambda_kms" {
  count = var.kms_key_arn != "" ? 1 : 0

  name        = "${local.name_prefix}-lambda-kms-policy"
  description = "KMS policy for Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_kms" {
  count = var.kms_key_arn != "" ? 1 : 0

  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_kms[0].arn
}

