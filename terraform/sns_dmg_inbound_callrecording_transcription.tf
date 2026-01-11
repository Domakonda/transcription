# SNS Topic for dmg-inbound-callrecording-transcription Lambda
resource "aws_sns_topic" "dmg_inbound_callrecording_transcript" {
  name = "dmg-inbound-callrecording-transcript"

  tags = merge(
    local.common_tags,
    {
      Name = "dmg-inbound-callrecording-transcript"
      Type = "sns-topic"
    }
  )
}

# SNS Topic Policy (allow existing Lambda to publish)
resource "aws_sns_topic_policy" "dmg_inbound_callrecording_transcript" {
  arn = aws_sns_topic.dmg_inbound_callrecording_transcript.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.dmg_inbound_callrecording_transcript.arn
      },
      {
        Sid    = "AllowAccountPublish"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.dmg_inbound_callrecording_transcript.arn
        Condition = {
          StringEquals = {
            "AWS:SourceOwner" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}
