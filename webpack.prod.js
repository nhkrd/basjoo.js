const { merge } = require('webpack-merge');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const commonConfig = require('./webpack.config.js');

module.exports = (env) => {
  const envFilePath = env && env.file ? `./env/${env.file}` : './env/prod.env';

  return merge(
    commonConfig({ isProd: true, envFilePath, useSourceMap: false }),
    {
      mode: 'production',

      plugins: [new CleanWebpackPlugin()],
    }
  );
};
