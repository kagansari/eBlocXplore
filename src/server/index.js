const path = require('path');
const Web3 = require('web3');
const express = require('express');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
// const yargs = require('yargs');

require('dotenv').config(); // collect environment variables from .env file

// command line arguments
// const args = yargs
//   .default('cron', true) // start cronjobs
//   .argv;

const web3 = new Web3(Web3.givenProvider || process.env.WEB3_PROVIDER);
global.web3 = web3;

if (!web3.eth.net.isListening()) {
  console.error('Cannot connect to ethereum network'); // eslint-disable-line no-console
} else {
  console.log('Connected to ethereum network'); // eslint-disable-line no-console
}

const app = express();

if (process.env.NODE_ENV !== 'production') {
  // refresh browser
  require('reload')(app); // eslint-disable-line import/no-extraneous-dependencies, global-require
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));
// 3rd party libraries @TODO: use webpack
app.use('/jquery', express.static(path.join(__dirname, '../../node_modules/jquery/dist/')));
app.use('/popper.js', express.static(path.join(__dirname, '../../node_modules/popper.js/dist/')));
app.use('/bootstrap', express.static(path.join(__dirname, '../../node_modules/bootstrap/dist/')));
app.use('/font-awesome', express.static(path.join(__dirname, '../../node_modules/font-awesome')));
app.use('/datatables.net', express.static(path.join(__dirname, '../../node_modules/datatables.net/js/')));
app.use('/datatables.net-bs4', express.static(path.join(__dirname, '../../node_modules/datatables.net-bs4/')));

app.use('/api', require('./api-router'));

(async () => {
  try {
    await app.listen(process.env.PORT);
    console.log(`App listening at http://localhost:${process.env.PORT}`); // eslint-disable-line no-console

    const mongoConn = await mongodb.MongoClient.connect(process.env.MONGODB_URL, {
      server: {
        socketOptions: { connectTimeoutMS: 300000 },
      },
    });
    global.db = mongoConn.db(process.env.NETWORK_NAME);
    console.log(`Connected to database ${process.env.MONGODB_URL}`); // eslint-disable-line no-console

    // if (args.cron) {
    //   crons.start();
    //   console.log('Crons started'); // eslint-disable-line no-console
    // }
  } catch (err) {
    console.error(err); // eslint-disable-line no-console
  }
})();
