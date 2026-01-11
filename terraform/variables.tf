variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name for the Bedrock Data Automation project"
  type        = string
  default     = "conversational-analytics"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.project_name))
    error_message = "Project name must contain only alphanumeric characters and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "s3_input_bucket_name" {
  description = "Existing S3 bucket name containing audio files"
  type        = string
  default     = "pgr-experiment-data-us-east-1"
}

variable "s3_output_prefix" {
  description = "S3 prefix (subfolder) for Bedrock transcription outputs"
  type        = string
  default     = "transcription-outputs"
}

variable "kms_key_arn" {
  description = "KMS Key ARN for encryption (optional)"
  type        = string
  default     = ""
}

variable "blueprint_stage" {
  description = "Stage for the blueprint deployment"
  type        = string
  default     = "LIVE"

  validation {
    condition     = contains(["DEVELOPMENT", "LIVE"], var.blueprint_stage)
    error_message = "Blueprint stage must be either DEVELOPMENT or LIVE."
  }
}

variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "nodejs20.x"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "pagination_default_page_size" {
  description = "Default page size for DynamoDB pagination"
  type        = number
  default     = 20

  validation {
    condition     = var.pagination_default_page_size > 0 && var.pagination_default_page_size <= 100
    error_message = "Default page size must be between 1 and 100."
  }
}

variable "pagination_max_page_size" {
  description = "Maximum page size for DynamoDB pagination"
  type        = number
  default     = 100

  validation {
    condition     = var.pagination_max_page_size > 0 && var.pagination_max_page_size <= 1000
    error_message = "Maximum page size must be between 1 and 1000."
  }
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project   = "bedrock-data-automation"
    ManagedBy = "terraform"
  }
}
