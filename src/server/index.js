const path = require('path');
const Web3 = require('web3');
const express = require('express');
const bodyParser = require('body-parser');

require('dotenv').config(); // collect environment variables from .env file

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

app.use('/api', require('./apiRouter'));

require('./server2.js')(web3, app); // @TODO: remove this after all functions are imported

app.listen(process.env.PORT, () => {
  console.log(`App listening at http://localhost:${process.env.PORT}`); // eslint-disable-line no-console
});
