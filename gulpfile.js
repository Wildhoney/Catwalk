(function main() {

    var files   = ['package/Catwalk.js', 'package/*.js', 'package/**/*.js'],
        distDir = 'dist';

    var gulp       = require('gulp'),
        sourcemaps = require('gulp-sourcemaps'),
        traceur    = require('gulp-traceur'),
        concat     = require('gulp-concat'),
        uglify     = require('gulp-uglify'),
        rename     = require('gulp-rename'),
        karma      = require('gulp-karma'),
        jshint     = require('gulp-jshint'),
        to5        = require('gulp-6to5');

    // Options for Traceur compilation.
    var traceurOptions = { blockBinding: true };

    gulp.task('build-es5', function gulpBuildES5() {

        return gulp.src(files)
                   .pipe(sourcemaps.init())
                   .pipe(traceur(traceurOptions))
                   .pipe(concat('catwalk.es5.js'))
                   .pipe(sourcemaps.write())
                   .pipe(gulp.dest(distDir));

    });

    gulp.task('build-es6', function gulpBuildES6() {

        return gulp.src(files)
                   .pipe(sourcemaps.init())
                   .pipe(concat('catwalk.es6.js'))
                   .pipe(gulp.dest(distDir));

    });

    gulp.task('build-es6-traceur', function gulpBuildTraceur() {

        return gulp.src(files)
                   .pipe(rename('catwalk.es6.traceur.js'))
                   .pipe(gulp.dest('dist/traceur'));
            //.pipe(gulp.dest(vendorDest))
            //.pipe(rename('catwalk.es6.min.js'))
            //.pipe(uglify())
            //.pipe(gulp.dest('dist'));

    });

    gulp.task('build-es6-6to5', function gulpBuild6To5() {

        return gulp.src(files)
                   .pipe(to5())
                   .pipe(rename('catwalk.es6.6to5.js'))
                   .pipe(gulp.dest('dist/6to5'));

    });

    gulp.task('build-es5-temp', function gulpBuildES5() {

        return gulp.src(files)
                   .pipe(sourcemaps.init())
                   .pipe(traceur(traceurOptions))
                   .pipe(concat('catwalk.es5.tests.js'))
                   .pipe(sourcemaps.write())
                   .pipe(gulp.dest('tests/es5-build'));

    });

    gulp.task('karma', ['build-es5-temp'], function gulpKarma() {

        var testFiles = [
            'example/vendor/traceur/traceur.js',
            'tests/es5-build/catwalk.es5.tests.js',
            'tests/spec.js'
        ];

        return gulp.src(testFiles).pipe(karma({
            configFile: 'karma.conf.js',
            action: 'run'
        })).on('error', function onError(error) {
            throw error;
        });

    });

    gulp.task('hint', function gulpHint() {

        return gulp.src(files)
                   .pipe(jshint('.jshintrc'))
                   .pipe(jshint.reporter('default'));

    });

    gulp.task('vendor-copy', function gulpVendorCopy() {

        return gulp.src(files)
                   .pipe(sourcemaps.init())
                   .pipe(traceur(traceurOptions))
                   .pipe(concat('catwalk.es5.js'))
                   .pipe(gulp.dest('example/vendor/catwalk'));

    });

    gulp.task('minify-all', function gulpMinifyAll() {

        /**
         * @method minifyFile
         * @param directory {String}
         * @param fromFilename {String}
         * @param toFilename {String}
         * @return {Object}
         */
        var minifyFile = function minifyFile(directory, fromFilename, toFilename) {

            gulp.src(directory + '/' + fromFilename)
                .pipe(rename(toFilename))
                .pipe(uglify())
                .pipe(gulp.dest(directory));

            return { minifyFile: minifyFile };

        };

        return minifyFile('dist', 'catwalk.es5.js', 'catwalk.es5.min.js')
              .minifyFile('dist/6to5', 'catwalk.es6.6to5.js', 'catwalk.es6.6to5.min.js');
    });

    gulp.task('test', ['hint', 'build-es5-temp', 'karma']);
    gulp.task('build', ['build-es5', 'build-es6', 'build-es6-traceur', 'build-es6-6to5', 'vendor-copy', 'minify-all']);
    gulp.task('default', ['test', 'build']);

})();