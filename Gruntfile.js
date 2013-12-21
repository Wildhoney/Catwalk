module.exports = function(grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: 'package/*.js',
            options: {
                jshintrc: '.jshintrc'
            }
        },
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> by <%= pkg.author %> created on <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: ['package/Catwalk.js', 'package/*.js'],
                dest: 'dist/<%= pkg.buildName %>.min.js'
            }
        },
        jasmine: {
            pivotal: {
                src: ['package/Catwalk.js', 'package/*.js'],
                options: {
                    specs: 'tests/spec.js',
                    helpers: [
                        'bower_components/underscore/underscore.js',
                        'bower_components/q/q.js',
                        'bower_components/moment/moment.js',
                        'bower_components/crossfilter/crossfilter.js'
                    ]
                }
            }
        },
        concat: {
            options: {
                separator: ';',
                stripBanners: true
            },
            dist: {
                src: ['package/Catwalk.js', 'package/*.js'],
                dest: 'dist/<%= pkg.buildName %>.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jasmine');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-concat');

    grunt.registerTask('test', ['jshint', 'jasmine', 'uglify']);
    grunt.registerTask('build', ['jshint', 'concat', 'uglify']);
    grunt.registerTask('default', ['jshint', 'concat', 'jasmine', 'uglify']);

};