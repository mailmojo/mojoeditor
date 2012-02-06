var requirejs = require('./r.js'),
	baseConfig = {
		baseUrl: 'src',
		wrap: true,
		name: 'lib/requirejs/almond',
		include: ['main']
	},
	configs = [
		{
			optimize: 'none',
			out: 'build/mojoeditor.js'
		},
		{
			optimize: 'uglify',
			out: 'build/mojoeditor.min.js'
		}
	];

// Function used to mix in baseConfig to a new config target
function mix (target) {
	for (var prop in baseConfig) {
		if (baseConfig.hasOwnProperty(prop)) {
			target[prop] = baseConfig[prop];
		}
	}
	return target;
}

//Create a runner that will run a separate build for each item
//in the configs array. Thanks to @jwhitley for this cleverness
var runner = configs.reduceRight(function(prev, currentConfig) {
	return function (buildReportText) {
		requirejs.optimize(mix(currentConfig), prev);
	};
}, function(buildReportText){
	// Output the build results
	console.log(buildReportText);
});

//Run the builds
runner();
