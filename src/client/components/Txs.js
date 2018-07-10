import React from 'react';
import { PropTypes } from 'prop-types';

import utils from '../utils/index';

function txClicked(e, hash) {
  console.log('clicked tx hash', hash);
}

export default class Txs extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      txs: props.txs,
    };
  }

  render() {
    const { txs } = this.state;
    return (
      <div>
        {
          txs.map(tx => (
            <div key={tx.hash} className="card">
              <div className="card-body">
                <div className="card-title">
                  <a href="#@todo" onClick={e => txClicked(e, tx.hash)}><h4>{tx.hash.slice(0, 20)}...</h4></a>
                </div>
                <div><span>From:</span>{utils.addressLink(tx.from)}</div>
                <div><span>To:</span>{utils.addressLink(tx.to)}</div>
                <div>
                  { Number(tx.value) ? <span> Value: {tx.value}</span> : <span>No value</span> }
                </div>
              </div>
            </div>
          ))
        }
      </div>
    );
  }
}

Txs.propTypes = {
  txs: PropTypes.array.isRequired,
};