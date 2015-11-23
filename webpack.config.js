var path = require('path');

module.exports = {
    entry: {
        collection: ['./src/collection.js'],
        event: ['./src/event.js'],
        field: ['./src/field.js']
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
