const net = require('net');

const client = new net.Socket();

const PACKET = JSON.stringify({
    header: {
        auth_token: "SECRET_123",
        method: "UPLOAD_FILE",
        timestamp: Date.now(),
        request_id: "test_manual_1"
    },
    body: {
        filename: "convex_test_manual.txt",
        content: "This file should appear in the Convex dashboard!"
    }
}) + "\n";

client.connect(8080, 'localhost', () => {
    console.log("Connected to RPC server...");
    client.write(PACKET);
});

client.on('data', (data) => {
    console.log("Response from server:", data.toString().trim());
    client.destroy();
});
