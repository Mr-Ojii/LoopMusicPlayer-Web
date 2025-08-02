const path = require("path");
const outputPath = path.join(__dirname, "dist/");

module.exports = {
  mode: 'production',
  entry: './main.ts',
  output: {
    path: outputPath,
    filename: 'app.min.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  devServer: {
    static: {
      directory: outputPath,
    },
  }
}
