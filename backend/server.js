// server.js

const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config(); // Load the environment variables from the .env file

const app = express();
const port = 3002;

// Replace with your Snowflake account information
const snowflakeAccount = process.env.SNOWFLAKE_ACCOUNT;
const snowflakeDatabase = process.env.SNOWFLAKE_DATABASE;
const authToken = `Bearer ${process.env.SNOWFLAKE_JWT}`; // Read JWT from .env file

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// Endpoint to submit a SQL query to Snowflake for wallet transactions
app.post('/wallet', async (req, res) => {
    const address = req.body.address; // Get the address from the request body

    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    const sqlQuery = `
    SELECT TX_HASH, FROM_ADDRESS, TO_ADDRESS, CALL_DATA
    FROM STARKNET_DATA_WAREHOUSE__T1.STARKNET.TRANSACTIONS
    WHERE FROM_ADDRESS='${address}' OR TO_ADDRESS='${address}';
    `;
    const requestId = uuidv4();
    const snowflakeApiUrl = `https://${snowflakeAccount}.snowflakecomputing.com/api/v2/statements?requestId=${requestId}`;

    const requestBody = {
        statement: sqlQuery,
        timeout: 300, // in seconds
        // warehouse: snowflakeWarehouse,
        database: snowflakeDatabase,
        // schema: snowflakeSchema
    };

    try {
        const response = await axios.post(snowflakeApiUrl, requestBody, {
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'myApplication/1.0',
                'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT'
            }
        });
        res.json({ requestId, statusUrl: response.data.statementStatusUrl });
    } catch (error) {
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
});

// Endpoint to submit a custom SQL query to Snowflake
app.post('/transactions', async (req, res) => {
    const TX_HASH = req.body.TX_HASH; // Get the TX_HASH from the request body

    if (!TX_HASH) {
        return res.status(400).json({ error: 'TX_HASH is required' });
    }

    const sqlQuery = `
    select TX_HASH, CONTRACT_ADDRESS, EVENT_SIGNATURE, EVENT_NAME, PARAMETERS
    from STARKNET_DATA_WAREHOUSE__T1.STARKNET.EVENTS
    WHERE TX_HASH='${TX_HASH}';
    `;

    const requestId = uuidv4();
    const snowflakeApiUrl = `https://${snowflakeAccount}.snowflakecomputing.com/api/v2/statements?requestId=${requestId}`;

    const requestBody = {
        statement: sqlQuery,
        timeout: 300, // in seconds
        // warehouse: snowflakeWarehouse,
        database: snowflakeDatabase,
        // schema: snowflakeSchema
    };

    try {
        const response = await axios.post(snowflakeApiUrl, requestBody, {
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'myApplication/1.0',
                'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT'
            }
        });
        console.log(response.data);

        res.json({ requestId: response.data.statementHandle, statusUrl: response.data.statementHandle });
    } catch (error) {
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
});


app.post('/contracts', async (req, res) => {
    const CONTRACT_ADDRESS = req.body.CONTRACT_ADDRESS; // Get the CONTRACT_ADDRESS from the request body

    if (!CONTRACT_ADDRESS) {
        return res.status(400).json({ error: 'CONTRACT_ADDRESS is required' });
    }

    const sqlQuery = `
    select TX_HASH, CONTRACT_ADDRESS, EVENT_SIGNATURE, EVENT_NAME, PARAMETERS
    from STARKNET_DATA_WAREHOUSE__T1.STARKNET.EVENTS
    WHERE CONTRACT_ADDRESS = '${CONTRACT_ADDRESS}';`;

    const requestId = uuidv4();
    const snowflakeApiUrl = `https://${snowflakeAccount}.snowflakecomputing.com/api/v2/statements?requestId=${requestId}`;

    const requestBody = {
        statement: sqlQuery,
        timeout: 300, // in seconds
        // warehouse: snowflakeWarehouse,
        database: snowflakeDatabase,
        // schema: snowflakeSchema
    };

    try {
        const response = await axios.post(snowflakeApiUrl, requestBody, {
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'myApplication/1.0',
                'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT'
            }
        });
        console.log(response.data);

        res.json({ requestId: response.data.statementHandle, statusUrl: response.data.statementHandle });
    } catch (error) {
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
});
// Endpoint to check the status of a query execution
app.get('/query-status/:requestId', async (req, res) => {
    const { requestId } = req.params;
    const snowflakeApiUrl = `https://${snowflakeAccount}.snowflakecomputing.com/api/v2/statements/${requestId}`;

    try {
        const response = await axios.get(snowflakeApiUrl, {
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'myApplication/1.0',
                'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT'
            }
        });

        const resultSetMetaData = response.data.resultSetMetaData;
        const rowType = resultSetMetaData.rowType;
        const data = response.data.data;

        // Extract row names
        const rowNames = rowType.map(row => row.name);

        // Format the data
        const formattedData = data.map(row => {
            const rowData = {};
            row.forEach((value, index) => {
                rowData[rowNames[index]] = value;
            });
            return rowData;
        });

        // Save the formatted data to a JSON file
        fs.writeFileSync('response.json', JSON.stringify(formattedData, null, 2));
        res.json(formattedData);
    } catch (error) {
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
