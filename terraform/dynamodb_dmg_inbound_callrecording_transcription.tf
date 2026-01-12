# DynamoDB Table for Call Recording Transcripts
resource "aws_dynamodb_table" "call_recordings" {
  name         = "${local.name_prefix}-call-recordings"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "hash"
  range_key = "epchdatetimestamp"

  attribute {
    name = "hash"
    type = "S"
  }

  attribute {
    name = "epchdatetimestamp"
    type = "N"
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn != "" ? var.kms_key_arn : null
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-call-recordings-table"
    }
  )
}

# DynamoDB Table for Quota Tracking
resource "aws_dynamodb_table" "quota_tracking" {
  name         = "${local.name_prefix}-quota-tracking"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "request_id"

  attribute {
    name = "request_id"
    type = "S"
  }

  # TTL to automatically clean up old records after 1 hour
  ttl {
    attribute_name = "expiration_time"
    enabled        = true
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn != "" ? var.kms_key_arn : null
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-quota-tracking-table"
    }
  )
}
