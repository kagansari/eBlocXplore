const Web3 = require('web3');
const mongodb = require('mongodb');
const path = require('path');
const net = require('net');

require('dotenv').config(); // collect environment variables from .env file

const ipcFile = path.join(__dirname, `../blockchain/${process.env.NETWORK_NAME}/geth.ipc`);
const web3 = new Web3(ipcFile, net);
let db;

const sleep = milliseconds => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

/**
 * get transactions between given blocks and store them in db
 * @param  {integer} startBlock
 * @param  {integer} endBlock
 */
const syncBlocks = async (startBlock, endBlock) => {
  const promises = [];
  for (let i = startBlock; i <= endBlock; i++) {
    promises.push(web3.eth.getBlock(i, true));
  }

  const blocks = await Promise.all(promises);
  const blocksWithTx = blocks.filter(block => block.transactions.length);

  // accumulate txs into one array
  const txs = blocksWithTx.reduce((acc, block) => {
    acc.push(...block.transactions);
    return acc;
  }, []);

  // insert txs into db
  const txDocuments = txs.map(tx => ({
    _id: tx.hash,
    from: tx.from,
    to: tx.to,
  }));

  let outputStr = `Blocks from ${startBlock} to ${endBlock} syncing, `;
  if (txDocuments.length) {
    try {
      const result = await db.collection('txs').insertMany(txDocuments, { ordered: false });
      outputStr += `${result.insertedCount} of ${txs.length} txs indexed`;
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
    }
  } else {
    outputStr += 'No transaction found';
  }
  console.log(outputStr); // eslint-disable-line no-console

  // lastSyncedBlock += chunkSize;
  await db.collection('settings').updateOne(
    { collection: 'txs' },
    { $set: { lastSyncedBlock: endBlock } },
    { upsert: true },
  );
};

/**
 * continue to fetch txs of {chunkSize} blocks, get their txs and insert into 'txs' collections,
 * store the last block # in 'settings' collection, and continue from it when server restarted
 *
 * to restart process use this in mongo shell
 * db.txs.remove({});db.settings.updateOne({ collection: 'txs' }, { $set: { lastSyncingBlock: 0 } })
 *
 * @TODO: unify 'txs' and 'settings' collection operations in bulkWrite,
 * possible errors when server stopped between them
 *
 * @param {integer} chunkSize # of blocks to sync
 * @return {@TODO}
 */
const continueSyncingTxs = async (chunkSize) => {
  // find the last block with indexed transactions
  let txsSettings = await db.collection('settings').findOne({ collection: 'txs' });
  if (!txsSettings) {
    txsSettings = {
      collection: 'txs',
      lastSyncedBlock: -1,
    };
    await db.collection('settings').insertOne(txsSettings);
  }

  const lastBlock = await web3.eth.getBlockNumber();

  const startBlock = txsSettings.lastSyncedBlock + 1 || 0;
  const endBlock = Math.min(startBlock + (chunkSize - 1), lastBlock);

  // if all blocks are not synchronized
  if (endBlock > startBlock) {
    await syncBlocks(startBlock, endBlock);
  } else {
    await sleep(1000 * 30);
  }

  // recursively continue
  await continueSyncingTxs(chunkSize);
};

const run = async () => {
  try {
    // create db connection
    const mongoConn = await mongodb.MongoClient.connect(process.env.MONGODB_URL, {
      server: {
        socketOptions: { connectTimeoutMS: 300000 },
      },
    });
    db = mongoConn.db(process.env.NETWORK_NAME);
    await db.createCollection('settings', { autoIndexId: false });
    await db.collection('txs').createIndex({ from: 1, to: 1 });
    await continueSyncingTxs(200);
  } catch (err) {
    console.error(err); // eslint-disable-line no-console
  }

  process.exit();
};

run();
