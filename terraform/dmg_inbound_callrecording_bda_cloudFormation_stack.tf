# Bedrock Data Automation CloudFormation Stack
# Creates Bedrock Blueprint and Data Automation Project for conversational analytics

resource "aws_cloudformation_stack" "bedrock_data_automation" {
  name = "adom-inbound-transcription-post-call-analytics"

  template_body = file("${path.module}/bedrock_data_automation_template.yaml")

  capabilities = ["CAPABILITY_IAM"]

  tags = {
    Environment = "development"
    Project     = "conversational-analytics"
  }
}


