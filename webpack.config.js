var path = require('path');

module.exports = {
    entry: {
        catwalk: ['./src/catwalk.js']
    },
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
        library: 'Catwalk',
        libraryTarget: 'commonjs2'
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel-loader?stage=1'
            }
        ]
    }
};
