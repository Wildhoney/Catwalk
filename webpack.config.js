var path = require('path');

module.exports = {
    entry: {
        collection: './src/collection.js',
        event: './src/event.js',
        typecast: './src/typecast.js'
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
                loader: 'babel'
            }
        ]
    }
};
