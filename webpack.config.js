const path = require("path");

module.exports = {
  mode: 'production',
  entry: './main.ts',
  output: {
    path: path.join(__dirname, "dist/"),
    filename: 'app.min.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader'
      }
    ]
  }
}
