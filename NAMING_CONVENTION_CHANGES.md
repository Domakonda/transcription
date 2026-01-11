# Naming Convention Changes: Materialization → Transcription

## Overview

Renamed all resources from `*_materialization` to `*_transcription` to better reflect the function's purpose (invoking Bedrock for audio transcription).

## Changed Files

### Terraform Files (Renamed)

1. **Lambda Function**
   - Old: `terraform/lambda_dmg_inbound_callrecording_materialization.tf`
   - New: `terraform/lambda_dmg_inbound_callrecording_transcription.tf`

2. **SQS Queue**
   - Old: `terraform/sqs_dmg_inbound_callrecording_materialization.tf`
   - New: `terraform/sqs_dmg_inbound_callrecording_transcription.tf`

3. **SNS Topic**
   - Old: `terraform/sns_dmg_inbound_callrecording_materialization.tf`
   - New: `terraform/sns_dmg_inbound_callrecording_transcription.tf`

### Source Code Files (Renamed)

1. **Lambda Handler**
   - Old: `src/handlers/dmg-inbound-callrecording-materialization.ts`
   - New: `src/handlers/dmg-inbound-callrecording-transcription.ts`

### Terraform Resources Renamed

| Resource Type | Old Name | New Name |
|--------------|----------|----------|
| Lambda Function | `aws_lambda_function.dmg_inbound_callrecording_materialization` | `aws_lambda_function.dmg_inbound_callrecording_transcription` |
| Event Source Mapping | `aws_lambda_event_source_mapping.sqs_to_lambda_materialization` | `aws_lambda_event_source_mapping.sqs_to_lambda_transcription` |
| CloudWatch Log Group | `aws_cloudwatch_log_group.dmg_inbound_callrecording_materialization` | `aws_cloudwatch_log_group.dmg_inbound_callrecording_transcription` |
| Output - ARN | `lambda_materialization_arn` | `lambda_transcription_arn` |
| Output - Name | `lambda_materialization_name` | `lambda_transcription_name` |
| Local Variable | `local.lambda_materialization_name` | `local.lambda_transcription_name` |

### AWS Resource Names

When deployed, the following AWS resources will be renamed:

| Resource | Old Name | New Name |
|----------|----------|----------|
| Lambda Function | `dmg-inbound-callrecording-materialization` | `dmg-inbound-callrecording-transcription` |
| CloudWatch Log Group | `/aws/lambda/dmg-inbound-callrecording-materialization` | `/aws/lambda/dmg-inbound-callrecording-transcription` |

**Note:** SQS and SNS resources keep their names (they reference "transcript", not "transcription").

### Documentation Files Updated

All occurrences of `materialization` replaced with `transcription` in:

- `ENVIRONMENT_VARIABLES.md`
- `S3_CONFIGURATION.md`
- `CLEANUP_TRACKER.md`
- `CHANGES_SUMMARY.md`
- `MONO_REPO_DEPLOYMENT.md`
- `QUICK_REFERENCE.md`
- `PROJECT_COMPLETE.md`
- `ARCHITECTURE.md`

## Deployment Impact

### ⚠️ IMPORTANT: State Management Required

These renames will cause Terraform to:
1. **Destroy** the old `dmg-inbound-callrecording-materialization` Lambda function
2. **Create** a new `dmg-inbound-callrecording-transcription` Lambda function

### Options for Deployment

#### Option 1: Use Terraform State Move (Recommended)

Move the state to prevent resource recreation:

```bash
cd terraform

# Move Lambda function state
terraform state mv \
  aws_lambda_function.dmg_inbound_callrecording_materialization \
  aws_lambda_function.dmg_inbound_callrecording_transcription

# Move Event Source Mapping state
terraform state mv \
  aws_lambda_event_source_mapping.sqs_to_lambda_materialization \
  aws_lambda_event_source_mapping.sqs_to_lambda_transcription

# Move CloudWatch Log Group state
terraform state mv \
  aws_cloudwatch_log_group.dmg_inbound_callrecording_materialization \
  aws_cloudwatch_log_group.dmg_inbound_callrecording_transcription

# Verify plan shows only updates (not destroy/create)
terraform plan
```

After moving state, run terraform apply:

```bash
terraform apply
```

This will:
- Update the Lambda function name (in-place update not possible, will replace)
- Update CloudWatch log group name (in-place update not possible, will replace)
- Update event source mapping reference

#### Option 2: Allow Destroy and Recreate

Simply run `terraform apply` and allow Terraform to:
1. Destroy old resources
2. Create new resources with new names

**Warning:** This will cause:
- Brief downtime during Lambda recreation
- Loss of CloudWatch logs from old log group
- New Lambda function ARN (update any hardcoded references)

## Verification Steps

1. **Validate Terraform**
   ```bash
   cd terraform
   terraform validate
   ```
   ✅ Already validated

2. **Check for References**
   ```bash
   grep -r "materialization" terraform/
   ```
   Should return no results in `.tf` files

3. **Verify Source Code**
   ```bash
   ls src/handlers/
   ```
   Should show `dmg-inbound-callrecording-transcription.ts`

4. **Check Build** (Note: Currently fails due to Bedrock SDK issue)
   ```bash
   npm run build
   ```

## Known Issues

- TypeScript build fails due to Bedrock SDK incompatibility (pre-existing issue, unrelated to rename)
- This issue exists in both old and new Lambda handler names

## Summary

✅ All file renames completed
✅ All Terraform resource renames completed
✅ All documentation updates completed
✅ Terraform configuration validated
⚠️ Terraform state move or apply needed
⚠️ TypeScript build issue (pre-existing, Bedrock SDK)

## Next Steps

1. Decide on deployment approach (state move vs. recreate)
2. Run terraform commands to deploy changes
3. Update any external references to Lambda function ARN (if needed)
4. (Separately) Address Bedrock SDK compatibility issue
