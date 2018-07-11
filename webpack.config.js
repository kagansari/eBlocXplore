const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/client/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: ['env'],
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  // resolve: { extensions: ['*', '.js', '.jsx'] },
  devServer: {
    contentBase: [path.resolve(__dirname, 'dist'), path.resolve(__dirname, 'src/client/public')],
    publicPath: 'http://localhost:8080/', // for HMR
    hotOnly: true,
    historyApiFallback: {
      index: 'index.html',
    },
  },
  devtool: 'inline-source-map',
  plugins: [new webpack.HotModuleReplacementPlugin()],
  mode: 'development',
};
