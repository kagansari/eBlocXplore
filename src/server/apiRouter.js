const express = require('express');

const router = express.Router();
const { web3 } = global;

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
 * - length {integer} size of the block chunk (25)
 */
router.get('/datatableTx', async (req, res) => {
  const totalBlockNumber = await web3.eth.getBlockNumber();
  const txHashes = [];
  const length = req.query.length || 25;
  const blocks = {}; // {hash: block}, to be used for block assignment later

  // get tx hashes from the latest blocks until length is completed
  let nextBlockNum = totalBlockNumber;
  while (txHashes.length < length) {
    const nextBlock = await web3.eth.getBlock(nextBlockNum); // eslint-disable-line no-await-in-loop
    blocks[nextBlock.hash] = nextBlock;
    txHashes.push(...nextBlock.transactions);
    nextBlockNum--;
  }

  // get all transactions in parallel
  const txPromises = txHashes.slice(0, length).map(web3.eth.getTransaction);
  const txs = await Promise.all(txPromises);

  // assign timestamp property, convert wei to eth
  txs.forEach((tx, index) => {
    const block = blocks[tx.blockHash];
    txs[index].blockTimestamp = block.timestamp;
    txs[index].value = web3.utils.fromWei(tx.value, 'ether');
  });

  res.send({ data: txs });
});

module.exports = router;