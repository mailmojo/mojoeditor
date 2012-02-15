define({
	support: {
		namespaces: function (d) {
			d = d || document;

			var block = d.createElement('mm:content');
			return (block.nodeName.toLowerCase() == 'mm:content');
		}
	}
});
