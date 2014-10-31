module.exports = function(config) {

    config.set({
        basePath: '',
        frameworks: ['jasmine'],
        reporters: ['progress'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: ['Firefox'],
        singleRun: true
    });

};