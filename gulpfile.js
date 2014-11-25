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
        jshint     = require('gulp-jshint');

    // Options for Traceur compilation.
    var traceurOptions = { blockBinding: true };

    gulp.task('build-es5', function gulpBuildES5() {

        return gulp.src(files)
            .pipe(sourcemaps.init())
            .pipe(traceur(traceurOptions))
            .pipe(concat('catwalk.es5.js'))
            .pipe(sourcemaps.write())
            .pipe(gulp.dest(distDir))
            .pipe(rename('catwalk.es5.min.js'))
            .pipe(uglify())
            .pipe(gulp.dest(distDir));

    });

    gulp.task('build-es6', function gulpBuildES6() {

        return gulp.src(files)
            .pipe(rename('catwalk.es6.js'))
            .pipe(gulp.dest('dist'));
            //.pipe(gulp.dest(vendorDest))
            //.pipe(rename('catwalk.es6.min.js'))
            //.pipe(uglify())
            //.pipe(gulp.dest('dist'));

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

    gulp.task('copy', function gulpHint() {

        return gulp.src(files)
            .pipe(sourcemaps.init())
            .pipe(traceur(traceurOptions))
            .pipe(concat('catwalk.es5.js'))
            .pipe(gulp.dest('example/vendor/catwalk'));

    });

    gulp.task('test', ['hint', 'build-es5-temp', 'karma']);
    gulp.task('build', ['build-es5', 'build-es6', 'copy']);
    gulp.task('default', ['test', 'build']);

})();