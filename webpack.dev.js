const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.config.js');

const dist = path.resolve(__dirname, './dist');

module.exports = (env) => {
  const envFilePath = env && env.file ? `./env/${env.file}` : './env/dev.env';

  return merge(
    commonConfig({ isProd: false, envFilePath, useSourceMap: true }),
    {
      mode: 'development',

      devtool: false,

      devServer: {
        contentBase: dist,
        watchContentBase: true,
        host: '0.0.0.0',
        port: 49152,
        hot: true,
        inline: true,
        historyApiFallback: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods':
            'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        },
      },

      module: {
        rules: [
          {
            test: /\.html$/,
            use: 'html-loader',
          },
        ]
      },

      plugins: [
        new webpack.HotModuleReplacementPlugin(),
      ],
    }
  );
};
