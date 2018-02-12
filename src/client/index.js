// datatable objects
var blocksTable;
var txTable; // eslint-disable-line no-unused-vars

/**
 * get element HTML string for address
 * @param  {string} address|
 * @param  {number} truncatedLength do not truncate if undefined (undefined)
 * @param  {number} noLink          do not cover with link
 * @return {string}                 html string
 */
function getAddressLink(address, truncatedLength, noLink) {
  if (!address) address = ''; // @TODO: handle when address is empty
  var truncated = address;
  if (truncatedLength) truncated = address.slice(0, truncatedLength) + '...';

  if (noLink) return '<a data-address="' + address + '">' + truncated + '</a>';
  return '<a href="javascript:void(0)" onclick="addressClicked(\'' + address + '\')">' + truncated + '</a>';
}

/**
 * get element HTML string for tx
 * @param  {string} address|
 * @param  {number} truncatedLength do not truncate if undefined (undefined)
 * @return {string}                 html string
 */
function getTxLink(hash, truncatedLength) {
  var truncated = hash;
  if (truncatedLength) truncated = hash.slice(0, truncatedLength) + '...';
  return '<a href="javascript:void(0)" onclick="txClicked(\'' + hash + '\')">' + truncated + '</a>';
}

function openBlockModal(block) {
  $('.modal').modal('hide');
  block.time = (new Date(block.timestamp * 1000)).toLocaleString();
  block.minerHTML = getAddressLink(block.miner);
  block.parentHashHTML = getTxLink(block.parentHash);

  $('#blockModal [data-header]')[0].innerHTML = 'Block #' + block.number;
  $('#blockModal td[data-property]').each(function (i, el) {
    var property = el.getAttribute('data-property');
    el.innerHTML = block[property];
  });
  $('#blockModal').modal('show');
}

function openTxModal(tx) {
  $('.modal').modal('hide');
  tx.blockNumberHTML = '<a href="javascript:void(0)" onclick="blockClicked(' + tx.blockNumber + ')">' + tx.blockNumber + '</a>';
  tx.fromHTML = getAddressLink(tx.from);
  tx.toHTML = getAddressLink(tx.to);

  $('#txModal [data-header]')[0].innerHTML = 'Tx ' + tx.hash;
  $('#txModal td[data-property]').each(function (i, el) {
    var property = el.getAttribute('data-property');
    el.innerHTML = tx[property];
  });
  $('#txModal').modal('show');
}

function openAddressModal(data) {
  $('.modal').modal('hide');
  $('#addressModal [data-header]')[0].innerHTML = 'Address ' + data.address;
  $('#addressModal [data-property="balance"]')[0].innerHTML = data.balance;
  var html = data.txs.reduce(function (acc, tx) {
    acc += '<tr><td>' + getTxLink(tx.hash, 20) + '</td>';
    acc += '<td>' + getAddressLink(tx.from, 20, tx.from === data.address) + '</td>';
    acc += '<td>' + getAddressLink(tx.to, 20, tx.to === data.address) + '</td>';
    acc += '<td>' + tx.value + '</td></tr>';
    return acc;
  }, '');
  $('#addressModal tbody')[0].innerHTML = html;
  $('#addressModal').modal('show');
}

function blockClicked(blockNumber) { // eslint-disable-line no-unused-vars
  var currentBlocks = blocksTable.ajax.json().data;
  var block = currentBlocks.find(function (b) { return b.number === blockNumber; });
  openBlockModal(block);
  return block;
}

function addressClicked(address) { // eslint-disable-line no-unused-vars
  $.get('/api/search/' + address, function (result) {
    if (result) {
      openAddressModal(result.data);
    }
  });
}

function txClicked(hash) { // eslint-disable-line no-unused-vars
  $.get('/api/search/' + hash, function (result) {
    if (result) {
      openTxModal(result.data);
    }
  });
}

function initSearch() {
  $('#searchForm').submit(function (e) {
    e.preventDefault();
    $('#notFound').addClass('d-none');
    var query = $('#searchForm input[name="query"]').val();

    $.get('/api/search/' + query, function (result) {
      if (result.type === 'block') {
        openBlockModal(result.data);
      } else if (result.type === 'tx') {
        openTxModal(result.data);
      } else if (result.type === 'address') {
        openAddressModal(result.type);
      } else {
        $('#notFound').removeClass('d-none');
      }
    }).fail(function () {
      $('#notFound').removeClass('d-none');
    });
  });
}

function fillBlocksTable() {
  blocksTable = $('#recentBlocksTable').DataTable({
    serverSide: true,
    ajax: '/api/datatableBlocks',
    searching: false,
    order: [0, 'desc'],
    columns: [
      {
        title: 'Block',
        data: 'number',
        render: function (data, type, row) {
          var numString = $.fn.dataTable.render.number(',', '.').display(data, type, row);
          return '<a href="javascript:void(0)" onclick="blockClicked(' + data + ')">' + numString + '</a>';
        },
      }, {
        title: 'Time',
        data: 'timestamp',
        orderable: false,
        render: function (data) {
          return (new Date(data * 1000)).toLocaleString();
        },
      }, {
        title: 'TXN',
        data: 'transactions.length',
        orderable: false,
      },
      {
        title: 'Miner',
        data: 'miner',
        orderable: false,
        className: 'ellipsis',
        render: function (data) { return getAddressLink(data, 20); },
      }, {
        title: 'Gas used',
        data: 'gasUsed',
        orderable: false,
        render: function (data, type, row) {
          // how much of gas limit is used
          var percent = (data / row.gasLimit) * 100;
          // format gasUsed integer
          var numString = $.fn.dataTable.render.number(',', '.').display(data, type, row);
          return numString + ' (' + percent.toFixed(2) + '%)';
        },
      }, {
        title: 'Gas limit',
        data: 'gasLimit',
        orderable: false,
        render: $.fn.dataTable.render.number(',', '.'),
      },
      // { data: null }, // @TODO: avg gas price
      // { data: null }, // @TODO: reward
      {
        title: 'Uncles',
        data: 'uncles.length',
        orderable: false,
      },
    ],
  });
}

function fillTxTable() {
  txTable = $('#recentTxTable').DataTable({
    ajax: '/api/datatableTx',
    searching: false,
    ordering: false,
    paging: false,
    columns: [
      {
        title: 'Tx Hash',
        data: 'hash',
        render: function (data) { return getTxLink(data, 20); },
      }, {
        title: 'From',
        data: 'from',
        render: function (data) { return getAddressLink(data, 20); },
      }, {
        // arrow
        data: null,
        className: '',
        defaultContent: '<i class="fa fa-lg fa-long-arrow-right"></i>',
      }, {
        title: 'To',
        data: 'to',
        render: function (data) { return getAddressLink(data, 20); },
      }, {
        title: 'Amount (ETH)',
        data: 'value',
      },
      // { data: null }, // @TODO: tx fee
      {
        title: 'Time',
        data: 'blockTimestamp',
        render: function (data) {
          return (new Date(data * 1000)).toLocaleString();
        },
      }, {
        title: 'Block',
        data: 'blockNumber',
        render: function (data, type, row) {
          var numString = $.fn.dataTable.render.number(',', '.').display(data, type, row);
          return '<a href="javascript:void(0)" onclick="blockClicked(' + data + ')">' + numString + '</a>';
        },
      },
    ],
  });
}

$(document).ready(fillBlocksTable);
$(document).ready(fillTxTable);
$(document).ready(initSearch);
