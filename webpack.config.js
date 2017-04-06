const nodeExternals = require('webpack-node-externals')
const path = require('path')


module.exports = {
  externals: [nodeExternals()],
  entry: path.resolve(__dirname, 'src/index.js'),
  devtool: 'source-map',
  output: {
    filename: 'index.js',
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.js']
  },
  module: {
    rules: [
      {
        test: /\.js$/, use: 'babel-loader'
      }
    ]
  }
}

