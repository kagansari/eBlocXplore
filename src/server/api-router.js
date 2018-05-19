const express = require('express');

const router = express.Router();
const { web3 } = global;

/**
 * surround a promise with try/catch block
 * @param  {AsyncFunction} fn
 * @return {AsyncFunction}
 */
function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      res.sendStatus(500);
    }
  };
}

const isHash = hash => /^(0x)?[0-9a-f]{64}$/.test(hash) || /^(0x)?[0-9A-F]{64}$/.test(hash);

const isBlockNumber = blockNumber => /^\d{1,7}$/.test(blockNumber);

/**
 * get all blocks between {start} and {start + length}
 * @param  {integer} start  first block
 * @param  {integer} length
 * @return {array}          blocks in descending order
 */
async function getBlocks(start, length) {
  const promises = [];
  for (let i = start; i <= start + length; i++) {
    promises.push(web3.eth.getBlock(i));
  }
  const blocks = await Promise.all(promises);
  // first block is the most recent one
  return blocks.sort((a, b) => b.number - a.number);
}

/**
 * get all txs between {start} and {start + length}
 * @param  {integer} start  first tx index
 * @param  {integer} length
 * @return {array}          blocks in descending order
 */
async function getTxs(start, length) {
  const txDocs = await global.db.collection('txs')
    .find({})
    .skip(start)
    .limit(length)
    .toArray();

  const promises = txDocs.map(tx => web3.eth.getTransaction(tx._id));
  const txs = await Promise.all(promises);

  // get block numbers and remove duplicates
  const blockNumbers = txs
    .map(tx => tx.blockNumber)
    .filter((blockNum, i, arr) => arr.indexOf(blockNum) === i);

  // get globks and transform into object as { blockNumber: block }
  const blockArr = await Promise.all(blockNumbers.map(web3.eth.getBlock));
  const blockObj = {};
  for (const block of blockArr) {
    blockObj[block.number] = block;
  }

  for (const tx of txs) {
    tx.blockTimestamp = blockObj[tx.blockNumber].timestamp;
    tx.value = web3.utils.fromWei(tx.value);
  }
  return txs;
}

/**
 * get at most 25 txs of an address on at most last 100 blocks
 * @param  {string} address
 * @return {[Transaction]}
 */
async function getTxsByAddress(address) {
  const query = {
    $or: [
      { from: address },
      { to: address },
    ],
  };
  const txDocs = await global.db.collection('txs').find(query).toArray();

  const promises = txDocs.map(tx => web3.eth.getTransaction(tx._id));
  const txs = await Promise.all(promises);

  return txs;
}

/**
 * returns last {length} blocks
 * query
 *  - length (100)
 */
router.get('/recentBlocks', async (req, res) => {
  const length = req.query.length || 100;
  const lastBlockNum = await web3.eth.getBlockNumber();

  const blocks = await getBlocks(lastBlockNum - length, length);

  const result = blocks.map(block => ({
    number: block.number,
    miner: block.miner,
    timestamp: block.timestamp,
    txCount: block.transactions.length,
  }));
  res.send(result);
});

/**
 * get appropriate data for datatables library to fill blocks table,
 * returns latest 25 blocks if no parameters given
 *
 * query
 * - draw   {integer} chunk index (0)
 * - order  {array}   options for sorting, we only use block number at the moment ([{dir:'desc'}])
 * - start  {integer} starting block number (0)
 * - length {integer} size of the block chunk (25)
 */
router.get('/datatableBlocks', async (req, res) => {
  const totalBlockNumber = await web3.eth.getBlockNumber();

  const draw = Number(req.query.draw) || 0;
  const orderDirection = req.query.order[0].dir || 'desc'; // asc|desc
  let start = Number(req.query.start) || 0;
  let length = Number(req.query.length) || 25;
  if (orderDirection === 'desc') start = totalBlockNumber - start - length;

  // trim out-of-range indices
  if (start < 0) {
    length += start; // lengh of the last page can be less then default length
    start = 0;
  }
  length = Math.min(length, totalBlockNumber - start);

  const blocks = await getBlocks(start, length);
  // blocks start from the latest if showing in ascending order
  if (orderDirection === 'asc') blocks.sort((a, b) => a.number - b.number);

  res.send({
    draw,
    recordsTotal: totalBlockNumber,
    recordsFiltered: totalBlockNumber,
    data: blocks,
  });
});

/**
 * get last {length} transactions for datatables library
 *
 * query
 * - draw   {integer} chunk index (0)
 * - start  {integer} starting tx number (0)
 * - length {integer} size of the tx chunk (25)
 */
router.get('/datatableTx', wrap(async (req, res) => {
  const totalTxNumber = await global.db.collection('txs').find({}).count();

  const draw = Number(req.query.draw) || 0;
  let start = Number(req.query.start) || 0;
  let length = Number(req.query.length) || 25;

  start = totalTxNumber - start - length;
  // trim out-of-range indices
  if (start < 0) {
    length += start;
    start = 0;
  }
  length = Math.min(length, totalTxNumber - start);

  const txs = (await getTxs(start, length)).reverse();

  res.send({
    draw,
    recordsTotal: totalTxNumber,
    recordsFiltered: totalTxNumber,
    data: txs,
  });
}));

/**
 * search for block|address|tx
 *
 * params
 * - query {string} block number, address or hash
 * result
 * - type  {string} block|address|tx
 * - data  {object}
 */
router.get('/search/:query', wrap(async (req, res) => {
  const { query } = req.params;
  let result;

  if (web3.utils.isAddress(query)) {
    result = {
      type: 'address',
      data: {
        address: query,
        balance: web3.utils.fromWei(await web3.eth.getBalance(query), 'ether'),
        txs: await getTxsByAddress(query),
      },
    };
  } else if (isBlockNumber(query)) {
    const block = await web3.eth.getBlock(query);
    if (block) {
      result = {
        type: 'block',
        data: block,
      };
    }
  } else if (isHash(query)) {
    const tx = await web3.eth.getTransaction(query);
    if (tx) {
      result = {
        type: 'tx',
        data: tx,
      };
    }

    const block = await web3.eth.getBlock(query);
    if (block) {
      result = {
        type: 'block',
        data: block,
      };
    }
  }

  if (result) res.send(result);
  else res.sendStatus(404);
}));

module.exports = router;