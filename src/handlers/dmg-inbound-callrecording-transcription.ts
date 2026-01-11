import { SQSHandler, SQSEvent } from 'aws-lambda';
import { TranscriptionService } from '../services/transcription.service';

/**
 * Lambda handler for transcription requests from SQS
 * Processes incoming audio files and initiates Bedrock Data Automation
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  const service = new TranscriptionService();
  await service.processTranscriptionRequests(event);
};
