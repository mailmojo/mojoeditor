define(function () {
	var exports = {};

	exports.concat = function (path1, path2) {
		var l = path1.substr(-1), s = path2.substr(0, 1);
		if (l !== '/' && s !== '/') {
			return path1 + '/' + path2;
		}
		else if (l === '/' && s === '/') {
			return path1 + path2.substr(1);
		}
		return path1 + path2;
	};

	exports.basePath = function (path) {
		var lastSep = path.lastIndexOf('/');
		if (lastSep !== -1) {
			return path.substr(0, lastSep + 1);
		}
		return '';
	};

	exports.isAbsolute = function (url) {
		return url.substr(0, 3) === 'http' || url.substr(0, 1) === '/';
	};

	return exports;
});
