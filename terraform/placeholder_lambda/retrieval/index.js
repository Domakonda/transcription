/**
 * Placeholder Lambda: dmg-inbound-callrecording-retrieval
 *
 * Purpose: API Gateway endpoint for querying call recordings from DynamoDB
 * Trigger: API Gateway (GET /analytics/{hash})
 * Output: JSON response with call recordings and pagination
 *
 * This version demonstrates pagination with mock data
 */

exports.handler = async (event) => {
    console.log('=== Placeholder: dmg-inbound-callrecording-retrieval ===');
    console.log('Testing pagination functionality with mock data');
    console.log('Event:', JSON.stringify(event, null, 2));

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    };

    try {
        // Extract parameters
        const hash = event.pathParameters?.hash || 'test-hash-123';
        const pageSizeParam = event.queryStringParameters?.pageSize;
        const nextTokenParam = event.queryStringParameters?.nextToken;

        console.log('\n--- Request Parameters ---');
        console.log('Hash:', hash);
        console.log('Page Size Param:', pageSizeParam || 'default (20)');
        console.log('Next Token:', nextTokenParam || 'none (first page)');

        // Parse page size (default 20, max 100)
        const DEFAULT_PAGE_SIZE = 20;
        const MAX_PAGE_SIZE = 100;
        let pageSize = DEFAULT_PAGE_SIZE;

        if (pageSizeParam) {
            const parsed = parseInt(pageSizeParam, 10);
            if (!isNaN(parsed) && parsed > 0) {
                pageSize = Math.min(parsed, MAX_PAGE_SIZE);
            }
        }

        // Decode nextToken to get current page
        let currentPage = 0;
        if (nextTokenParam) {
            try {
                const decoded = JSON.parse(Buffer.from(nextTokenParam, 'base64').toString('utf-8'));
                currentPage = decoded.page || 0;
                console.log('Decoded nextToken - resuming from page:', currentPage);
            } catch (err) {
                console.error('Invalid nextToken:', err.message);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Invalid pagination token',
                        message: 'The nextToken parameter is malformed'
                    })
                };
            }
        }

        // Generate mock call recording data
        const TOTAL_MOCK_RECORDS = 150; // Simulate 150 total records
        const startIndex = currentPage * pageSize;
        const endIndex = Math.min(startIndex + pageSize, TOTAL_MOCK_RECORDS);
        const hasMore = endIndex < TOTAL_MOCK_RECORDS;

        console.log('\n--- Pagination Calculation ---');
        console.log('Total mock records:', TOTAL_MOCK_RECORDS);
        console.log('Page size:', pageSize);
        console.log('Current page:', currentPage);
        console.log('Start index:', startIndex);
        console.log('End index:', endIndex);
        console.log('Has more pages:', hasMore);

        // Create mock items
        const items = [];
        const now = Date.now();
        for (let i = startIndex; i < endIndex; i++) {
            items.push({
                hash: hash,
                epchdatetimestamp: now - (i * 3600000), // Each record 1 hour apart
                callId: `call-${hash.substring(0, 8)}-${String(i + 1).padStart(4, '0')}`,
                transcription: `Mock transcription for call ${i + 1}`,
                sentiment: i % 3 === 0 ? 'positive' : i % 3 === 1 ? 'neutral' : 'negative',
                duration: 120 + (i % 300),
                recordNumber: i + 1,
                placeholder: true
            });
        }

        // Generate nextToken if there are more pages
        let nextToken = null;
        if (hasMore) {
            const nextPageToken = {
                page: currentPage + 1,
                hash: hash,
                timestamp: now
            };
            nextToken = Buffer.from(JSON.stringify(nextPageToken)).toString('base64');
            console.log('Generated nextToken for page:', currentPage + 1);
        }

        console.log(`\n✅ Returning ${items.length} mock items`);
        console.log(`Page ${currentPage + 1} of ${Math.ceil(TOTAL_MOCK_RECORDS / pageSize)}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: `Mock call recording analytics retrieved successfully (Page ${currentPage + 1})`,
                count: items.length,
                items: items,
                pagination: {
                    pageSize: pageSize,
                    currentPage: currentPage,
                    totalPages: Math.ceil(TOTAL_MOCK_RECORDS / pageSize),
                    totalRecords: TOTAL_MOCK_RECORDS,
                    nextToken: nextToken,
                    hasMore: hasMore
                },
                _note: 'This is mock data for testing pagination. Deploy TypeScript code for real DynamoDB integration.',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
