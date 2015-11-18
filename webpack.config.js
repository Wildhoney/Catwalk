var path = require('path');

module.exports = {
    entry: {
        collection: './src/collection.js'
    },
    output: {
        path: path.join(__dirname, 'build'),
        filename: '[name].js',
        library: 'Catwalk',
        libraryTarget: 'commonjs2'
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'babel'
            }
        ]
    }
};
