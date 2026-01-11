# SQS Queue for dmg-inbound-callrecording-transcription Lambda
# Dead Letter Queue
resource "aws_sqs_queue" "dmg_inbound_callrecording_transcript_dlq" {
  name = "dmg-inbound-callrecording-transcript-sqs-dlq"

  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    local.common_tags,
    {
      Name = "dmg-inbound-callrecording-transcript-sqs-dlq"
      Type = "dead-letter-queue"
    }
  )
}

# Main SQS Queue
resource "aws_sqs_queue" "dmg_inbound_callrecording_transcript" {
  name                       = "dmg-inbound-callrecording-transcript-sqs-queue"
  delay_seconds              = 30
  max_message_size           = 262144 # 256 KB
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 10     # Long polling
  visibility_timeout_seconds = 360    # 6 minutes (2x Lambda timeout)

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dmg_inbound_callrecording_transcript_dlq.arn
    maxReceiveCount     = 10
  })

  tags = merge(
    local.common_tags,
    {
      Name = "dmg-inbound-callrecording-transcript-sqs-queue"
      Type = "sqs-queue"
    }
  )
}

# SQS Queue Policy (allow SNS to send messages)
resource "aws_sqs_queue_policy" "sns_to_sqs_policy" {
  queue_url = aws_sqs_queue.dmg_inbound_callrecording_transcript.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.dmg_inbound_callrecording_transcript.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.dmg_inbound_callrecording_transcript.arn
          }
        }
      }
    ]
  })
}

# SNS Subscription to SQS Queue
resource "aws_sns_topic_subscription" "sns_to_sqs" {
  topic_arn = aws_sns_topic.dmg_inbound_callrecording_transcript.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.dmg_inbound_callrecording_transcript.arn

  # Raw message delivery - set to false to keep SNS envelope
  raw_message_delivery = false
}
