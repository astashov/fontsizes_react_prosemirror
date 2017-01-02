module.exports = {
  entry: "./src/main.jsx",
  output: {
    filename: "[name].js",
    path: "./dist",
    libraryTarget: "commonjs2"
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'react']
        }
      }
    ]
  },
  devtool: "source-map"
};