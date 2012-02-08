define({
	support: {
		namespaces: (function () {
			var block = document.createElement('mm:content');
			return (block.nodeName.toLowerCase() == 'mm:content');
		})()
	}
});
