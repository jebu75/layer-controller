module.exports = function (grunt) {
    grunt.initConfig({
        jshint: {
            build: {
                src: ['js/**/*.js'],
                options: {
                    jshintrc: '.jshintrc',
                    reporter: require('jshint-stylish')
                }
            }
        },
        watch: {
            dev: {
                files: ['js/**'],
                tasks: ['jshint']
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.registerTask('default', ['jshint']);
};
