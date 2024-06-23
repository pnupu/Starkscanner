import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as d3 from 'd3';
import { processData } from './dataProcessor.js';
import transactions from './transactions.json';
import './App.css';

const App = () => {
  const svgRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [voyagerTransactionData, setVoyagerTransactionData] = useState(null);
  const [voyagerContractData, setVoyagerContractData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingContract, setLoadingContract] = useState(false);
  const [linkDistance, setLinkDistance] = useState(120);
  const [chargeStrength, setChargeStrength] = useState(-200);
  
  let simulation;

  useEffect(() => {
    initializeGraph();
  }, [linkDistance, chargeStrength]);

  useEffect(() => {
    if (!simulation) return;
  
    simulation.force('link').distance(linkDistance);
    simulation.force('charge').strength(chargeStrength);
    simulation.alpha(1).restart();
  }, [linkDistance, chargeStrength]);
  
  const initializeGraph = () => {
    const savedTransactions = JSON.parse(localStorage.getItem('transactions')) || [];
    const combinedTransactions = [...transactions, ...savedTransactions];
    const uniqueTransactions = Array.from(new Set(combinedTransactions.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));
    localStorage.setItem('transactions', JSON.stringify(uniqueTransactions));

    const { nodes, links } = processData(uniqueTransactions);

    const width = window.innerWidth;
    const height = window.innerHeight;

    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear the SVG content before re-rendering

    svg.attr('width', width).attr('height', height);

    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', 2)
      .attr('stroke', 'gray');

    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', d => d.type === 'transaction' ? 20 : 30)
      .attr('fill', d => {
        if (d.type === 'transaction') return 'red';
        if (d.type === 'contract') return 'green';
        return 'green';
      }).on('click', handleNodeClick)
      .call(d3.drag()
        .on('start', handleDragStart)
        .on('drag', handleDrag)
        .on('end', handleDragEnd));

    const label = svg.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('dy', 4)
      .attr('dx', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text(d => d.id ? `0x${d.id.slice(2, 6)}` : '')
      .on('click', handleNodeClick);

    simulation.nodes(nodes).on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      node
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y);

      label
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y);
    });

    simulation.force('link').links(links);
    nodes.forEach(node => {
      node.x = node.x ? node.x - 10000 : Math.random() * width - 10000;
      node.y = node.y ? node.y : Math.random() * height;
    });
  };

  const handleNodeClick = (event, d) => {
    setVoyagerContractData(null);
    setVoyagerTransactionData(null);
    setSelectedNode(d);
    fetchVoyagerData(d);
  };

  const handleDragStart = (event, d) => {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  };

  const handleDrag = (event, d) => {
    d.fx = event.x;
    d.fy = event.y;
  };

  const handleDragEnd = (event, d) => {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  };

  const handleQueryTransactions = async () => {
    if (selectedNode) {
      setLoading(true);
      console.log('selectedNode', selectedNode);
      try {
        let endpoint;
        let payload;
  
        switch (selectedNode.type) {
          case 'transaction':
            endpoint = '/transactions';
            payload = { TX_HASH: selectedNode.id };
            break;
          case 'contract':
            endpoint = '/contracts';
            payload = { CONTRACT_ADDRESS: selectedNode.id };
            break;
          default:
            endpoint = '/transactions';
            payload = { TX_HASH: selectedNode.id };
        }
  
        console.log('endpoint', endpoint);
        console.log('payload', payload);
        const response = await axios.post(`http://localhost:3002${endpoint}`, payload);
  
        const { requestId } = response.data;
  
        setTimeout(async () => {
          const statusResponse = await axios.get(`http://localhost:3002/query-status/${requestId}`);
          const newTransactionData = statusResponse.data;
  
          // Save new transactions to local storage
          const savedTransactions = JSON.parse(localStorage.getItem('transactions')) || [];
          const combinedTransactions = [...savedTransactions, ...newTransactionData];
          const uniqueTransactions = Array.from(new Set(combinedTransactions.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));
          localStorage.setItem('transactions', JSON.stringify(uniqueTransactions));
  
          // Re-render the graph with new data
          updateGraph(uniqueTransactions);
          window.location.reload();
          setLoading(false);
        }, 5000);
      } catch (error) {
        console.error('Error querying transactions:', error);
        setLoading(false);
      }
    }
    
  };
  

  const updateGraph = (uniqueTransactions) => {
    const { nodes, links } = processData(uniqueTransactions);
    const svg = d3.select(svgRef.current);

    const link = svg.selectAll('.links line')
      .data(links)
      .join('line')
      .attr('stroke-width', 2)
      .attr('stroke', 'gray');

    const node = svg.selectAll('.nodes circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.type === 'transaction' ? 20 : 30)
      .attr('fill', d => d.type === 'transaction' ? 'red' : 'green')
      .on('click', handleNodeClick)
      .call(d3.drag()
        .on('start', handleDragStart)
        .on('drag', handleDrag)
        .on('end', handleDragEnd));

    const label = svg.selectAll('.labels text')
      .data(nodes)
      .join('text')
      .attr('dy', 4)
      .attr('dx', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text(d => d.id ? `0x${d.id.slice(2, 6)}` : '')
      .on('click', handleNodeClick);

      if (simulation) {
        simulation.nodes(nodes).on('tick', () => {
          link
            .attr('x1', (d) => d.source.x)
            .attr('y1', (d) => d.source.y)
            .attr('x2', (d) => d.target.x)
            .attr('y2', (d) => d.target.y);
    
          node
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => d.y);
    
          label
            .attr('x', (d) => d.x)
            .attr('y', (d) => d.y);
        });
        const width = window.innerWidth;
        const height = window.innerHeight;
        nodes.forEach(node => {

          node.x = node.x ? node.x - 10000 : Math.random() * width - 10000;
          node.y = node.y ? node.y : Math.random() * height;
        });
        simulation.force('link').links(links);
        
      } else {
        // reload the page
        window.location.reload();
      }
  };

  const fetchVoyagerData = async (node) => {
    try {
      let url;
      if (node.type === 'transaction') {
        url = `https://api.voyager.online/beta/txns/${node.id}`;
      } else if (node.type === 'contract') {
        url = `https://api.voyager.online/beta/contracts/${node.id}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'accept': 'application/json',
          'x-api-key': process.env.REACT_APP_VOYAGER_API_KEY
        }
      });
        console.log('response', response);
      if (node.type === 'transaction') {
        setVoyagerTransactionData(null);
        setVoyagerContractData(null);
        setVoyagerTransactionData(response.data);
      } else if (node.type === 'contract') {
        setVoyagerTransactionData(null);
        setVoyagerContractData(null);
        setVoyagerContractData(response.data);
      }
    } catch (error) {
      console.error('Error fetching Voyager data:', error);
    }
  };
  
  const handleAddContract = async () => {
    const newContractAddress = prompt("Enter the new contract address:");
    if (newContractAddress) {
      setLoadingContract(true);
      try {
        const response = await axios.post('http://localhost:3002/contracts', { CONTRACT_ADDRESS: newContractAddress });
        const { requestId } = response.data;
  
        setTimeout(async () => {
          const statusResponse = await axios.get(`http://localhost:3002/query-status/${requestId}`);
          const newTransactionData = statusResponse.data;
  
          // Save new transactions to local storage
          const savedTransactions = JSON.parse(localStorage.getItem('transactions')) || [];
          const combinedTransactions = [...savedTransactions, ...newTransactionData];
          const uniqueTransactions = Array.from(new Set(combinedTransactions.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));
          localStorage.setItem('transactions', JSON.stringify(uniqueTransactions));
          setLoadingContract(false);
          window.location.reload(); // Reload the page to update the graph with new data
        }, 5000);
      } catch (error) {
        setLoadingContract(null);
        console.error('Error querying contract transactions:', error);
      }
    }
  };
  
  
  const handleDeleteAllNodes = () => {
    // Clear local storage
    localStorage.removeItem('transactions');
    window.location.reload();
  };
  
  
  return (
    <div className="container">
      <div className="top-right-corner">
      <h1>Transaction Viewer</h1> 
      <button onClick={handleAddContract} disabled={loadingContract}>
      {loadingContract ? "Loading..." : "Add New Contract"}
    </button>
      <button onClick={handleDeleteAllNodes}>Delete All Nodes</button>
      <div className="settings">
    <h2>Settings</h2>
    <label>
      Link Distance:
      <input 
        type="range" 
        min="50" 
        max="300" 
        value={linkDistance} 
        onChange={(e) => setLinkDistance(e.target.value)} 
      />
    </label>
    <br />
    <label>
      Charge Strength:
      <input 
        type="range" 
        min="-300" 
        max="0" 
        value={chargeStrength} 
        onChange={(e) => setChargeStrength(e.target.value)} 
      />
    </label>
  </div>
    </div>
      <svg ref={svgRef}></svg>
      {selectedNode && (
        <div className="info-panel">
              <button className="close-button" onClick={() => setSelectedNode(null)}>Close</button>

          <h2>Node Information</h2>
          <p>
            <strong>ID: {" "}</strong>
            {selectedNode.type === 'transaction' ? (
              <a href={`https://voyager.online/tx/${selectedNode.id}`} target="_blank" rel="noopener noreferrer">
                {selectedNode.id}
              </a>
            ) : (
              <a href={`https://voyager.online/contract/${selectedNode.id}`} target="_blank" rel="noopener noreferrer">
                {selectedNode.id}
              </a>
            )}
          </p>         
          <p><strong>Type:</strong> {selectedNode.type}</p>
          <button onClick={handleQueryTransactions} disabled={loading}>
            {loading ? 'Loading...' : 'Query database'}
          </button>
          {loading && <div className="loading-animation"></div>}
          {voyagerTransactionData && (
      <div>
        <h3>Voyager Transaction Data</h3>
        <ul>
          <li><strong>Actual Fee:</strong> {voyagerTransactionData.actualFee}</li>
          <li><strong>Nonce:</strong> {voyagerTransactionData.nonce}</li>
          <li><strong>Block Number:</strong> {voyagerTransactionData.blockNumber}</li>
          <li><strong>Contract Address:</strong> {voyagerTransactionData.contractAddress}</li>
          <li><strong>Transaction Hash:</strong> {voyagerTransactionData.hash}</li>
          <li><strong>L1 Verification Hash:</strong> {voyagerTransactionData.l1VerificationHash}</li>
          <li><strong>Max Fee:</strong> {voyagerTransactionData.maxFee}</li>
          <li><strong>Sender Address:</strong> {voyagerTransactionData.senderAddress}</li>
          <li><strong>Signature:</strong> {voyagerTransactionData.signature.join(', ')}</li>
          <li><strong>Status:</strong> {voyagerTransactionData.status}</li>
          <li><strong>Timestamp:</strong> {new Date(voyagerTransactionData.timestamp * 1000).toLocaleString()}</li>
          <li><strong>Type:</strong> {voyagerTransactionData.type}</li>
          <li><strong>Version:</strong> {voyagerTransactionData.version}</li>
          <li><strong>Revert Error:</strong> {voyagerTransactionData.revertError || 'None'}</li>
        </ul>
      </div>
    )}
    {voyagerContractData && (
      <div>
        <h3>Voyager Contract Data</h3>
        <ul>
          <li><strong>Address:</strong> {voyagerContractData.address}</li>
          <li><strong>Block Hash:</strong> {voyagerContractData.blockHash}</li>
          <li><strong>Block Number:</strong> {voyagerContractData.blockNumber}</li>
          <li><strong>Class Hash:</strong> {voyagerContractData.classHash}</li>
          <li><strong>Contract Alias:</strong> {voyagerContractData.contractAlias || 'None'}</li>
          <li><strong>Creation Timestamp:</strong> {new Date(voyagerContractData.creationTimestamp * 1000).toLocaleString()}</li>
          <li><strong>Is Account:</strong> {voyagerContractData.isAccount ? 'Yes' : 'No'}</li>
          <li><strong>Is ERC Token:</strong> {voyagerContractData.isErcToken ? 'Yes' : 'No'}</li>
          <li><strong>Is Proxy:</strong> {voyagerContractData.isProxy ? 'Yes' : 'No'}</li>
          <li><strong>Type:</strong> {voyagerContractData.type}</li>
          <li><strong>Version:</strong> {voyagerContractData.version}</li>
          <li><strong>Token Name:</strong> {voyagerContractData.tokenName}</li>
          <li><strong>Token Symbol:</strong> {voyagerContractData.tokenSymbol}</li>
        </ul>
      </div>
    )}
        </div>
      )}
    </div>
  );
};

export default App;
