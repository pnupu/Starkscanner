export const processData = (transactions) => {
  const nodesMap = new Map();
  const links = [];

  transactions.forEach((transaction) => {
    const txHash = transaction.TX_HASH;
    const contractAddress = transaction.CONTRACT_ADDRESS;
    const from = transaction.FROM_ADDRESS;
    const to = transaction.TO_ADDRESS;
    const callData = transaction.CALL_DATA;
    const parameters = transaction.PARAMETERS ? JSON.parse(transaction.PARAMETERS) : null;
    const fromParam = parameters ? parameters.from : null;
    const toParam = parameters ? parameters.to : null;

    // Add transaction node
    if (!nodesMap.has(txHash)) {
      nodesMap.set(txHash, { id: txHash, type: 'transaction' });
    }

    // Add contract address node if exists
    if (contractAddress && contractAddress !== '0x' && !nodesMap.has(contractAddress)) {
      nodesMap.set(contractAddress, { id: contractAddress, type: 'contract' });
    }

    // Add from address node if exists
    if (from && from !== '0x' && !nodesMap.has(from)) {
      nodesMap.set(from, { id: from, type: 'contract' });
    }

    // Add to address node if exists
    if (to && to !== '0x' && !nodesMap.has(to)) {
      nodesMap.set(to, { id: to, type: 'contract' });
    }

    // Add from parameter address node if exists
    if (fromParam && fromParam !== '0x' && !nodesMap.has(fromParam)) {
      nodesMap.set(fromParam, { id: fromParam, type: 'contract' });
    }

    // Add to parameter address node if exists
    if (toParam && toParam !== '0x' && !nodesMap.has(toParam)) {
      nodesMap.set(toParam, { id: toParam, type: 'contract' });
    }

    // Add links for old data format
    if (from && from !== '0x') {
      links.push({
        source: from,
        target: txHash,
        callData,
      });
    }

    if (to && to !== '0x') {
      links.push({
        source: txHash,
        target: to,
        callData,
      });
    }

    // Add links for new data format
    if (fromParam && fromParam !== '0x') {
      links.push({
        source: fromParam,
        target: txHash,
        callData: transaction.PARAMETERS,
      });
    }

    if (toParam && toParam !== '0x') {
      links.push({
        source: txHash,
        target: toParam,
        callData: transaction.PARAMETERS,
      });
    }

    if (contractAddress && contractAddress !== '0x') {
      links.push({
        source: contractAddress,
        target: txHash,
        callData: transaction.PARAMETERS,
      });
    }
  });

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  };
};
