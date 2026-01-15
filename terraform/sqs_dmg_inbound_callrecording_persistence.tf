# SQS Queue for adom-inbound-callrecording-persistence Lambda
# Triggered by S3 event notifications

# Dead Letter Queue
resource "aws_sqs_queue" "adom_inbound_callrecording_persistence_dlq" {
  name = "adom-inbound-callrecording-persistence-sqs-dlq"

  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    local.common_tags,
    {
      Name = "adom-inbound-callrecording-persistence-sqs-dlq"
      Type = "dead-letter-queue"
    }
  )
}

# Main SQS Queue for S3 notifications
resource "aws_sqs_queue" "adom_inbound_callrecording_persistence" {
  name                       = "adom-inbound-callrecording-persistence-sqs-queue"
  delay_seconds              = 30
  max_message_size           = 262144 # 256 KB
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 10     # Long polling
  visibility_timeout_seconds = 360    # 6 minutes (2x Lambda timeout)

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.adom_inbound_callrecording_persistence_dlq.arn
    maxReceiveCount     = 10
  })

  tags = merge(
    local.common_tags,
    {
      Name = "adom-inbound-callrecording-persistence-sqs-queue"
      Type = "sqs-queue"
    }
  )
}

# SQS Queue Policy (allow S3 to send messages)
resource "aws_sqs_queue_policy" "s3_to_sqs_persistence_policy" {
  queue_url = aws_sqs_queue.adom_inbound_callrecording_persistence.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3Publish"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.adom_inbound_callrecording_persistence.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = "arn:aws:s3:::${var.s3_input_bucket_name}"
          }
        }
      }
    ]
  })
}
