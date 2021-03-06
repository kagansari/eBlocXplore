import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const mapStateToProps = (state) => {
  return { accounts: state.accounts };
}

class MyAccounts extends React.Component {
  static propTypes = {
    accounts: PropTypes.object,
  }

  // close sidebar
  closeMyAccounts = e => {
    e.preventDefault();
    document.getElementById('MyAccounts').classList.remove('active');
    document.getElementById('Route').classList.remove('my-accounts-active');
  }

  // render "My accounts" part inside
  renderAccounts = () => {
    const { accounts } = this.props;

    return (
      <div>
        <div className="d-flex justify-content-between align-items-center p-3">
          <h6 className="m-0 font-weight-light">MY ACCOUNTS</h6>
          <a href="#" className="px-3 text-tertiary" onClick={this.closeMyAccounts}><FontAwesomeIcon icon="chevron-left" size="2x"/></a>
        </div>
        {/* if user has account, show them in list, else show no account info */}
        {
          Object.keys(accounts).length
          ? (
            <ul className="list-group">
              { Object.keys(accounts).map(account =>
                <li key={ account } className="list-group-item p-0 bg-transparent border-right-0 border-left-0 border-top-0">
                  <Link to={`/accounts/${account}`} className="d-block p-3 text-dark">
                    <div className="text-truncate mb-1">{ accounts[account] }</div>
                    <div className="text-truncate text-secondary font-weight-light">{ account }</div>
                  </Link>
                </li>
              )}
            </ul>
          ) : (
            <div className="p-2">You do not have any accounts</div>
          )
        }
      </div>
    );
  }

  render() {
    return (
      <div id="MyAccounts" className="active bg-light border-right">
        { this.renderAccounts() }
      </div>
    );
  }
}

export default connect(mapStateToProps)(MyAccounts);