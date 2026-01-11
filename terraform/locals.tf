locals {
  # Naming prefix
  name_prefix = "${var.project_name}-${var.environment}"

  # Lambda function names (using dmg naming convention)
  lambda_transcription_name = "dmg-inbound-callrecording-transcription"
  lambda_persistence_name   = "dmg-inbound-callrecording-persistence"
  lambda_retrieval_name     = "dmg-inbound-callrecording-retrieval"

  # Common tags
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      Project     = var.project_name
    }
  )
}
