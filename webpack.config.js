const Dotenv = require('dotenv-webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require('path');

const dist = path.resolve(__dirname, './dist');

module.exports = ({ isProd, envFilePath }) => {
  return {
    context: path.resolve(__dirname, 'src'),

    entry: './index.ts',

    target: ['web', 'es5'],

    resolve: {
      extensions: [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.html',
        '.scss',
        '.css',
        '.json',
        '.svg',
      ],
      plugins: [new TsconfigPathsPlugin()],
    },

    output: {
      path: dist,
      filename: isProd ? 'basjoo.min.js' : 'basjoo.all.js',
    },

    module: {
      rules: [
        {
          test: /DashTVPlayer.ts/,
          loader: 'string-replace-loader',
          options: {
            search: '<deploy_date>',
            replace: (function(){return new Date().toLocaleString("ja");})
          }
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
            },
            {
              loader: 'eslint-loader',
            },
          ],
        },
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'eslint-loader',
            },
          ],
        },
      ],
    },

    plugins: [
      new Dotenv({
        path: path.join(__dirname, envFilePath),
      }),
    ],

    performance: {
      maxEntrypointSize: 400000,
      maxAssetSize: 400000
    },
  };
};
