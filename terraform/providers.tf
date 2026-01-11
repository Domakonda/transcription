# Terraform Block
terraform {
  required_version = "~> 1.14"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

# Provider Block
provider "aws" {
  region = var.aws_region
}

# Data Sources
data "aws_caller_identity" "current" {}
