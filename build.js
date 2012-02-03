var requirejs = require('./r.js'),
	config = {
		baseUrl: 'src',
		optimize: 'none',
		wrap: true,
		name: 'lib/requirejs/almond',
		include: ['main'],
		out: 'build/main.min.js'
	};

if (process.argv.indexOf('-o') !== -1 || process.argv.indexOf('--optimize') !== -1) {
	config.optimize = 'uglify';
}

requirejs.optimize(config);
