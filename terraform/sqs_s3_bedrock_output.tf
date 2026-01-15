# SQS Queue for S3 Bedrock Output Events
# Triggered when Bedrock writes transcription results to S3

# Dead Letter Queue for failed S3 event processing
resource "aws_sqs_queue" "s3_bedrock_output_dlq" {
  name                      = "${local.name_prefix}-s3-bedrock-output-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-s3-bedrock-output-dlq"
    }
  )
}

# Main Queue for S3 Bedrock Output Events
resource "aws_sqs_queue" "s3_bedrock_output" {
  name                       = "${local.name_prefix}-s3-bedrock-output-queue"
  visibility_timeout_seconds = 900 # 15 minutes (3x Lambda timeout)
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20 # Long polling

  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.s3_bedrock_output_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-s3-bedrock-output-queue"
    }
  )
}

# SQS Queue Policy - Allow S3 to send messages
resource "aws_sqs_queue_policy" "s3_bedrock_output_policy" {
  queue_url = aws_sqs_queue.s3_bedrock_output.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3ToSendMessage"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.s3_bedrock_output.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = data.aws_s3_bucket.experiment_data.arn
          }
        }
      }
    ]
  })
}

# S3 Bucket Notification - Trigger SQS when Bedrock writes results
resource "aws_s3_bucket_notification" "bedrock_output_notification" {
  bucket = data.aws_s3_bucket.experiment_data.id

  queue {
    id            = "bedrock-transcription-complete"
    queue_arn     = aws_sqs_queue.s3_bedrock_output.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "${var.s3_output_prefix}/"
    filter_suffix = "/custom_output/0/result.json"
  }
}

# Lambda Event Source Mapping - Connect SQS to Persistence Lambda
resource "aws_lambda_event_source_mapping" "sqs_to_lambda_persistence_bedrock" {
  event_source_arn = aws_sqs_queue.s3_bedrock_output.arn
  function_name    = aws_lambda_function.adom_inbound_callrecording_persistence.arn
  batch_size       = 1
  enabled          = true

  # Scaling configuration
  scaling_config {
    maximum_concurrency = 10
  }

  # Function response types
  function_response_types = ["ReportBatchItemFailures"]
}
