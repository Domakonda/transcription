# S3 Bucket Policy for Bedrock Data Automation Access
# Allows Bedrock service to read input audio files and write transcription outputs

data "aws_s3_bucket" "experiment_data" {
  bucket = "pgr-experiment-data-us-east-1"
}

resource "aws_s3_bucket_policy" "bedrock_access" {
  bucket = data.aws_s3_bucket.experiment_data.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBedrockDataAutomationRead"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          data.aws_s3_bucket.experiment_data.arn,
          "${data.aws_s3_bucket.experiment_data.arn}/*"
        ]
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowBedrockDataAutomationWrite"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = [
          "${data.aws_s3_bucket.experiment_data.arn}/bedrock-output/*"
        ]
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}
