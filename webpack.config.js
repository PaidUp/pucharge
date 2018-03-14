var path = require('path')
var nodeExternals = require('webpack-node-externals')

let wpc = {
  target: 'node',
  externals: [nodeExternals()],
  entry: './src/index.js',
  devtool: '#eval',

  output: {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/dist/',
    filename: 'build.js'
  },

  module: {
    rules: [
      {
        test: /\.(js)$/,
        loader: 'eslint-loader',
        enforce: 'pre',
        include: [path.resolve(__dirname, './src')]
      },
      {
        test: /\.(js)$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}

module.exports = wpc
